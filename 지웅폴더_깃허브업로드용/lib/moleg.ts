import "server-only";

import type { LawDocumentInput } from "@/lib/laws";

/**
 * 법제처 국가법령정보 공동활용 OPEN API 클라이언트.
 *   문서: https://open.law.go.kr  (DRF/lawSearch.do, DRF/lawService.do)
 *
 * 인증: OPEN API 는 발급받은 OC(이메일 ID 기반) 값을 OC 파라미터로 전달한다.
 *   본 앱은 설정 메뉴에 저장된 "법제처 API 키"(암호화) 평문을 OC 값으로 사용한다.
 *
 * 설계 원칙:
 *   - 응답 구조(JSON)는 target/문서에 따라 키 이름이 다르므로 방어적으로 탐색한다.
 *   - 추출 실패해도 throw 하지 않고 가능한 만큼 조문을 모은다(raw 는 보존).
 *   - 네트워크/HTTP 오류는 원문 그대로 전파한다(지침 9-4, 임의 복구 금지).
 */

const BASE = "https://www.law.go.kr/DRF";

/** 카테고리별 검색 설정(지침 3-2). target 은 법제처 API 의 자료 구분. */
interface CategoryQuery {
  category: number;
  target: "law" | "admrul"; // law=법령, admrul=행정규칙/고시/지침
  queries: string[];
}

const CATEGORY_QUERIES: CategoryQuery[] = [
  { category: 1, target: "law", queries: ["보험업법", "보험업법 시행령", "보험업법 시행규칙"] },
  { category: 2, target: "law", queries: ["표시·광고의 공정화에 관한 법률"] },
  { category: 3, target: "law", queries: ["금융소비자 보호에 관한 법률"] },
  { category: 4, target: "admrul", queries: ["보험업감독규정"] },
  { category: 5, target: "admrul", queries: ["보험업감독업무시행세칙"] },
  { category: 6, target: "admrul", queries: ["보험 광고", "보험상품 광고", "광고 고시"] },
  { category: 7, target: "admrul", queries: ["표시·광고 심사지침", "표시광고 심사지침"] },
];

interface SearchHit {
  /** 법령/행정규칙 명칭. */
  name: string;
  /** 상세 조회용 식별자(법령일련번호 MST 또는 ID). */
  mst?: string;
  id?: string;
}

/** OPEN API 가 요구하는 형식의 URL 을 만든다. */
function buildUrl(path: string, params: Record<string, string>): string {
  const usp = new URLSearchParams(params);
  return `${BASE}/${path}?${usp.toString()}`;
}

/** JSON 응답에서 키 이름이 무엇이든 첫 번째로 발견되는 배열을 찾는다. */
function findFirstArray(obj: unknown): unknown[] | null {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const found = findFirstArray(v);
      if (found) return found;
    }
  }
  return null;
}

/** 객체에서 후보 키 목록 중 첫 번째로 값이 있는 것을 문자열로 반환. */
function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** 검색 1건 수행. 실패 시 빈 배열(부분 수집 허용). */
async function search(
  oc: string,
  target: string,
  query: string,
): Promise<SearchHit[]> {
  const url = buildUrl("lawSearch.do", {
    OC: oc,
    target,
    type: "JSON",
    query,
    display: "100",
  });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`법제처 검색 HTTP ${res.status} (${target}/${query})`);
  }
  const text = await res.text();

  // OC 미인증 등은 HTML/안내문이 올 수 있다. JSON 파싱 실패는 명확히 알린다.
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `법제처 검색 응답이 JSON 이 아닙니다(${target}/${query}). ` +
        `API 키(OC) 등록/승인 여부를 확인하세요. 응답 앞부분: ${text.slice(0, 200)}`,
    );
  }

  const arr = findFirstArray(json) ?? [];
  const hits: SearchHit[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = pick(o, ["법령명한글", "법령명", "행정규칙명", "제목", "title"]);
    if (!name) continue;
    hits.push({
      name,
      mst: pick(o, ["법령일련번호", "MST", "mst", "행정규칙일련번호"]),
      id: pick(o, ["법령ID", "ID", "id", "행정규칙ID"]),
    });
  }
  return hits;
}

