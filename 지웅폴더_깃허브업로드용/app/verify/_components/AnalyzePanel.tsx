"use client";

import { useState } from "react";
import { ScanSearch, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VerdictResult from "@/app/_components/VerdictResult";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * 광고 검증 패널.
 *   파일 선택 → Storage 직접 업로드(서명 URL) → /api/analyze 호출 → 결과 표시.
 *   영상도 Storage 경유로 처리하여 서버리스 페이로드 한도를 우회한다(지침 1-5).
 */
export default function AnalyzePanel({ keyCount }: { keyCount: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function analyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const sourceKind = file.type.startsWith("video/") ? "video" : "image";

      // 1) 서명 URL 발급
      setPhase("업로드 준비 중...");
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const sign = await signRes.json();
      if (!sign.ok) throw new Error(sign.message ?? "업로드 URL 발급 실패");

      // 2) Storage 직접 업로드
      setPhase("파일 업로드 중...");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, file);
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

      // 3) 분석
      setPhase("법령과 대조해 분석 중... (수십 초 걸릴 수 있어요)");
      const anRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: sign.path, sourceKind }),
      });
      const an = await anRes.json();
      if (!an.ok) throw new Error(an.message ?? "분석 실패");
      setResult(an.result as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-4)" }}>
      {keyCount === 0 && (
        <p style={notice}>
          분석용 AI 키가 없어요. 관리자 설정에서 분석(Vision) 키(예: Gemini)를 먼저 등록해야 검증할 수 있어요.
        </p>
      )}
      {keyCount >= 2 && (
        <p className="t-caption" style={{ color: "var(--accent-strong)", margin: 0 }}>
          분석 키 {keyCount}개 — 교차검증(Cross-Examination)으로 분석해요.
        </p>
      )}

      <div className="glass" style={{ borderRadius: "var(--r-xl)", padding: "var(--sp-5)", display: "grid", gap: "var(--sp-3)" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            border: "1px dashed var(--hairline)",
            borderRadius: "var(--r-md)",
            padding: "var(--sp-5)",
            cursor: "pointer",
            justifyContent: "center",
            color: "var(--fg-2)",
          }}
        >
          <Upload size={18} />
          <span className="t-body">{file ? file.name : "이미지 또는 영상 파일 선택"}</span>
          <input
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
          />
        </label>

        <button
          type="button"
          onClick={analyze}
          disabled={!file || busy || keyCount === 0}
          className="pressable"
          style={primaryBtn}
        >
          <ScanSearch size={16} />
          {busy ? phase || "분석 중..." : "법령 위반 검증"}
        </button>

        {error && <p style={notice}>{error}</p>}
      </div>

      {result && <VerdictResult result={result} />}
    </div>
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

const notice: React.CSSProperties = {
  margin: 0,
  color: "var(--danger)",
  background: "var(--danger-wash)",
  borderRadius: "var(--r-sm)",
  padding: "var(--sp-2) var(--sp-3)",
  fontSize: "var(--text-sm)",
  whiteSpace: "pre-wrap",
};
