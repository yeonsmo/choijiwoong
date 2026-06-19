import Link from "next/link";
import { ArrowLeft, Webhook } from "lucide-react";
import { requireRole, AuthError } from "@/lib/auth";
import { listTokens } from "@/lib/tokens";
import SignOutButton from "@/app/_components/SignOutButton";
import TokenManager from "./_components/TokenManager";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) {
      return (
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "var(--sp-10) var(--sp-6)" }}>
          <p className="t-body">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  const tokens = await listTokens();

  return (
    <main
      style={{
        maxWidth: 760,
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
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: "var(--accent-grad)", display: "grid", placeItems: "center", color: "#fff", boxShadow: "var(--shadow-1)" }}>
          <Webhook size={22} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-overline">관리자</div>
          <div className="t-h3" style={{ marginTop: 2 }}>외부 API 토큰</div>
        </div>
        <SignOutButton />
      </header>

      <div>
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

      <TokenManager tokens={tokens} />
    </main>
  );
}
