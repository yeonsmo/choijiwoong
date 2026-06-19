"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * 91일 업데이트 안내 팝업(지침 3-3).
 *   - 접속(마운트) 시 /api/laws/status 로 경과일을 확인한다.
 *   - 91일 경과(dueForUpdate)면 팝업을 띄운다.
 *   - "예": ADMIN 이상은 /api/laws/collect 로 재수집한다. "아니요": 닫는다.
 *   - 이 동작은 법제처 키 관리와 독립이다(카운터는 키 변경에 영향받지 않음).
 *   - 한 세션에서 한 번 닫으면 다시 뜨지 않는다(sessionStorage).
 */

interface StatusResponse {
  authenticated: boolean;
  canUpdate?: boolean;
  dueForUpdate?: boolean;
  daysSince?: number | null;
}

const DISMISS_KEY = "law-update-dismissed";

export default function UpdateLawPopup() {
  const [open, setOpen] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
      try {
        const res = await fetch("/api/laws/status", { cache: "no-store" });
        if (!res.ok) return; // 미인증(로그인 페이지 등)에서는 조용히 무시.
        const data: StatusResponse = await res.json();
        if (!alive) return;
        if (data.authenticated && data.dueForUpdate) {
          setCanUpdate(Boolean(data.canUpdate));
          setDays(data.daysSince ?? null);
          setOpen(true);
        }
      } catch {
        // 상태 조회 실패는 팝업을 띄우지 않는 것으로 처리(임의 복구 안 함).
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  async function update() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/laws/collect", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(`업데이트 완료: 조문 ${data.count}건을 갱신했어요.`);
        sessionStorage.setItem(DISMISS_KEY, "1");
      } else {
        setResult(data.message ?? "업데이트에 실패했어요.");
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 20, 30, 0.32)",
        backdropFilter: "blur(2px)",
        padding: "var(--sp-6)",
      }}
    >
      <div
        className="glass glass--chrome"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "var(--sp-6)",
          borderRadius: "var(--r-2xl)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-sm)",
              background: "var(--accent-wash)",
              color: "var(--accent-strong)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <RefreshCw size={18} strokeWidth={2} />
          </div>
          <h2 className="t-h3" style={{ flex: 1, margin: 0 }}>
            데이터를 업데이트 하시겠습니까?
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="닫기"
            className="pressable"
            style={iconBtn}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <p className="t-body" style={{ marginTop: "var(--sp-3)" }}>
          {days != null
            ? `마지막 법령 수집 후 ${days}일이 지났어요.`
            : "법령 데이터 업데이트 시점이 되었어요."}
          {!canUpdate &&
            " 업데이트는 관리자가 진행할 수 있어요. 기존 데이터로 검증은 계속 사용할 수 있어요."}
        </p>

        {result && (
          <p
            role="status"
            className="t-body"
            style={{
              marginTop: "var(--sp-2)",
              background: "var(--surface-1)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-sm)",
              padding: "var(--sp-2) var(--sp-3)",
              whiteSpace: "pre-wrap",
            }}
          >
            {result}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "var(--sp-2)",
            justifyContent: "flex-end",
            marginTop: "var(--sp-5)",
          }}
        >
          <button type="button" onClick={dismiss} className="pressable" style={ghostBtn}>
            아니요
          </button>
          {canUpdate && (
            <button
              type="button"
              onClick={update}
              disabled={busy}
              className="pressable"
              style={primaryBtn}
            >
              {busy ? "업데이트 중..." : "예, 업데이트"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  color: "var(--fg-2)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "9px 16px",
  color: "var(--fg-2)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-2)",
  background: "var(--accent)",
  color: "var(--fg-on-accent)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "9px 16px",
  fontSize: "var(--text-body)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--shadow-1)",
};
