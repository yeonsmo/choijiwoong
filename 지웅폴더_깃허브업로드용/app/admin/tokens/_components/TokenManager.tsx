"use client";

import { useActionState, useState } from "react";
import { KeyRound, Copy, Check, Trash2 } from "lucide-react";
import {
  issueTokenAction,
  revokeTokenAction,
  type TokenActionResult,
} from "@/app/admin/tokens/actions";
import type { ApiTokenRow } from "@/lib/tokens";

/**
 * 외부 API 토큰 관리(지침 7): 발급/조회/폐기.
 *   발급 직후 평문 토큰을 1회만 표시하고 복사를 제공한다(이후 조회 불가).
 */
export default function TokenManager({ tokens }: { tokens: ApiTokenRow[] }) {
  const [state, formAction, pending] = useActionState<TokenActionResult | null, FormData>(
    issueTokenAction,
    null,
  );

  return (
    <div style={{ display: "grid", gap: "var(--sp-4)" }}>
      {/* 발급 폼 */}
      <form action={formAction} className="glass" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <div aria-hidden style={iconBox}>
            <KeyRound size={18} strokeWidth={2} />
          </div>
          <div className="t-h3">새 API 토큰 발급</div>
        </div>
        <label style={{ display: "grid", gap: "var(--sp-1)" }}>
          <span className="t-label">토큰 이름(용도 식별용)</span>
          <input type="text" name="name" placeholder="예: 외부 검수 시스템" style={input} required maxLength={80} />
        </label>
        <div>
          <button type="submit" disabled={pending} className="pressable" style={primaryBtn}>
            {pending ? "발급 중..." : "토큰 발급"}
          </button>
        </div>

        {state && (
          <div style={noticeStyle(state.ok)}>
            <div>{state.message}</div>
            {state.token && <TokenReveal token={state.token} />}
          </div>
        )}
      </form>

      {/* 목록 */}
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        {tokens.length === 0 && (
          <p className="t-caption" style={{ color: "var(--fg-3)", margin: 0 }}>발급된 토큰이 없어요.</p>
        )}
        {tokens.map((t) => (
          <TokenRow key={t.id} t={t} />
        ))}
      </div>

      <p className="t-caption" style={{ color: "var(--fg-3)", margin: 0 }}>
        호출 예시: POST /api/v1/analyze · 헤더 Authorization: Bearer &lt;토큰&gt; · 본문 {"{ imageUrl }"} 또는 {"{ imageBase64, mimeType }"}
      </p>
    </div>
  );
}

function TokenReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", marginTop: "var(--sp-2)" }}>
      <code
        style={{
          flex: 1,
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          padding: "8px 10px",
          fontSize: "var(--text-sm)",
          wordBreak: "break-all",
        }}
      >
        {token}
      </code>
      <button
        type="button"
        className="pressable"
        style={ghostBtn}
        onClick={async () => {
          await navigator.clipboard.writeText(token);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function TokenRow({ t }: { t: ApiTokenRow }) {
  const [state, action, pending] = useActionState<TokenActionResult | null, FormData>(
    revokeTokenAction,
    null,
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        flexWrap: "wrap",
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        padding: "var(--sp-2) var(--sp-3)",
        opacity: t.revoked ? 0.55 : 1,
      }}
    >
      <span className="t-body" style={{ fontWeight: 500 }}>{t.name}</span>
      <code className="t-caption" style={{ color: "var(--fg-3)" }}>{t.token_prefix}…</code>
      <span className="t-caption" style={{ color: "var(--fg-3)" }}>
        scope: {t.scope.join(", ")} · {t.created_at.slice(0, 10)}
        {t.last_used_at ? ` · 최근사용 ${t.last_used_at.slice(0, 10)}` : ""}
      </span>
      {t.revoked && <span className="t-caption" style={{ color: "var(--danger)" }}>폐기됨</span>}
      <div style={{ flex: 1 }} />
      {state && !state.ok && <span className="t-caption" style={{ color: "var(--danger)" }}>{state.message}</span>}
      {!t.revoked && (
        <form action={action}>
          <input type="hidden" name="id" value={t.id} />
          <button type="submit" disabled={pending} className="pressable" style={dangerBtn}>
            <Trash2 size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            폐기
          </button>
        </form>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  borderRadius: "var(--r-xl)",
  padding: "var(--sp-5)",
  display: "grid",
  gap: "var(--sp-3)",
};
const iconBox: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "var(--r-sm)",
  background: "var(--accent-wash)",
  color: "var(--accent-strong)",
  display: "grid",
  placeItems: "center",
};
const input: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  color: "var(--fg-1)",
  fontSize: "var(--text-body)",
  fontFamily: "var(--font-sans)",
  width: "100%",
};
const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
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
const ghostBtn: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "8px 12px",
  color: "var(--fg-2)",
  cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  background: "var(--danger-wash)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "6px 12px",
  color: "var(--danger)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};
function noticeStyle(ok: boolean): React.CSSProperties {
  return {
    color: ok ? "var(--ok)" : "var(--danger)",
    background: ok ? "var(--ok-wash)" : "var(--danger-wash)",
    borderRadius: "var(--r-sm)",
    padding: "var(--sp-2) var(--sp-3)",
    fontSize: "var(--text-sm)",
  };
}
