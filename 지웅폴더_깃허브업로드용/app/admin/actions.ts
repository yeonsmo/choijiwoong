"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireRole,
  AuthError,
  getProfileByIdAsService,
} from "@/lib/auth";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/** 서버 액션 공통 결과 타입. useActionState 로 폼에서 사용한다. */
export interface ActionResult {
  ok: boolean;
  message: string;
}

// 신규 계정 입력 스키마.
//   role 은 USER/ADMIN 만 허용한다. SUPER 는 신규 생성으로 부여 불가(지침 2-3-3:
//   SUPER 는 초기 시드 계정으로만 존재).
const createAccountSchema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않아요."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 해요."),
  role: z.enum(["USER", "ADMIN"], {
    errorMap: () => ({ message: "권한 등급은 USER 또는 ADMIN 만 지정할 수 있어요." }),
  }),
});

/**
 * 신규 계정 생성.
 *   - ADMIN 이상만 호출 가능(서버 사이드 강제).
 *   - Supabase Auth 사용자 생성 후 profiles 에 권한/상태를 기록한다.
 *   - SUPER 등급은 생성 불가(스키마에서 차단).
 *   - 공개 회원가입은 제공하지 않으며, 이 경로(관리자)로만 계정이 만들어진다(지침 2-3).
 */
export async function createAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // 1) 권한 검증.
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  // 2) 입력 검증.
  const parsed = createAccountSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "입력값을 확인해 주세요." };
  }
  const { email, password, role } = parsed.data;

  const admin = createServiceRoleSupabase();

  // 3) Auth 사용자 생성. email_confirm=true 로 즉시 로그인 가능(폐쇄형이라 메일 확인 불필요).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // 오류 원문 표시(지침 9-4). 이미 같은 이메일이 있으면 Supabase 가 그대로 알려준다.
    return {
      ok: false,
      message: `계정 생성 실패: ${createErr?.message ?? "사용자를 만들지 못했어요."}`,
    };
  }

  // 4) profiles 기록. 실패 시 방금 만든 Auth 사용자를 되돌려 고아 계정을 남기지 않는다.
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    role,
    status: "ACTIVE",
    created_by: me.id,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false,
      message: `권한 정보 저장 실패(계정 롤백됨): ${profileErr.message}`,
    };
  }

  // 5) 목록 갱신.
  revalidatePath("/admin");
  return { ok: true, message: `${email} 계정을 ${role} 권한으로 만들었어요.` };
}

// ---------------------------------------------------------------------------
// 계정 관리(권한 변경 / 비활성화·활성화 / 삭제) — 단일 액션.
//   지침 2-5(최고권한자 보호)를 서버 사이드에서 강제한다. 클라이언트 UI 숨김에
//   의존하지 않고, 여기서 대상 프로필을 다시 조회하여 검증한 뒤에만 수행한다.
// ---------------------------------------------------------------------------
const manageSchema = z.object({
  op: z.enum(["role", "status", "delete"]),
  id: z.string().uuid("대상 계정 식별자가 올바르지 않아요."),
});

export async function manageAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // 1) 호출자 권한 검증.
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  // 2) 공통 입력 검증.
  const base = manageSchema.safeParse({
    op: String(formData.get("op") ?? ""),
    id: String(formData.get("id") ?? ""),
  });
  if (!base.success) {
    return { ok: false, message: base.error.issues[0]?.message ?? "요청이 올바르지 않아요." };
  }
  const { op, id } = base.data;

  // 3) 대상 프로필 조회(권한 검증 후 service_role).
  const target = await getProfileByIdAsService(id);
  if (!target) return { ok: false, message: "대상 계정을 찾을 수 없어요." };

  // 4) 최고권한자 보호(지침 2-5): SUPER 계정은 권한변경·비활성화·삭제 모두 차단.
  //    관리자뿐 아니라 누구의 시도든 SUPER 대상은 이 경로로 변경할 수 없다.
  if (target.role === "SUPER") {
    return { ok: false, message: "최고권한자 계정은 변경·비활성화·삭제할 수 없어요." };
  }

  // 5) 자기 자신에 대한 파괴적 조작 차단(잠금/권한상실 방지).
  if (target.id === me.id) {
    return { ok: false, message: "본인 계정의 권한·상태·삭제는 이 화면에서 바꿀 수 없어요." };
  }

  const admin = createServiceRoleSupabase();

  if (op === "role") {
    // 권한 등급 변경: USER/ADMIN 만 허용(SUPER 승격 불가 — 지침 2-3-3).
    const roleParsed = z
      .enum(["USER", "ADMIN"])
      .safeParse(String(formData.get("role") ?? ""));
    if (!roleParsed.success) {
      return { ok: false, message: "권한 등급은 USER 또는 ADMIN 만 지정할 수 있어요." };
    }
    const newRole = roleParsed.data;
    if (newRole === target.role) {
      return { ok: true, message: `이미 ${newRole} 권한이에요.` };
    }
    const { error } = await admin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);
    if (error) return { ok: false, message: `권한 변경 실패: ${error.message}` };
    revalidatePath("/admin");
    return { ok: true, message: `${target.email} 권한을 ${newRole} 로 바꿨어요.` };
  }

  if (op === "status") {
    const statusParsed = z
      .enum(["ACTIVE", "DISABLED"])
      .safeParse(String(formData.get("next_status") ?? ""));
    if (!statusParsed.success) {
      return { ok: false, message: "상태 값이 올바르지 않아요." };
    }
    const newStatus = statusParsed.data;
    if (newStatus === target.status) {
      return { ok: true, message: `이미 ${newStatus} 상태예요.` };
    }
    const { error } = await admin
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) return { ok: false, message: `상태 변경 실패: ${error.message}` };
    revalidatePath("/admin");
    const label = newStatus === "ACTIVE" ? "활성화" : "비활성화";
    return { ok: true, message: `${target.email} 계정을 ${label}했어요.` };
  }

  // op === "delete"
  // 이 계정이 만든 다른 계정의 created_by 참조를 먼저 끊어(NULL) FK 제약으로 인한
  // 삭제 차단을 방지한다. (auth.users 삭제 시 본인 profiles 행은 ON DELETE CASCADE.)
  const { error: detachErr } = await admin
    .from("profiles")
    .update({ created_by: null })
    .eq("created_by", id);
  if (detachErr) {
    return { ok: false, message: `삭제 준비 실패: ${detachErr.message}` };
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(id);
  if (delErr) return { ok: false, message: `삭제 실패: ${delErr.message}` };
  revalidatePath("/admin");
  return { ok: true, message: `${target.email} 계정을 삭제했어요.` };
}
