"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { createAccount, type ActionResult } from "@/app/admin/actions";

/**
 * 신규 계정 생성 폼.
 *   서버 액션(createAccount)을 useActionState 로 호출한다.
 *   SUPER 등급은 선택지에 없다(지침 2-3-3: 신규 생성으로 SUPER 부여 불가).
 *   ADMIN 등급 생성 권한은 서버에서 ADMIN 이상으로 강제된다.
 */
export default function CreateAccountForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createAccount,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 성공 시 입력값 초기화(목록은 서버에서 revalidate 됨).
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="glass"
      style={{
        borderRadius: "var(--r-xl)",
        padding: "var(--sp-5)",
        display: "grid",
        gap: "var(--sp-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--r-sm)",
            background: "var(--accent-wash)",
            color: "var(--accent-strong)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <UserPlus size={18} strokeWidth={2} />
        </div>
        <div className="t-h3">신규 계정 생성</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--sp-3)",
        }}
      >
        <label style={fieldStyle}>
          <span className="t-label">이메일</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="name@company.com"
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="t-label">초기 비밀번호</span>
          <input
            type="text"
            name="password"
            required
            minLength={8}
            autoComplete="off"
            placeholder="8자 이상"
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="t-label">권한 등급</span>
          <select name="role" defaultValue="USER" style={inputStyle}>
            <option value="USER">일반 사용자 (USER)</option>
            <option value="ADMIN">관리자 (ADMIN)</option>
          </select>
        </label>
      </div>

      {state && (
        <p
          role="alert"
          style={{
            margin: 0,
            color: state.ok ? "var(--ok)" : "var(--danger)",
            background: state.ok ? "var(--ok-wash)" : "var(--danger-wash)",
            borderRadius: "var(--r-sm)",
            padding: "var(--sp-2) var(--sp-3)",
            fontSize: "var(--text-sm)",
          }}
        >
          {state.message}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <button
          type="submit"
          disabled={pending}
          className="pressable"
          style={buttonStyle}
        >
          <UserPlus size={16} strokeWidth={2} />
          {pending ? "만들고 있어요..." : "계정 만들기"}
        </button>
        <span className="t-caption" style={{ margin: 0, color: "var(--fg-3)" }}>
          최고권한자(SUPER)는 이 화면에서 만들 수 없어요.
        </span>
      </div>
    </form>
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
  width: "100%",
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
  padding: "11px 16px",
  fontSize: "var(--text-body)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--shadow-1)",
};
