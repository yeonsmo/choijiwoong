import Link from "next/link";
import { ArrowLeft, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { requireRole, AuthError, type Profile } from "@/lib/auth";
import SignOutButton from "@/app/_components/SignOutButton";
import {
  getLawApiKeyStatus,
  getTrendConfigStatus,
} from "@/lib/settings";
import {
  LAW_CATEGORIES,
  countLawDocumentsByCategory,
  countLawDocumentsTotal,
  getUpdateStatus,
} from "@/lib/laws";
import { listAiKeysMasked } from "@/lib/ai/keys";
import LawApiKeyCard from "./_components/LawApiKeyCard";
import CollectionCard from "./_components/CollectionCard";
import AiKeysManager from "./_components/AiKeysManager";
import TrendConfigCard from "./_components/TrendConfigCard";

// 인증/권한(쿠키)에 의존하므로 정적 프리렌더 제외.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let me: Profile;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return <Forbidden message={e.message} />;
    throw e;
  }

  // 각 영역 데이터 로드. 오류는 원문 그대로 화면에 표시(지침 9-4).
  let lawStatus, trendStatus, byCategory, total, aiKeys, updateStatus;
  try {
    [lawStatus, trendStatus, byCategory, total, aiKeys, updateStatus] = await Promise.all([
      getLawApiKeyStatus(),
      getTrendConfigStatus(),
      countLawDocumentsByCategory(),
      countLawDocumentsTotal(),
      listAiKeysMasked(),
      getUpdateStatus(),
    ]);
  } catch (e) {
    return <Forbidden message={e instanceof Error ? e.message : String(e)} />;
  }

  // 법제처 키: SUPER 가 설정한 항목은 ADMIN 이 변경 불가(지침 2-5-4).
  const canManageLawKey = me.role === "SUPER" || !(lawStatus.configured && lawStatus.setBySuper);

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
          <SlidersHorizontal size={22} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-overline">관리자</div>
          <div className="t-h3" style={{ marginTop: 2 }}>시스템 설정</div>
        </div>
        <SignOutButton />
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Link
          href="/admin"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--surface-1)",
            color: "var(--fg-2)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          계정 관리로
        </Link>
      </div>

      <LawApiKeyCard status={lawStatus} canManage={canManageLawKey} />

      <CollectionCard
        total={total}
        byCategory={byCategory}
        categoryLabels={LAW_CATEGORIES}
        lastCollectedAt={updateStatus.lastCollectedAt}
        daysSince={updateStatus.daysSince}
        lawKeyConfigured={lawStatus.configured}
      />

      <AiKeysManager keys={aiKeys} />

      <TrendConfigCard status={trendStatus} />

      <p className="t-caption" style={{ textAlign: "center", margin: 0 }}>
        모든 비밀 키는 서버에서 AES-256-GCM 으로 암호화되어 저장돼요. 평문은 화면에 표시하지 않아요.
      </p>
    </main>
  );
}

function Forbidden({ message }: { message: string }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--sp-6)" }}>
      <div
        className="glass glass--chrome"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "var(--sp-8)",
          borderRadius: "var(--r-2xl)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--r-md)",
            background: "var(--danger-wash)",
            color: "var(--danger)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto var(--sp-4)",
          }}
        >
          <ShieldAlert size={26} strokeWidth={2} />
        </div>
        <h1 className="t-h2" style={{ margin: 0 }}>접근할 수 없어요</h1>
        <p className="t-body" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
          {message}
        </p>
        <Link
          href="/"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--accent)",
            color: "var(--fg-on-accent)",
            borderRadius: "var(--r-sm)",
            padding: "10px 16px",
            fontSize: "var(--text-body)",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          홈으로
        </Link>
      </div>
    </main>
  );
}
