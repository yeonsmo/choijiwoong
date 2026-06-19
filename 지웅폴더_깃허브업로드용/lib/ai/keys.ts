import "server-only";

import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import type { AiKind } from "@/lib/ai/catalog";

/**
 * AI API 키(ai_api_keys) 저장/조회/삭제(지침 4-1).
 *   - 평문 키는 절대 노출하지 않는다. 목록 조회는 마스킹만 반환한다.
 *   - 복호화된 평문은 엔진 실행(분석/생성) 내부에서만 사용한다.
 *   - 모든 접근은 service_role(서버). 권한 검증은 호출하는 액션/라우트에서 수행.
 */

export interface AiKeyRow {
  id: number;
  kind: AiKind;
  provider: string;
  label: string;
  enabled: boolean;
  created_at: string;
}

export interface AiKeyMasked extends AiKeyRow {
  masked: string;
}

/** 평문을 포함한 키(엔진 전용). UI 로 절대 반환하지 않는다. */
export interface AiKeyPlain extends AiKeyRow {
  apiKey: string;
}

/** 목록(마스킹). 설정 화면 표시용. */
export async function listAiKeysMasked(): Promise<AiKeyMasked[]> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("ai_api_keys")
    .select("id, kind, provider, label, cipher, enabled, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`AI 키 조회 실패: ${error.message}`);

  return (data ?? []).map((r) => {
    let masked = "****";
    try {
      masked = maskSecret(decryptSecret(r.cipher as string));
    } catch {
      masked = "****";
    }
    return {
      id: r.id as number,
      kind: r.kind as AiKind,
      provider: r.provider as string,
      label: (r.label as string) ?? "",
      enabled: r.enabled as boolean,
      created_at: r.created_at as string,
      masked,
    };
  });
}

/** 특정 용도의 활성 키(평문 포함)를 반환. 엔진 전용. */
export async function getActiveKeysPlain(kind: AiKind): Promise<AiKeyPlain[]> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("ai_api_keys")
    .select("id, kind, provider, label, cipher, enabled, created_at")
    .eq("kind", kind)
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`AI 키 조회 실패(${kind}): ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as number,
    kind: r.kind as AiKind,
    provider: r.provider as string,
    label: (r.label as string) ?? "",
    enabled: r.enabled as boolean,
    created_at: r.created_at as string,
    apiKey: decryptSecret(r.cipher as string),
  }));
}

/** 용도별 활성 키 개수. 기능 게이팅(지침 5-2-4) 표시에 사용. */
export async function countActiveKeysByKind(): Promise<Record<AiKind, number>> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("ai_api_keys")
    .select("kind")
    .eq("enabled", true);
  if (error) throw new Error(`AI 키 집계 실패: ${error.message}`);
  const out: Record<AiKind, number> = { analysis: 0, copy: 0, image: 0, video: 0 };
  for (const r of data ?? []) {
    const k = r.kind as AiKind;
    if (k in out) out[k] += 1;
  }
  return out;
}

export async function addAiKey(input: {
  kind: AiKind;
  provider: string;
  label: string;
  apiKey: string;
  createdBy: string;
}): Promise<void> {
  const admin = createServiceRoleSupabase();
  const cipher = encryptSecret(input.apiKey);
  const { error } = await admin.from("ai_api_keys").insert({
    kind: input.kind,
    provider: input.provider,
    label: input.label,
    cipher,
    enabled: true,
    created_by: input.createdBy,
  });
  if (error) throw new Error(`AI 키 저장 실패: ${error.message}`);
}

export async function deleteAiKey(id: number): Promise<void> {
  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("ai_api_keys").delete().eq("id", id);
  if (error) throw new Error(`AI 키 삭제 실패: ${error.message}`);
}

export async function setAiKeyEnabled(id: number, enabled: boolean): Promise<void> {
  const admin = createServiceRoleSupabase();
  const { error } = await admin
    .from("ai_api_keys")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(`AI 키 상태 변경 실패: ${error.message}`);
}
