"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      // 오류 원문 표시(임의 복구 시도하지 않음).
      setError(error.message);
      return;
    }
    const redirect = params.get("redirect") || "/";
    router.replace(redirect);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--sp-3)" }}>
      <label style={fieldStyle}>
        <span className="t-label">이메일</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          style={inputStyle}
          placeholder="name@company.com"
        />
      </label>
      <label style={fieldStyle}>
        <span className="t-label">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={inputStyle}
          placeholder="비밀번호를 입력해요"
        />
      </label>
      {error && (
        <p
          role="alert"
          style={{
            color: "var(--danger)",
            background: "var(--danger-wash)",
            borderRadius: "var(--r-sm)",
            padding: "var(--sp-2) var(--sp-3)",
            fontSize: "var(--text-sm)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="pressable"
        style={buttonStyle}
      >
        <LogIn size={16} strokeWidth={2} />
        {loading ? "확인하고 있어요..." : "로그인"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-6)",
      }}
    >
      <div
        className="glass glass--chrome"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: "var(--sp-8)",
          borderRadius: "var(--r-2xl)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--r-md)",
            background: "var(--accent-grad)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            boxShadow: "var(--shadow-2)",
            marginBottom: "var(--sp-4)",
          }}
        >
          <ShieldCheck size={26} strokeWidth={2} />
        </div>
        <h1 className="t-h1" style={{ margin: 0 }}>
          보험광고 법령 검증
        </h1>
        <p
          className="t-body"
          style={{ marginTop: "var(--sp-1)", marginBottom: "var(--sp-6)" }}
        >
          오신 것을 환영해요. 로그인하고 시작해볼까요?
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p
          className="t-caption"
          style={{ marginTop: "var(--sp-6)", marginBottom: 0 }}
        >
          계정은 관리자가 만들어 드려요. 공개 회원가입은 제공하지 않아요.
        </p>
      </div>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "var(--sp-1)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  color: "var(--fg-1)",
  fontSize: "var(--text-body)",
  fontFamily: "var(--font-sans)",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sp-2)",
  background: "var(--accent)",
  color: "var(--fg-on-accent)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "11px 14px",
  fontSize: "var(--text-body)",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "var(--sp-1)",
  boxShadow: "var(--shadow-1)",
};
