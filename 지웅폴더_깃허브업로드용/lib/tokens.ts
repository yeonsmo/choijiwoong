import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/**
 * 외부 호출용 API 토큰(지침 7).
 *   - 발급 시 평문 토큰은 1회만 반환하고, DB 에는 sha256 해시만 저장한다.
 *   - 인증은 Bearer 토큰을 해시로 대조하여 수행한다(평문 미저장).
 *   - 발급/조회/폐기는 관리자(ADMIN 이상)가 수행한다.
 */

const PREFIX = "iac_"; // insurance-ad-compliance

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ApiTokenRow {
  id: number;
  name: string;
  token_prefix: string;
  scope: string[];
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
}

/** 토큰 발급. 평문 토큰을 1회 반환(이후 조회 불가). */
export async function issueToken(
  name: string,
  scope: string[],
  createdBy: string,
): Promise<{ token: string; row: ApiTokenRow }> {
  const secret = randomBytes(24).toString("base64url");
  const token = `${PREFIX}${secret}`;
  const token_prefix = token.slice(0, 12);
  const token_hash = hashToken(token);

  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("api_tokens")
    .insert({
      name,
      token_prefix,
      token_hash,
      scope,
      created_by: createdBy,
    })
    .select("id, name, token_prefix, scope, revoked, created_at, last_used_at")
    .single();
  if (error || !data) throw new Error(`토큰 발급 실패: ${error?.message ?? "unknown"}`);
  return { token, row: data as ApiTokenRow };
}

export async function listTokens(): Promise<ApiTokenRow[]> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, name, token_prefix, scope, revoked, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`토큰 조회 실패: ${error.message}`);
  return (data ?? []) as ApiTokenRow[];
}

export async function revokeToken(id: number): Promise<void> {
  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("api_tokens").update({ revoked: true }).eq("id", id);
  if (error) throw new Error(`토큰 폐기 실패: ${error.message}`);
}

export interface VerifiedToken {
  id: number;
  name: string;
  scope: string[];
}

/**
 * Authorization 헤더의 Bearer 토큰을 검증한다.
 *   유효(존재 + 미폐기)하면 토큰 정보를 반환하고 last_used_at 을 갱신한다. 아니면 null.
 */
export async function verifyBearer(authHeader: string | null): Promise<VerifiedToken | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token.startsWith(PREFIX)) return null;

  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, name, scope, revoked")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data || data.revoked) return null;

  // 사용 시각 갱신(실패해도 인증은 통과).
  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { id: data.id as number, name: data.name as string, scope: (data.scope as string[]) ?? [] };
}
