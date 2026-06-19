import type { CSSProperties } from "react";

/** 설정 화면 공용 인라인 스타일(기존 폼들과 동일 토큰 사용). */

export const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "var(--sp-1)",
};

export const inputStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  color: "var(--fg-1)",
  fontSize: "var(--text-body)",
  fontFamily: "var(--font-sans)",
  width: "100%",
};

export const primaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sp-2)",
  background: "var(--accent)",
  color: "var(--fg-on-accent)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "10px 16px",
  fontSize: "var(--text-body)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--shadow-1)",
};

export const ghostBtn: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "8px 14px",
  color: "var(--fg-2)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};

export const dangerBtn: CSSProperties = {
  background: "var(--danger-wash)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "8px 14px",
  color: "var(--danger)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};

export function noticeStyle(ok: boolean): CSSProperties {
  return {
    margin: 0,
    color: ok ? "var(--ok)" : "var(--danger)",
    background: ok ? "var(--ok-wash)" : "var(--danger-wash)",
    borderRadius: "var(--r-sm)",
    padding: "var(--sp-2) var(--sp-3)",
    fontSize: "var(--text-sm)",
    whiteSpace: "pre-wrap",
  };
}

export const cardStyle: CSSProperties = {
  borderRadius: "var(--r-xl)",
  padding: "var(--sp-5)",
  display: "grid",
  gap: "var(--sp-4)",
};
