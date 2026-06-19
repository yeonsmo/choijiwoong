import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SignOutButton from "@/app/_components/SignOutButton";

/** 기능 페이지 공용 헤더(홈 링크 + 제목 + 로그아웃). */
export default function PageHeader({
  icon,
  overline,
  title,
}: {
  icon: React.ReactNode;
  overline: string;
  title: string;
}) {
  return (
    <>
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
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-overline">{overline}</div>
          <div className="t-h3" style={{ marginTop: 2 }}>{title}</div>
        </div>
        <SignOutButton />
      </header>

      <div>
        <Link
          href="/"
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
          홈으로
        </Link>
      </div>
    </>
  );
}
