"use client";

import { useState } from "react";
import { Sparkles, Download, RefreshCw } from "lucide-react";
import VerdictResult from "@/app/_components/VerdictResult";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { AiKind } from "@/lib/ai/catalog";

/**
 * 콘텐츠 생성 패널(지침 5) + 생성→재검증 순환(지침 6, 7).
 *   - 출력 유형(카피/이미지/영상)은 해당 키가 있을 때만 활성화된다(지침 5-2-4).
 *   - 이미지는 생성 후 다운로드 + 분석 엔진으로 재검증(순환)을 지원한다.
 */
type OutputType = "copy" | "image" | "video";

interface GenOutput {
  outputType: OutputType;
  provider: string;
  text?: string;
  assetUrl?: string;
  path?: string;
  detail?: string;
  trendUsed?: boolean;
}

const LABEL: Record<OutputType, string> = { copy: "카피", image: "이미지", video: "영상" };

export default function GeneratePanel({
  counts,
  analysisCount,
}: {
  counts: Record<AiKind, number>;
  analysisCount: number;
}) {
  const [outputType, setOutputType] = useState<OutputType>("copy");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<GenOutput | null>(null);

  // 재검증 상태
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AnalysisResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const available = counts[outputType] > 0;

  async function generate() {
    setBusy(true);
    setError(null);
    setOutput(null);
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputType, brief }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "생성 실패");
      setOutput(data as GenOutput);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reverify() {
    if (!output?.path) return;
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: output.path, sourceKind: "image" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "재검증 실패");
      setVerifyResult(data.result as AnalysisResult);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-4)" }}>
      {/* 출력 유형 탭 */}
      <div style={{ display: "flex", gap: "var(--sp-2)" }}>
        {(["copy", "image", "video"] as OutputType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setOutputType(t);
              setOutput(null);
              setError(null);
            }}
            className="pressable"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--hairline)",
              background: outputType === t ? "var(--accent-wash)" : "var(--surface-1)",
              color: outputType === t ? "var(--accent-strong)" : "var(--fg-2)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {LABEL[t]}
            <span className="t-caption" style={{ display: "block", color: "var(--fg-3)" }}>
              {counts[t] > 0 ? `키 ${counts[t]}개` : "키 없음"}
            </span>
          </button>
        ))}
      </div>

      {!available && (
        <p style={notice}>
          {LABEL[outputType]} 생성용 키가 없어요. 관리자 설정에서 해당 유형의 API 키를 등록하면 활성화돼요.
        </p>
      )}

      <div className="glass" style={{ borderRadius: "var(--r-xl)", padding: "var(--sp-5)", display: "grid", gap: "var(--sp-3)" }}>
        <label style={{ display: "grid", gap: "var(--sp-1)" }}>
          <span className="t-label">생성 요청 내용</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="예: 30대 직장인 대상 실손보험. 안심·신뢰 강조. 과장 없이."
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-sm)",
              padding: "10px 12px",
              color: "var(--fg-1)",
              fontSize: "var(--text-body)",
              fontFamily: "var(--font-sans)",
              resize: "vertical",
            }}
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={!available || busy || !brief.trim()}
          className="pressable"
          style={primaryBtn}
        >
          <Sparkles size={16} />
          {busy ? "생성 중..." : `${LABEL[outputType]} 생성`}
        </button>
        {error && <p style={notice}>{error}</p>}
      </div>

      {/* 결과 */}
      {output && (
        <div className="glass" style={{ borderRadius: "var(--r-xl)", padding: "var(--sp-5)", display: "grid", gap: "var(--sp-3)" }}>
          <div className="t-overline" style={{ color: "var(--fg-3)" }}>
            생성 결과 · {output.provider}
            {output.trendUsed ? " · 트렌드 반영" : ""}
          </div>

          {output.outputType === "copy" && (
            <>
              <p className="t-body" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{output.text}</p>
              <DownloadText text={output.text ?? ""} />
            </>
          )}

          {output.outputType === "image" && output.assetUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={output.assetUrl}
                alt="생성된 이미지"
                style={{ width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)" }}
              />
              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                <a href={output.assetUrl} download className="pressable" style={ghostBtn}>
                  <Download size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  다운로드
                </a>
                <button type="button" onClick={reverify} disabled={verifyBusy || analysisCount === 0} className="pressable" style={primaryBtn}>
                  <RefreshCw size={15} />
                  {verifyBusy ? "재검증 중..." : "이 이미지를 법령 재검증"}
                </button>
              </div>
              {analysisCount === 0 && (
                <p className="t-caption" style={{ color: "var(--fg-3)", margin: 0 }}>
                  재검증하려면 분석(Vision) 키가 필요해요.
                </p>
              )}
            </>
          )}

          {output.outputType === "video" && (
            <>
              <p className="t-body" style={{ margin: 0 }}>
                영상 생성 작업을 제출했어요. 영상은 비동기로 처리되며, 제공자 응답은 아래와 같아요:
              </p>
              <pre
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-sm)",
                  padding: "var(--sp-3)",
                  overflowX: "auto",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                }}
              >
                {output.detail}
              </pre>
            </>
          )}

          <p className="t-caption" style={{ color: "var(--fg-3)", margin: 0 }}>
            생성된 콘텐츠의 최종 위반 여부 판단은 사용자의 책임입니다(지침 6-2).
          </p>
        </div>
      )}

      {/* 재검증 결과 */}
      {verifyError && <p style={notice}>{verifyError}</p>}
      {verifyResult && (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <div className="t-overline" style={{ color: "var(--accent-strong)" }}>생성물 재검증 결과</div>
          <VerdictResult result={verifyResult} />
        </div>
      )}
    </div>
  );
}

function DownloadText({ text }: { text: string }) {
  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "copy.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button type="button" onClick={download} className="pressable" style={ghostBtn}>
      <Download size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} />
      텍스트 다운로드
    </button>
  );
}

const primaryBtn: React.CSSProperties = {
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

const ghostBtn: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "10px 14px",
  color: "var(--fg-2)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const notice: React.CSSProperties = {
  margin: 0,
  color: "var(--danger)",
  background: "var(--danger-wash)",
  borderRadius: "var(--r-sm)",
  padding: "var(--sp-2) var(--sp-3)",
  fontSize: "var(--text-sm)",
  whiteSpace: "pre-wrap",
};
