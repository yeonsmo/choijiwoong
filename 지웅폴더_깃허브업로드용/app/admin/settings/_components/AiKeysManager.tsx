"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Cpu, Plus, Trash2 } from "lucide-react";
import {
  addAiKeyAction,
  deleteAiKeyAction,
  toggleAiKeyAction,
} from "@/app/admin/settings/actions";
import type { ActionResult } from "@/app/admin/actions";
import {
  PROVIDERS,
  KIND_LABEL,
  ALL_KINDS,
  type AiKind,
} from "@/lib/ai/catalog";
import type { AiKeyMasked } from "@/lib/ai/keys";
import SectionHeader from "./SectionHeader";
import {
  fieldStyle,
  inputStyle,
  primaryBtn,
  dangerBtn,
  ghostBtn,
  noticeStyle,
  cardStyle,
} from "./ui";

/**
 * AI API 키 다중 관리(지침 4-1, 5-2).
 *   - 용도(분석/카피/이미지/영상)별로 제공자를 골라 키를 추가/삭제한다.
 *   - 평문은 표시하지 않는다(마스킹). 키가 입력된 제공자만 해당 기능이 활성화된다.
 */
export default function AiKeysManager({ keys }: { keys: AiKeyMasked[] }) {
  const [kind, setKind] = useState<AiKind>("analysis");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addAiKeyAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const providers = PROVIDERS[kind];

  return (
    <section className="glass" style={cardStyle}>
      <SectionHeader
        icon={<Cpu size={18} strokeWidth={2} />}
        title="AI API 키"
        desc="용도별로 키를 추가하면 해당 기능이 켜져요. 키가 2개 이상이면 분석은 교차검증으로 확장돼요."
      />

      {/* 추가 폼 */}
      <form ref={formRef} action={formAction} style={{ display: "grid", gap: "var(--sp-3)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--sp-3)",
          }}
        >
          <label style={fieldStyle}>
            <span className="t-label">용도</span>
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as AiKind)}
              style={inputStyle}
            >
              {ALL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span className="t-label">제공자</span>
            <select name="provider" defaultValue={providers[0]?.provider} style={inputStyle}>
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span className="t-label">메모(선택)</span>
            <input type="text" name="label" placeholder="예: 기본 키" style={inputStyle} maxLength={80} />
          </label>
        </div>
        <label style={fieldStyle}>
          <span className="t-label">API 키</span>
          <input
            type="password"
            name="apiKey"
            autoComplete="off"
            placeholder="해당 제공자 콘솔에서 발급한 키"
            style={inputStyle}
            minLength={8}
            required
          />
        </label>
        <div>
          <button type="submit" disabled={pending} className="pressable" style={primaryBtn}>
            <Plus size={15} strokeWidth={2} />
            {pending ? "추가 중..." : "키 추가"}
          </button>
        </div>
      </form>

      {state && <p style={noticeStyle(state.ok)}>{state.message}</p>}

      {/* 목록 */}
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        {keys.length === 0 && (
          <p className="t-caption" style={{ color: "var(--fg-3)", margin: 0 }}>
            등록된 AI 키가 없어요. 위에서 추가하세요. (Gemini 분석 키부터 권장)
          </p>
        )}
        {keys.map((k) => (
          <KeyRow key={k.id} k={k} />
        ))}
      </div>
    </section>
  );
}

function KeyRow({ k }: { k: AiKeyMasked }) {
  const [delState, delAction, delPending] = useActionState<ActionResult | null, FormData>(
    deleteAiKeyAction,
    null,
  );
  const [togState, togAction, togPending] = useActionState<ActionResult | null, FormData>(
    toggleAiKeyAction,
    null,
  );
  const err = (delState && !delState.ok && delState.message) || (togState && !togState.ok && togState.message);

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
      }}
    >
      <span
        className="t-label"
        style={{
          background: "var(--accent-wash)",
          color: "var(--accent-strong)",
          borderRadius: "var(--r-pill)",
          padding: "2px 10px",
        }}
      >
        {KIND_LABEL[k.kind]}
      </span>
      <span className="t-body" style={{ fontWeight: 500 }}>{k.provider}</span>
      <span className="t-caption" style={{ color: "var(--fg-3)" }}>
        {k.masked}
        {k.label ? ` · ${k.label}` : ""}
      </span>
      {!k.enabled && (
        <span className="t-caption" style={{ color: "var(--warn)" }}>비활성</span>
      )}
      <div style={{ flex: 1 }} />
      {err && <span className="t-caption" style={{ color: "var(--danger)" }}>{err}</span>}
      <form action={togAction}>
        <input type="hidden" name="id" value={k.id} />
        <input type="hidden" name="enabled" value={(!k.enabled).toString()} />
        <button type="submit" disabled={togPending} className="pressable" style={ghostBtn}>
          {k.enabled ? "비활성화" : "활성화"}
        </button>
      </form>
      <form action={delAction}>
        <input type="hidden" name="id" value={k.id} />
        <button type="submit" disabled={delPending} className="pressable" style={dangerBtn}>
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
