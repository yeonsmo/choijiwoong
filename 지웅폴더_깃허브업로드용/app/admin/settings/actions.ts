"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { LAW_API_KEY, TREND_API_KEY, getSettingRow } from "@/lib/settings";
import { getProfileByIdAsService } from "@/lib/auth";
import { addAiKey, deleteAiKey, setAiKeyEnabled } from "@/lib/ai/keys";
import { isAiKind, isValidProvider } from "@/lib/ai/catalog";
import type { ActionResult } from "@/app/admin/actions";

/**
 * 법제처 API 키 저장/삭제.
 *   - ADMIN 이상만. 비밀값은 AES-256-GCM 으로 암호화하여 저장(평문 미저장).
 *   - 지침 2-5-4(최고권한자 보호): 직전에 SUPER 가 설정한 항목은 ADMIN 이 변경·삭제할 수 없다.
 *     이 판정은 서버에서 강제한다(클라이언트 UI 숨김에 의존하지 않음).
 *   - 지침 3-1-2: 입력/교체/삭제 후 재등록 가능. 삭제는 row 를 제거하여 인수자(3-4 시나리오)가
 *     본인 키를 새로 입력할 수 있게 한다.
 *   - 지침 3-1-3, 3-3: 91일 카운터와 독립. 이 액션은 카운터 값을 읽거나 쓰지 않는다.
 */

const saveSchema = z.object({
  key: z.string().min(8, "API 키는 8자 이상이어야 해요.").max(4096),
});

export async function manageLawApiKey(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // 1) 호출자 권한.
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  const op = String(formData.get("op") ?? "");
  if (op !== "save" && op !== "delete") {
    return { ok: false, message: "요청이 올바르지 않아요." };
  }

  // 2) 기존 설정 조회 + 최고권한자 보호 판정(지침 2-5-4).
  const existing = await getSettingRow(LAW_API_KEY);
  if (existing && me.role !== "SUPER") {
    const writer = existing.updated_by
      ? await getProfileByIdAsService(existing.updated_by)
      : null;
    if (writer?.role === "SUPER") {
      return {
        ok: false,
        message: "최고권한자가 설정한 항목이라 관리자는 변경·삭제할 수 없어요.",
      };
    }
  }

  const admin = createServiceRoleSupabase();

  if (op === "delete") {
    if (!existing) return { ok: true, message: "이미 설정된 키가 없어요." };
    const { error } = await admin
      .from("system_settings")
      .delete()
      .eq("key", LAW_API_KEY);
    if (error) return { ok: false, message: `키 삭제 실패: ${error.message}` };
    revalidatePath("/admin/settings");
    return { ok: true, message: "법제처 API 키를 삭제했어요. 기존 수집 데이터는 유지돼요." };
  }

  // op === "save"
  const parsed = saveSchema.safeParse({ key: String(formData.get("key") ?? "").trim() });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "키 형식을 확인해 주세요." };
  }

  const cipher = encryptSecret(parsed.data.key);
  const { error } = await admin.from("system_settings").upsert(
    {
      key: LAW_API_KEY,
      value: { cipher },
      updated_by: me.id,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, message: `키 저장 실패: ${error.message}` };

  revalidatePath("/admin/settings");
  return { ok: true, message: existing ? "법제처 API 키를 교체했어요." : "법제처 API 키를 저장했어요." };
}

// ---------------------------------------------------------------------------
// AI API 키 관리(지침 4-1): 다중 추가/삭제, 용도별 분류, 암호화 저장.
//   ADMIN 이상만. provider/kind 는 카탈로그로 검증한다.
// ---------------------------------------------------------------------------

const addAiKeySchema = z.object({
  kind: z.string(),
  provider: z.string(),
  label: z.string().max(80).optional().default(""),
  apiKey: z.string().min(8, "API 키는 8자 이상이어야 해요.").max(8192),
});

export async function addAiKeyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  const parsed = addAiKeySchema.safeParse({
    kind: String(formData.get("kind") ?? ""),
    provider: String(formData.get("provider") ?? ""),
    label: String(formData.get("label") ?? "").trim(),
    apiKey: String(formData.get("apiKey") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }
  const { kind, provider, label, apiKey } = parsed.data;

  if (!isAiKind(kind)) return { ok: false, message: "용도(kind)가 올바르지 않아요." };
  if (!isValidProvider(kind, provider)) {
    return { ok: false, message: "해당 용도에서 지원하지 않는 제공자예요." };
  }

  try {
    await addAiKey({ kind, provider, label, apiKey, createdBy: me.id });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "AI API 키를 추가했어요." };
}

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export async function deleteAiKeyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "대상 키가 올바르지 않아요." };

  try {
    await deleteAiKey(parsed.data.id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "AI API 키를 삭제했어요." };
}

export async function toggleAiKeyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "대상 키가 올바르지 않아요." };
  const enabled = String(formData.get("enabled") ?? "") === "true";

  try {
    await setAiKeyEnabled(parsed.data.id, enabled);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: enabled ? "키를 활성화했어요." : "키를 비활성화했어요." };
}

// ---------------------------------------------------------------------------
// 트렌드 API 범용 설정(지침 5-3): 엔드포인트 + 파싱규칙 + (선택)키.
// ---------------------------------------------------------------------------

const trendSchema = z.object({
  endpoint: z.string().url("엔드포인트는 URL 형식이어야 해요."),
  parseRule: z.string().max(200).optional().default(""),
  apiKey: z.string().max(8192).optional().default(""),
});

export async function saveTrendConfigAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  const op = String(formData.get("op") ?? "save");
  const admin = createServiceRoleSupabase();

  if (op === "delete") {
    const { error } = await admin
      .from("system_settings")
      .delete()
      .eq("key", TREND_API_KEY);
    if (error) return { ok: false, message: `트렌드 설정 삭제 실패: ${error.message}` };
    revalidatePath("/admin/settings");
    return { ok: true, message: "트렌드 API 설정을 삭제했어요." };
  }

  const parsed = trendSchema.safeParse({
    endpoint: String(formData.get("endpoint") ?? "").trim(),
    parseRule: String(formData.get("parseRule") ?? "").trim(),
    apiKey: String(formData.get("apiKey") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const value: { endpoint: string; parseRule?: string; cipher?: string } = {
    endpoint: parsed.data.endpoint,
  };
  if (parsed.data.parseRule) value.parseRule = parsed.data.parseRule;
  if (parsed.data.apiKey) value.cipher = encryptSecret(parsed.data.apiKey);

  const { error } = await admin.from("system_settings").upsert(
    { key: TREND_API_KEY, value, updated_by: me.id },
    { onConflict: "key" },
  );
  if (error) return { ok: false, message: `트렌드 설정 저장 실패: ${error.message}` };
  revalidatePath("/admin/settings");
  return { ok: true, message: "트렌드 API 설정을 저장했어요." };
}
