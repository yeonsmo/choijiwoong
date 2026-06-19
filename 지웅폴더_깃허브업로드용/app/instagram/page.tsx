import { Share2, Lock } from "lucide-react";
import { requireRole, AuthError } from "@/lib/auth";
import { isInstagramEnabled } from "@/lib/instagram";
import PageHeader from "@/app/_components/PageHeader";

export const dynamic = "force-dynamic";

/**
 * 인스타그램 자동 업로드 메뉴(지침 8-2).
 *   - 백엔드 함수(lib/instagram.ts)는 완전히 구현되어 있으나 동결 상태.
 *   - 동결 시 "현재 구현되지 않은 기능입니다" 안내 + Meta 외부 제약을 표시한다.
 *   - 활성화(INSTAGRAM_ENABLED=true + 자격증명)되면 활성 상태로 표시된다.
 */
export default async function InstagramPage() {
  try {
    await requireRole("USER");
  } catch (e) {
    if (e instanceof AuthError) {
      return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--sp-10) var(--sp-6)" }}>
          <p className="t-body">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  const enabled = isInstagramEnabled();

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--sp-10) var(--sp-6)",
        display: "grid",
        gap: "var(--sp-6)",
      }}
    >
      <PageHeader
        icon={<Share2 size={22} strokeWidth={2} />}
        overline="확장 모듈"
        title="인스타그램 자동 업로드"
      />

      <div className="glass" style={{ borderRadius: "var(--r-2xl)", padding: "var(--sp-8)", textAlign: "center", display: "grid", gap: "var(--sp-3)", justifyItems: "center" }}>
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--r-md)",
            background: enabled ? "var(--ok-wash)" : "var(--surface-2)",
            color: enabled ? "var(--ok)" : "var(--fg-3)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {enabled ? <Share2 size={28} /> : <Lock size={26} />}
        </div>

        {enabled ? (
          <>
            <h2 className="t-h2" style={{ margin: 0 }}>활성화되어 있어요</h2>
            <p className="t-body" style={{ margin: 0 }}>
              자격증명이 등록되어 자동 업로드 기능을 사용할 수 있어요.
            </p>
          </>
        ) : (
          <>
            <h2 className="t-h2" style={{ margin: 0 }}>현재 구현되지 않은 기능입니다</h2>
            <p className="t-body" style={{ margin: 0 }}>
              백엔드 기능은 완성되어 있으며 동결 상태입니다. 환경변수에 Meta 자격증명을 등록하고
              토글을 활성화하면 즉시 동작합니다.
            </p>
          </>
        )}
      </div>

      <div className="glass" style={{ borderRadius: "var(--r-lg)", padding: "var(--sp-5)" }}>
        <div className="t-overline" style={{ color: "var(--fg-3)" }}>외부 제약(Meta)</div>
        <ul className="t-body" style={{ margin: "var(--sp-2) 0 0", paddingLeft: "1.2em" }}>
          <li>비즈니스 또는 크리에이터 계정이 필요합니다.</li>
          <li>Facebook 페이지 연동이 필요합니다.</li>
          <li>Meta 앱 심사(App Review) 통과 및 콘텐츠 게시 권한이 필요합니다.</li>
        </ul>
        <p className="t-caption" style={{ color: "var(--fg-3)", marginTop: "var(--sp-3)", marginBottom: 0 }}>
          활성화 방법: .env 의 INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID 등을 채우고
          INSTAGRAM_ENABLED=true 로 설정하세요.
        </p>
      </div>
    </main>
  );
}
