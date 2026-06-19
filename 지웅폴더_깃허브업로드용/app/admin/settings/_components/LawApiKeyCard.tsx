"use client";

import { useActionState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { manageLawApiKey } from "@/app/admin/settings/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { LawApiKeyStatus } from "@/lib/settings";
import {
  fieldStyle,
  inputStyle,
  primaryBtn,
  dangerBtn,
  noticeStyle,
  cardStyle,
} from "./ui";

/**
 * 법제처 API 키 관리 카드(지침 3-1).
 *   - 입력/교체/삭제. 평문은 표시하지 않고 마스킹만 보여준다.
 *   - 91일 카운터와 독립(이 카드는 카운터를 건드리지 않는다).
 *   - SUPER 가 설정한 키는 ADMIN 이 변경/삭제 불가(서버에서 강제, 여기선 안내만).
 */
export default function LawApiKeyCard({
  status,
  canManage,
}: {
  status: LawApiKeyStatus;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    manageLawApiKey,
    null,
  );

  return (
    <section className="glass" style={cardStyle}>
      <Header
        icon={<KeyRound size={18} strokeWidth={2} />}
        title="법제처 API 키"
        desc="국가법령정보 공동활용 OPEN API 키(OC). 입력 후 법령 데이터를 수집해요."
      />

      <div className="t-body" style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
        <span className="t-label" style={{ color: "var(--fg-3)" }}>현재 상태</span>
        {status.configured ? (
          <span style={{ color: "var(--ok)" }}>설정됨 ({status.masked})</span>
        ) : (
          <span style={{ color: "var(--fg-3)" }}>미설정</span>
        )}
      </div>

      {!canManage && (
        <p style={noticeStyle(false)}>
          최고권한자가 설정한 항목이라 관리자는 변경·삭제할 수 없어요. (서버에서 강제)
        </p>
      )}

      {canManage && (
        <>
          <form action={formAction} style={{ display: "grid", gap: "var(--sp-3)" }}>
            <input type="hidden" name="op" value="save" />
            <label style={fieldStyle}>
              <span className="t-label">API 키(OC) 입력 / 교체</span>
              <input
                type="password"
                name="key"
                autoComplete="off"
                placeholder="법제처에서 발급받은 OC 값"
                style={inputStyle}
                minLength={8}
                required
              />
            </label>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <button type="submit" disabled={pending} className="pressable" style={primaryBtn}>
                {pending ? "저장 중..." : status.configured ? "키 교체" : "키 저장"}
              </button>
            </div>
          </form>

          {status.configured && (
            <form action={formAction}>
              <input type="hidden" name="op" value="delete" />
              <button type="submit" disabled={pending} className="pressable" style={dangerBtn}>
                <Trash2 size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                키 삭제 (기존 수집 데이터는 유지)
              </button>
            </form>
          )}
        </>
      )}

      {state && <p style={noticeStyle(state.ok)}>{state.message}</p>}
    </section>
  );
}

function Header({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-start" }}>
      <div
        aria-hidden
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
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
        <p className="t-caption" style={{ margin: "2px 0 0", color: "var(--fg-3)" }}>
          {desc}
        </p>
      </div>
    </div>
  );
}
