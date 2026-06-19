import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { createSignedUpload } from "@/lib/storage";

/**
 * 업로드용 서명 URL 발급(지침 1-5: 클라이언트가 Storage 로 직접 업로드).
 *   로그인 사용자(USER 이상)면 가능. 경로는 사용자 ID 로 격리한다.
 */
export const dynamic = "force-dynamic";

const schema = z.object({ filename: z.string().min(1).max(200) });

export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("USER");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, message: e.message }, { status: 403 });
    }
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "파일명이 올바르지 않아요." }, { status: 400 });
  }

  try {
    const signed = await createSignedUpload(me.id, parsed.data.filename);
    return NextResponse.json({ ok: true, ...signed, bucket: "media" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
