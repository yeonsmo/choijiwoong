import "server-only";

import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { getProfileByIdAsService } from "@/lib/auth";

/**
 * 시스템 설정(system_settings) 접근 헬퍼.
 *   - 비밀값(API 키)은 AES-256-GCM 으로 암호화하여 value.cipher 에 저장한다.
 *   - 평문 키는 절대 반환하지 않는다. 상태/마스킹만 노출한다.
 *   - 법제처 API 키 관리는 91일 업데이트 카운터와 완전히 독립이다(지침 3-1-3, 3-3).
 *     이 모듈은 카운터 관련 값을 일절 읽거나 쓰지 않는다.
 */

/** 법제처 API 키를 저장하는 설정 키 이름. */
export const LAW_API_KEY = "law_api_key";

/** 트렌드 API 범용 설정을 저장하는 설정 키 이름(지침 5-3). */
export const TREND_API_KEY = "trend_api";

export interface SettingRow {
  key: string;
  value: { cipher?: string } & Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

/** 설정 한 건을 service_role 로 조회. 없으면 null. */
export async function getSettingRow(key: string): Promise<SettingRow | null> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("system_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`설정 조회 실패(${key}): ${error.message}`);
  return (data as SettingRow | null) ?? null;
}

export interface LawApiKeyStatus {
  configured: boolean;
  /** 마스킹된 키(끝 4자리). 미설정이면 null. */
  masked: string | null;
  /** 직전에 이 설정을 저장한 사람이 최고권한자(SUPER)인지. ADMIN 변경 차단 판정에 사용. */
  setBySuper: boolean;
}

/**
 * 법제처 API 키의 현재 상태를 반환한다(읽기 전용).
 *   평문은 마스킹해서만 노출한다. 복호화는 서버에서만 수행.
 */
export async function getLawApiKeyStatus(): Promise<LawApiKeyStatus> {
  const row = await getSettingRow(LAW_API_KEY);
  if (!row || !row.value?.cipher) {
    return { configured: false, masked: null, setBySuper: false };
  }

  let masked: string | null = null;
  try {
    masked = maskSecret(decryptSecret(row.value.cipher));
  } catch {
    // 복호화 실패(키 손상/마스터키 불일치)는 상태 표시에서 마스킹 생략.
    masked = "****";
  }

  let setBySuper = false;
  if (row.updated_by) {
    const writer = await getProfileByIdAsService(row.updated_by);
    setBySuper = writer?.role === "SUPER";
  }

  return { configured: true, masked, setBySuper };
}

/**
 * 법제처 API 키 평문을 복호화하여 반환한다(수집 실행 전용, 서버에서만 호출).
 *   미설정이면 null. 복호화 실패는 원문 오류로 전파(임의 복구 금지).
 */
export async function getLawApiKeyPlaintext(): Promise<string | null> {
  const row = await getSettingRow(LAW_API_KEY);
  if (!row || !row.value?.cipher) return null;
  return decryptSecret(row.value.cipher);
}

// ---------------------------------------------------------------------------
// 트렌드 API 범용 설정(지침 5-3): 엔드포인트 + 응답 파싱 규칙 + (선택)API 키.
//   엔드포인트/파싱규칙은 비밀이 아니므로 평문 저장, API 키만 암호화한다.
// ---------------------------------------------------------------------------

export interface TrendConfigStatus {
  configured: boolean;
  endpoint: string | null;
  /** 응답 JSON 에서 트렌드 텍스트를 뽑는 경로(예: data.items[].title). */
  parseRule: string | null;
  /** 키 설정 여부(평문은 노출하지 않음). */
  hasKey: boolean;
}

export async function getTrendConfigStatus(): Promise<TrendConfigStatus> {
  const row = await getSettingRow(TREND_API_KEY);
  const v = (row?.value ?? {}) as {
    endpoint?: string;
    parseRule?: string;
    cipher?: string;
  };
  const configured = Boolean(v.endpoint);
  return {
    configured,
    endpoint: v.endpoint ?? null,
    parseRule: v.parseRule ?? null,
    hasKey: Boolean(v.cipher),
  };
}

/** 트렌드 API 키 평문 + 설정을 반환(생성 엔진 전용, 서버에서만). 미설정이면 null. */
export async function getTrendConfigForEngine(): Promise<{
  endpoint: string;
  parseRule: string | null;
  apiKey: string | null;
} | null> {
  const row = await getSettingRow(TREND_API_KEY);
  const v = (row?.value ?? {}) as {
    endpoint?: string;
    parseRule?: string;
    cipher?: string;
  };
  if (!v.endpoint) return null;
  return {
    endpoint: v.endpoint,
    parseRule: v.parseRule ?? null,
    apiKey: v.cipher ? decryptSecret(v.cipher) : null,
  };
}
