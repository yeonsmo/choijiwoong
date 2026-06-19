import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, AuthError } from "@/lib/auth";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { downloadAsBase64 } from "@/lib/storage";
import { runAnalysis } from "@/lib/analysis/engine";

/**
 * 광고 콘텐츠 분석(지침 4-2, 4-3).
 *   - 업로드된 파일 경로(Storage)를 받아 서버가 다운로드 → 분석 엔진 실행.
 *   - 키 1개=단일, 2개+=교차검증(엔진이 자동 판정).
 *   - 결과를 analyses 에 기록(순환 워크플로우/이력용).
 *   - 분석은 외부 모델 호출을 포함하므로 실행시간 상한을 늘린다.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().min(1),
  sourceKind: z.enum(["image", "video"]),
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
  const { path, sourceKind } = parsed.data;

  // 경로 격리: 본인 폴더(userId/...)만 분석 허용.
  if (!path.startsWith(`${me.id}/`)) {
    return NextResponse.json({ ok: false, message: "접근할 수 없는 파일이에요." }, { status: 403 });
  }

  try {
    const { base64, mimeType } = await downloadAsBase64(path);
    const result = await runAnalysis([{ base64, mimeType }]);

    // 결과 기록(실패해도 분석 결과는 반환).
    const admin = createServiceRoleSupabase();
    await admin
      .from("analyses")
      .insert({
        created_by: me.id,
        source_kind: sourceKind,
        source_url: path,
        mode: result.mode,
        verdict: result.final.verdict,
        confidence: result.final.confidence,
        result,
      })
      .then(({ error }) => {
        if (error) console.error("[analyze] 기록 실패:", error.message);
      });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // 오류 원문 그대로(지침 9-4).
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
