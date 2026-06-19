import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearer } from "@/lib/tokens";
import { runAnalysis } from "@/lib/analysis/engine";

/**
 * 외부 시스템용 분석 엔드포인트(지침 7).
 *   - 인증: Authorization: Bearer <발급된 토큰>. scope 에 "analyze" 필요.
 *   - 입력: imageUrl(공개 접근 가능) 또는 imageBase64 + mimeType.
 *   - 세션 불필요(기계 호출). 앱에 등록된 AI 키로 분석한다.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

export async function POST(req: Request) {
  const token = await verifyBearer(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ ok: false, error: "유효하지 않은 토큰입니다." }, { status: 401 });
  }
  if (!token.scope.includes("analyze")) {
    return NextResponse.json({ ok: false, error: "이 토큰에는 analyze 권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  let base64: string;
  let mimeType: string;
  try {
    if (parsed.data.imageBase64) {
      base64 = parsed.data.imageBase64;
      mimeType = parsed.data.mimeType ?? "image/png";
    } else if (parsed.data.imageUrl) {
      const r = await fetch(parsed.data.imageUrl, { cache: "no-store" });
      if (!r.ok) throw new Error(`이미지 다운로드 실패 HTTP ${r.status}`);
      mimeType = r.headers.get("content-type") || "image/png";
      base64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    } else {
      return NextResponse.json(
        { ok: false, error: "imageUrl 또는 imageBase64 중 하나가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await runAnalysis([{ base64, mimeType }]);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
