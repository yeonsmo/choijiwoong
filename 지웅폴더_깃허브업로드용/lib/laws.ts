import "server-only";

import { createServiceRoleSupabase } from "@/lib/supabase/server";

/**
 * 법령 데이터(law_documents) + 수집 메타(law_collection_meta) 접근 헬퍼.
 *   - 모든 접근은 서버(service_role). 클라이언트 직접 접근은 RLS로 차단된다.
 *   - 91일 카운터(지침 3-3)는 법제처 API 키 관리와 완전히 독립이다(지침 3-1-3).
 *     이 모듈은 키 값을 읽거나 쓰지 않는다.
 */

/** 지침 3-2 의 7개 수집 범주. */
export const LAW_CATEGORIES: Record<number, string> = {
  1: "보험업법 및 시행령·시행규칙",
  2: "표시·광고의 공정화에 관한 법률",
  3: "금융소비자 보호에 관한 법률",
  4: "보험업감독규정",
  5: "보험업감독업무시행세칙",
  6: "관련 행정규칙 및 고시",
  7: "공정거래위원회 표시·광고 심사지침",
};

/** 91일 카운터 임계값(일). 지침 3-3. */
export const UPDATE_INTERVAL_DAYS = 91;

export interface LawDocumentInput {
  category: number;
  law_name: string;
  doc_type?: string | null;
  article_no?: string | null;
  article_label?: string | null;
  title?: string | null;
  content: string;
  source?: "moleg" | "manual";
  source_id?: string | null;
  raw?: unknown;
}

export interface CollectionMeta {
  first_collected_at: string | null;
  last_collected_at: string | null;
  last_count: number;
  last_status: string | null;
}

/** 조문 하나의 중복 제거 키를 합성한다. 재수집 시 upsert 기준. */
export function buildDedupKey(d: LawDocumentInput): string {
  return [
    d.category,
    d.law_name,
    d.article_no ?? "",
    d.source ?? "moleg",
    d.source_id ?? "",
  ].join("|");
}

/**
 * 수집한 조문들을 dedup_key 기준으로 upsert 한다.
 * 큰 배열은 분할(batch)하여 적재한다. 반환값은 적재 시도 건수.
 */
export async function upsertLawDocuments(
  docs: LawDocumentInput[],
): Promise<number> {
  if (docs.length === 0) return 0;
  const admin = createServiceRoleSupabase();

  const rows = docs.map((d) => ({
    category: d.category,
    law_name: d.law_name,
    doc_type: d.doc_type ?? null,
    article_no: d.article_no ?? null,
    article_label: d.article_label ?? null,
    title: d.title ?? null,
    content: d.content,
    source: d.source ?? "moleg",
    source_id: d.source_id ?? null,
    dedup_key: buildDedupKey(d),
    raw: d.raw ?? null,
    fetched_at: new Date().toISOString(),
  }));

  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await admin
      .from("law_documents")
      .upsert(slice, { onConflict: "dedup_key" });
    if (error) {
      // 오류 원문 그대로(지침 9-4). 임의 복구하지 않는다.
      throw new Error(`법령 적재 실패(${i}~${i + slice.length}): ${error.message}`);
    }
    total += slice.length;
  }
  return total;
}

/** 카테고리별 적재 건수. 설정 화면 표시용. */
export async function countLawDocumentsByCategory(): Promise<
  Record<number, number>
> {
  const admin = createServiceRoleSupabase();
  const result: Record<number, number> = {};
  for (const cat of Object.keys(LAW_CATEGORIES).map(Number)) {
    const { count, error } = await admin
      .from("law_documents")
      .select("id", { count: "exact", head: true })
      .eq("category", cat);
    if (error) throw new Error(`법령 건수 조회 실패(cat ${cat}): ${error.message}`);
    result[cat] = count ?? 0;
  }
  return result;
}

export async function countLawDocumentsTotal(): Promise<number> {
  const admin = createServiceRoleSupabase();
  const { count, error } = await admin
    .from("law_documents")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`법령 총건수 조회 실패: ${error.message}`);
  return count ?? 0;
}

/**
 * 분석 대조용 법령 컨텍스트를 가져온다.
 *   무료티어/토큰 한도를 고려해 카테고리별 상한을 두고 본문을 잘라 합친다.
 *   고도화 시 임베딩 검색으로 교체할 수 있는 단순 검색 계층.
 */
export async function getLawContext(opts?: {
  perCategory?: number;
  maxCharsPerDoc?: number;
}): Promise<{ category: number; law_name: string; article_label: string | null; content: string }[]> {
  const perCategory = opts?.perCategory ?? 40;
  const maxChars = opts?.maxCharsPerDoc ?? 800;
  const admin = createServiceRoleSupabase();

  const out: {
    category: number;
    law_name: string;
    article_label: string | null;
    content: string;
  }[] = [];

  for (const cat of Object.keys(LAW_CATEGORIES).map(Number)) {
    const { data, error } = await admin
      .from("law_documents")
      .select("category, law_name, article_label, content")
      .eq("category", cat)
      .limit(perCategory);
    if (error) throw new Error(`법령 컨텍스트 조회 실패(cat ${cat}): ${error.message}`);
    for (const row of data ?? []) {
      out.push({
        category: row.category as number,
        law_name: row.law_name as string,
        article_label: (row.article_label as string | null) ?? null,
        content: String(row.content ?? "").slice(0, maxChars),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 수집 메타 / 91일 카운터
// ---------------------------------------------------------------------------

/** 메타 단일 행을 조회한다(없으면 빈 메타). */
export async function getCollectionMeta(): Promise<CollectionMeta> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("law_collection_meta")
    .select("first_collected_at, last_collected_at, last_count, last_status")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`수집 메타 조회 실패: ${error.message}`);
  return (
    (data as CollectionMeta | null) ?? {
      first_collected_at: null,
      last_collected_at: null,
      last_count: 0,
      last_status: null,
    }
  );
}

/** 수집 완료 시각/건수/상태를 갱신한다. 최초 수집일은 한 번만 기록. */
export async function recordCollection(count: number, status: string): Promise<void> {
  const admin = createServiceRoleSupabase();
  const now = new Date().toISOString();
  const meta = await getCollectionMeta();
  const { error } = await admin.from("law_collection_meta").upsert(
    {
      id: 1,
      first_collected_at: meta.first_collected_at ?? now,
      last_collected_at: now,
      last_count: count,
      last_status: status,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`수집 메타 기록 실패: ${error.message}`);
}

export interface UpdateStatus {
  /** 한 번이라도 수집한 적이 있는지. */
  everCollected: boolean;
  /** 마지막(없으면 최초) 수집 후 경과 일수. 수집 이력 없으면 null. */
  daysSince: number | null;
  /** 91일이 지나 업데이트 안내가 필요한지. */
  dueForUpdate: boolean;
  lastCollectedAt: string | null;
  lastCount: number;
}

/**
 * 91일 경과 여부를 계산한다(지침 3-3-2,3).
 *   비교 기준: 최종 수집일(없으면 최초 수집일). 둘 다 없으면 미수집.
 */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const meta = await getCollectionMeta();
  const ref = meta.last_collected_at ?? meta.first_collected_at;
  if (!ref) {
    return {
      everCollected: false,
      daysSince: null,
      dueForUpdate: false,
      lastCollectedAt: null,
      lastCount: meta.last_count,
    };
  }
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  return {
    everCollected: true,
    daysSince: days,
    dueForUpdate: days >= UPDATE_INTERVAL_DAYS,
    lastCollectedAt: meta.last_collected_at,
    lastCount: meta.last_count,
  };
}
