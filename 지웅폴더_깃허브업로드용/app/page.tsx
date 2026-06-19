import Link from "next/link";
import {
  ScanSearch,
  Sparkles,
  RefreshCw,
  Settings,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { getCurrentProfile, type Role } from "@/lib/auth";
import GlassCard from "@/app/_components/GlassCard";
import SignOutButton from "@/app/_components/SignOutButton";

// 인증/쿠키에 의존하므로 정적 프리렌더 대상에서 제외(요청 시 렌더).
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  USER: "일반 사용자",
  ADMIN: "관리자",
  SUPER: "최고권한자",
};

export default async function Home() {
  const profile = await getCurrentProfile();
  const roleLabel = profile ? ROLE_LABEL[profile.role] : null;
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER";

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--sp-10) var(--sp-6)",
        display: "grid",
        gap: "var(--sp-6)",
      }}
    >
      {/* 헤더 */}
      <header
        className="glass glass--chrome"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-4) var(--sp-5)",
          borderRadius: "var(--r-xl)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-sm)",
            background: "var(--accent-grad)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <ShieldCheck size={22} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-overline">보험광고 법령 검증</div>
          <div className="t-h3" style={{ marginTop: 2 }}>
            {profile
              ? `${profile.email} 님, 오신 것을 환영해요`
              : "환영해요"}
          </div>
        </div>
        {roleLabel && (
          <span
            className="t-label"
            style={{
              background: "var(--accent-wash)",
              color: "var(--accent-strong)",
              borderRadius: "var(--r-pill)",
              padding: "4px 12px",
            }}
          >
            {roleLabel}
          </span>
        )}
        <SignOutButton />
      </header>

      {/* 기능 카드 그리드 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        <FeatureCard
          icon={<ScanSearch size={22} strokeWidth={2} />}
          title="광고 검증"
          desc="사진·영상을 올리면 법령과 대조해 위반 여부를 판별해요."
          href="/verify"
          status="시작"
        />
        <FeatureCard
          icon={<Sparkles size={22} strokeWidth={2} />}
          title="콘텐츠 생성"
          desc="법령을 지키는 카피·이미지·영상을 만들어요."
          href="/generate"
          status="시작"
        />
        <FeatureCard
          icon={<RefreshCw size={22} strokeWidth={2} />}
          title="재검증 순환"
          desc="만든 콘텐츠를 바로 검증 엔진으로 다시 돌려봐요."
          href="/generate"
          status="생성에서"
        />
        <FeatureCard
          icon={<Share2 size={22} strokeWidth={2} />}
          title="인스타 자동 업로드"
          desc="확장 모듈. 현재 동결 상태예요."
          href="/instagram"
          status="동결"
        />
        {isAdmin && (
          <FeatureCard
            icon={<Settings size={22} strokeWidth={2} />}
            title="관리자"
            desc="계정과 시스템 설정을 관리해요."
            href="/admin"
            status="이동"
          />
        )}
      </section>

      <p className="t-caption" style={{ textAlign: "center", margin: 0 }}>
        인프라·인증 단계까지 적용했어요. 기능 화면은 다음 단계에서 열려요.
      </p>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  status,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  status: string;
  href?: string;
}) {
  const inner = (
    <GlassCard
      style={{
        padding: "var(--sp-5)",
        display: "grid",
        gap: "var(--sp-3)",
        height: "100%",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-sm)",
          background: "var(--accent-wash)",
          color: "var(--accent-strong)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div className="t-h3">{title}</div>
        <p className="t-body" style={{ margin: "4px 0 0" }}>
          {desc}
        </p>
      </div>
      <span className="t-overline" style={{ color: "var(--accent-strong)" }}>
        {status}
      </span>
    </GlassCard>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: "block", height: "100%" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
