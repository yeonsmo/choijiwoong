"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import type { AnalysisResult, VerdictValue } from "@/lib/analysis/types";

/**
 * 분석 결과 표시(지침 9-3: 위반여부/근거조항/신뢰도/참여모델 의견을 구분 표시).
 *   검증 화면과 순환 재검증 화면에서 공통으로 사용한다. 이모지 미사용.
 */

const VERDICT_LABEL: Record<VerdictValue, string> = {
  VIOLATION: "위반",
  COMPLIANT: "위반 아님",
  UNCERTAIN: "판단 보류",
};

function verdictStyle(v: VerdictValue): { bg: string; fg: string; icon: React.ReactNode } {
  switch (v) {
    case "VIOLATION":
      return { bg: "var(--danger-wash)", fg: "var(--danger)", icon: <AlertTriangle size={20} /> };
    case "COMPLIANT":
      return { bg: "var(--ok-wash)", fg: "var(--ok)", icon: <CheckCircle2 size={20} /> };
    default:
      return { bg: "var(--warn-wash)", fg: "var(--warn)", icon: <HelpCircle size={20} /> };
  }
}

export default function VerdictResult({ result }: { result: AnalysisResult }) {
  const s = verdictStyle(result.final.verdict);
  const pct = Math.round((result.final.confidence ?? 0) * 100);

  return (
    <div style={{ display: "grid", gap: "var(--sp-4)" }}>
      {/* 최종 판별 배너 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          background: s.bg,
          color: s.fg,
          borderRadius: "var(--r-lg)",
          padding: "var(--sp-4) var(--sp-5)",
        }}
      >
        {s.icon}
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: s.fg }}>
            최종 판별 ({result.mode === "cross" ? "교차검증" : "단일 모델"})
          </div>
          <div className="t-h2" style={{ color: s.fg, margin: 0 }}>
            {VERDICT_LABEL[result.final.verdict]}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-overline" style={{ color: s.fg }}>신뢰도</div>
          <div className="t-h3" style={{ color: s.fg, margin: 0 }}>{pct}%</div>
        </div>
      </div>

      {/* 근거 */}
      <div className="glass" style={{ borderRadius: "var(--r-lg)", padding: "var(--sp-4)" }}>
        <div className="t-overline" style={{ color: "var(--fg-3)" }}>판별 근거</div>
        <p className="t-body" style={{ marginTop: "var(--sp-2)", whiteSpace: "pre-wrap" }}>
          {result.final.rationale || "근거 설명이 제공되지 않았어요."}
        </p>

        {result.final.violatedArticles.length > 0 && (
          <>
            <div className="t-overline" style={{ color: "var(--fg-3)", marginTop: "var(--sp-4)" }}>
              근거 법령 조항
            </div>
            <ul style={{ margin: "var(--sp-2) 0 0", paddingLeft: "1.2em" }}>
              {result.final.violatedArticles.map((a, i) => (
                <li key={i} className="t-body" style={{ marginBottom: 4 }}>
                  <strong>{a.law}</strong>
                  {a.article ? ` ${a.article}` : ""} — {a.reason}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="t-caption" style={{ color: "var(--fg-3)", marginTop: "var(--sp-3)" }}>
          {result.lawBasis}
        </div>
      </div>

      {/* 참여 모델 의견 */}
      {result.opinions.length > 0 && (
        <details className="glass" style={{ borderRadius: "var(--r-lg)", padding: "var(--sp-4)" }}>
          <summary className="t-label" style={{ cursor: "pointer", color: "var(--fg-2)" }}>
            참여 모델 의견 ({result.opinions.length})
          </summary>
          <div style={{ display: "grid", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            {result.opinions.map((o, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-sm)",
                  padding: "var(--sp-2) var(--sp-3)",
                }}
              >
                <div className="t-label" style={{ color: "var(--accent-strong)" }}>
                  {o.provider} · {stageLabel(o.stage)}
                </div>
                {o.verdict ? (
                  <p className="t-body" style={{ margin: "4px 0 0" }}>
                    {VERDICT_LABEL[o.verdict.verdict]} ({Math.round(o.verdict.confidence * 100)}%) — {o.verdict.rationale}
                  </p>
                ) : (
                  <p className="t-body" style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                    {o.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function stageLabel(stage: string): string {
  if (stage === "initial") return "1차 판별";
  if (stage === "critique") return "비평";
  if (stage === "final") return "최종 재판별";
  return stage;
}
