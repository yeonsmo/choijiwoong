import "server-only";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";

export type Role = "USER" | "ADMIN" | "SUPER";
export type Status = "ACTIVE" | "DISABLED";

export interface Profile {
  id: string;
  email: string;
  role: Role;
  status: Status;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 역할 위계: 숫자가 클수록 강한 권한. */
const RANK: Record<Role, number> = { USER: 1, ADMIN: 2, SUPER: 3 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * 현재 세션의 인증 사용자 + 프로필을 반환.
 * 로그인하지 않았거나 프로필이 없으면 null.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 본인 프로필은 RLS(profiles_self_select)로 조회 허용.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * 최소 권한 요구. 충족하지 못하면 사유 문자열을 던진다(호출부에서 403 처리).
 * 비활성(DISABLED) 계정은 어떤 권한도 갖지 못한다.
 */
export async function requireRole(min: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthError("UNAUTHENTICATED", "로그인이 필요합니다.");
  if (profile.status !== "ACTIVE") {
    throw new AuthError("DISABLED", "비활성화된 계정입니다.");
  }
  if (!roleAtLeast(profile.role, min)) {
    throw new AuthError("FORBIDDEN", `권한 부족: ${min} 이상 필요합니다.`);
  }
  return profile;
}

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "DISABLED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * 관리 작업용: 대상 계정 프로필을 service_role로 조회(RLS 우회).
 * 권한 검증을 마친 호출부에서만 사용한다.
 */
export async function getProfileByIdAsService(id: string): Promise<Profile | null> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Profile;
}
