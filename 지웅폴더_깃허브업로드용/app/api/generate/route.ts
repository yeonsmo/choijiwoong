import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { generateCopy } from "@/lib/generation/copy";
import { generateImage } from "@/lib/generation/image";
import { generateVideo } from "@/lib/generation/video";

/**
 * 콘텐츠 생성(지침 5): 출력 유형(copy/image/video)별로 해당 키가 있을 때만 동작.
 *   결과는 generations 에 기록한다. 생성 후 재검증(지침 6)은 별도 순환 워크플로우로 연결.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  outputType: z.enum(["copy", "image", "video"]),
  brief: z.string().min(1).max(4000),
});

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
    return NextResponse.json({ ok: false, message: "요청이 올바르지 않아요." }, { status: 400 });
  }
  const { outputType, brief } = parsed.data;

  try {
    const admin = createServiceRoleSupabase();

    if (outputType === "copy") {
      const r = await generateCopy(brief);
      await record(admin, me.id, "copy", r.provider, brief, { text: r.text, trendUsed: r.trendUsed }, null);
      return NextResponse.json({ ok: true, outputType, provider: r.provider, text: r.text, trendUsed: r.trendUsed });
    }

    if (outputType === "image") {
      const r = await generateImage(brief, me.id);
      await record(admin, me.id, "image", r.provider, brief, { path: r.path }, r.path);
      return NextResponse.json({ ok: true, outputType, provider: r.provider, assetUrl: r.assetUrl, path: r.path });
    }

    // video
    const r = await generateVideo(brief);
    await record(admin, me.id, "video", r.provider, brief, { status: r.status, detail: r.detail }, null);
    return NextResponse.json({ ok: true, outputType, provider: r.provider, status: r.status, detail: r.detail });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

async function record(
  admin: ReturnType<typeof createServiceRoleSupabase>,
  userId: string,
  outputType: string,
  provider: string,
  prompt: string,
  result: unknown,
  assetPath: string | null,
): Promise<void> {
  const { error } = await admin.from("generations").insert({
    created_by: userId,
    output_type: outputType,
    provider,
    prompt,
    result,
    asset_url: assetPath,
  });
  if (error) console.error("[generate] 기록 실패:", error.message);
}
