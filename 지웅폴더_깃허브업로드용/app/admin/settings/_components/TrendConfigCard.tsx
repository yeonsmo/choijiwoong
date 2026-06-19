"use client";

import { useActionState } from "react";
import { TrendingUp, Trash2 } from "lucide-react";
import { saveTrendConfigAction } from "@/app/admin/settings/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { TrendConfigStatus } from "@/lib/settings";
import SectionHeader from "./SectionHeader";
import {
  fieldStyle,
  inputStyle,
  primaryBtn,
  dangerBtn,
  noticeStyle,
  cardStyle,
} from "./ui";

/**
 * 트렌드 API 범용 연동 설정(지침 5-3).
 *   - 엔드포인트 + 응답 파싱 규칙 + (선택) API 키. 어떤 API 든 연결 가능하도록 범용.
 *   - 미설정 시 생성 엔진은 LLM 내재 지식으로 트렌드를 반영한다(지침 5-3-1).
 */
export default function TrendConfigCard({ status }: { status: TrendConfigStatus }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveTrendConfigAction,
    null,
  );

  return (
    <section className="glass" style={cardStyle}>
      <SectionHeader
        icon={<TrendingUp size={18} strokeWidth={2} />}
        title="트렌드 API (선택)"
        desc="외부 마케팅 트렌드 API 를 연결하면 생성 시 외부 데이터를 함께 반영해요. 비워두면 LLM 내재 지식만 사용해요."
      />

      <form action={formAction} style={{ display: "grid", gap: "var(--sp-3)" }}>
        <input type="hidden" name="op" value="save" />
        <label style={fieldStyle}>
          <span className="t-label">엔드포인트 URL</span>
          <input
            type="url"
            name="endpoint"
            defaultValue={status.endpoint ?? ""}
            placeholder="https://api.example.com/trends"
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="t-label">응답 파싱 규칙(선택)</span>
          <input
            type="text"
            name="parseRule"
            defaultValue={status.parseRule ?? ""}
            placeholder="예: data.items[].title  (응답 JSON 에서 트렌드 텍스트 경로)"
            style={inputStyle}
            maxLength={200}
          />
        </label>
        <label style={fieldStyle}>
          <span className="t-label">트렌드 API 키(선택)</span>
          <input
            type="password"
            name="apiKey"
            autoComplete="off"
            placeholder={status.hasKey ? "설정됨 · 변경하려면 새 키 입력" : "필요 시 입력"}
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <button type="submit" disabled={pending} className="pressable" style={primaryBtn}>
            {pending ? "저장 중..." : "트렌드 설정 저장"}
          </button>
        </div>
      </form>

      {status.configured && (
        <form action={formAction}>
          <input type="hidden" name="op" value="delete" />
          <button type="submit" disabled={pending} className="pressable" style={dangerBtn}>
            <Trash2 size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            트렌드 설정 삭제
          </button>
        </form>
      )}

      {state && <p style={noticeStyle(state.ok)}>{state.message}</p>}
    </section>
  );
}
