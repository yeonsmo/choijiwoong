"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { issueToken, revokeToken } from "@/lib/tokens";

/** 토큰 발급 결과: 평문 토큰은 1회만 노출(이후 조회 불가). */
export interface TokenActionResult {
  ok: boolean;
  message: string;
  /** 발급 직후 1회 노출되는 평문 토큰. */
  token?: string;
}

const issueSchema = z.object({
  name: z.string().min(1, "토큰 이름을 입력해 주세요.").max(80),
});

export async function issueTokenAction(
  _prev: TokenActionResult | null,
  formData: FormData,
): Promise<TokenActionResult> {
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }

  const parsed = issueSchema.safeParse({ name: String(formData.get("name") ?? "").trim() });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  try {
    const { token } = await issueToken(parsed.data.name, ["analyze"], me.id);
    revalidatePath("/admin/tokens");
    return {
      ok: true,
      message: "토큰을 발급했어요. 지금 한 번만 표시되니 안전한 곳에 복사해 두세요.",
      token,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const revokeSchema = z.object({ id: z.coerce.number().int().positive() });

export async function revokeTokenAction(
  _prev: TokenActionResult | null,
  formData: FormData,
): Promise<TokenActionResult> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    throw e;
  }
  const parsed = revokeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "대상 토큰이 올바르지 않아요." };

  try {
    await revokeToken(parsed.data.id);
    revalidatePath("/admin/tokens");
    return { ok: true, message: "토큰을 폐기했어요." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
