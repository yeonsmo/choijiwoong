import { NextResponse } from "next/server";
import { getCurrentProfile, roleAtLeast } from "@/lib/auth";
import { getUpdateStatus } from "@/lib/laws";

/**
 * 91일 업데이트 카운터 상태(지침 3-3).
 *   - 로그인한 사용자에게만 응답한다.
 *   - canUpdate: ADMIN 이상만 실제 재수집을 할 수 있으므로, 안내 팝업도 이들에게만
 *     의미가 있다. USER 에게는 dueForUpdate 를 노출하되 canUpdate=false 로 둔다.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const status = await getUpdateStatus();
  const canUpdate = roleAtLeast(profile.role, "ADMIN");

  return NextResponse.json({
    authenticated: true,
    canUpdate,
    everCollected: status.everCollected,
    dueForUpdate: status.dueForUpdate,
    daysSince: status.daysSince,
    lastCollectedAt: status.lastCollectedAt,
    lastCount: status.lastCount,
  });
}