/** 상세 조회 후 조문 단위로 분해. 실패 시 빈 배열. */
async function fetchArticles(
  oc: string,
  target: string,
  hit: SearchHit,
  category: number,
): Promise<LawDocumentInput[]> {
  const params: Record<string, string> = { OC: oc, target, type: "JSON" };
  if (hit.mst) params.MST = hit.mst;
  else if (hit.id) params.ID = hit.id;
  else return [];

  const url = buildUrl("lawService.do", params);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`법제처 상세 HTTP ${res.status} (${hit.name})`);
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 상세가 JSON 이 아니면 이 문서만 건너뛴다(부분 수집 허용).
    return [];
  }

  // 조문 배열 탐색: "조문단위" 또는 가장 큰 배열을 사용.
  const articles = extractArticleArray(json);
  const docs: LawDocumentInput[] = [];

  if (articles && articles.length > 0) {
    for (const a of articles) {
      if (!a || typeof a !== "object") continue;
      const o = a as Record<string, unknown>;
      const content = pick(o, ["조문내용", "조문", "content", "내용"]);
      if (!content) continue;
      const no = pick(o, ["조문번호", "조번호"]);
      const label = pick(o, ["조문제목", "조제목"]);
      docs.push({
        category,
        law_name: hit.name,
        doc_type: target === "admrul" ? "행정규칙" : "법령",
        article_no: no ?? null,
        article_label: label ? `제${no ?? ""}조(${label})` : (no ? `제${no}조` : null),
        title: label ?? null,
        content,
        source: "moleg",
        source_id: hit.mst ?? hit.id ?? null,
        raw: a,
      });
    }
  }

  // 조문 분해가 전혀 안 되면 전체를 한 덩어리로 저장(빈손 방지).
  if (docs.length === 0) {
    const flat = flattenText(json).slice(0, 20000);
    if (flat.trim()) {
      docs.push({
        category,
        law_name: hit.name,
        doc_type: target === "admrul" ? "행정규칙" : "법령",
        article_no: null,
        article_label: null,
        title: hit.name,
        content: flat,
        source: "moleg",
        source_id: hit.mst ?? hit.id ?? null,
        raw: json,
      });
    }
  }

  return docs;
}

/** "조문단위" 키를 우선 탐색하고, 없으면 가장 큰 객체 배열을 사용한다. */
function extractArticleArray(json: unknown): unknown[] | null {
  let best: unknown[] | null = null;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      if (!best || node.length > best.length) best = node;
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (Array.isArray(o["조문단위"])) {
        best = o["조문단위"] as unknown[];
        return;
      }
      Object.values(o).forEach(visit);
    }
  };
  visit(json);
  return best;
}

/** JSON 의 모든 문자열 값을 이어붙인다(조문 분해 실패 시 폴백). */
function flattenText(node: unknown): string {
  if (typeof node === "string") return node + "\n";
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (node && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).map(flattenText).join("");
  }
  return "";
}

export interface CollectResult {
  collected: LawDocumentInput[];
  /** 카테고리/질의별 진행 로그(성공·건수·오류 원문). */
  log: string[];
}

/**
 * 7개 범주 전체를 수집한다(지침 3-1, 3-2).
 *   각 질의 단위로 오류를 격리하여 부분 실패가 전체를 막지 않게 한다.
 *   호출자(수집 액션)는 collected 를 upsert 하고 log 를 상태로 기록한다.
 */
export async function collectAllLaws(oc: string): Promise<CollectResult> {
  const collected: LawDocumentInput[] = [];
  const log: string[] = [];

  for (const cq of CATEGORY_QUERIES) {
    for (const q of cq.queries) {
      try {
        const hits = await search(oc, cq.target, q);
        let added = 0;
        for (const hit of hits.slice(0, 5)) {
          try {
            const docs = await fetchArticles(oc, cq.target, hit, cq.category);
            collected.push(...docs);
            added += docs.length;
          } catch (e) {
            log.push(
              `cat${cq.category} "${q}" / ${hit.name}: 상세 실패 - ${
                e instanceof Error ? e.message : String(e)
              }`,
            );
          }
        }
        log.push(`cat${cq.category} "${q}": 검색 ${hits.length}건, 조문 ${added}건`);
      } catch (e) {
        log.push(
          `cat${cq.category} "${q}": 검색 실패 - ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  return { collected, log };
}
