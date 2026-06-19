import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { getLawApiKeyPlaintext } from "@/lib/settings";
import { collectAllLaws } from "@/lib/moleg";
import { upsertLawDocuments, recordCollection } from "@/lib/laws";

/**
 * 법령 데이터 수집 실행(지침 3-1, 3-2, 3-3-4).
 *   - ADMIN 이상만(서버 강제).
 *   - 설정 메뉴에 저장된 법제처 API 키(평문 복호화)를 OC 로 사용한다.
 *   - 키가 없으면 수집 불가(지침 3-4: 키 삭제 상태에서는 업데이트만 막히고 기존
 *     데이터로 분석은 계속 동작). 이 경로는 "업데이트"이므로 키를 요구한다.
 *   - 수집은 91일 카운터와 독립적으로 메타에 기록된다.
 *
 * 수집은 다수의 외부 호출을 포함하므로 실행시간 상한을 늘린다(Vercel).
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, message: e.message }, { status: 403 });
    }
    throw e;
  }

  const oc = await getLawApiKeyPlaintext();
  if (!oc) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "법제처 API 키가 설정되어 있지 않습니다. 설정 메뉴에서 키를 등록한 뒤 업데이트하세요. (기존 수집 데이터로 분석은 계속 동작합니다)",
      },
      { status: 400 },
    );
  }

  try {
    const { collected, log } = await collectAllLaws(oc);
    const count = await upsertLawDocuments(collected);
    const status = `조문 ${count}건 적재. ${log.join(" | ")}`;
    await recordCollection(count, status);
    return NextResponse.json({ ok: true, count, log });
  } catch (e) {
    // 오류 원문 그대로 표시(지침 9-4).
    const message = e instanceof Error ? e.message : String(e);
    await recordCollection(0, `실패: ${message}`).catch(() => {});
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
