"use client";

import { useState } from "react";
import { DatabaseZap, Download } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { primaryBtn, noticeStyle, cardStyle } from "./ui";

/**
 * 법령 데이터 수집 카드(지침 3-1~3-3).
 *   - 현재 적재 건수/최근 수집 시각을 보여준다.
 *   - "지금 수집/업데이트"는 /api/laws/collect 를 호출한다(서버에서 키·권한 검증).
 *   - 91일 카운터는 수집 시 서버가 갱신한다. 키 관리와는 독립.
 */
export default function CollectionCard({
  total,
  byCategory,
  categoryLabels,
  lastCollectedAt,
  daysSince,
  lawKeyConfigured,
}: {
  total: number;
  byCategory: Record<number, number>;
  categoryLabels: Record<number, string>;
  lastCollectedAt: string | null;
  daysSince: number | null;
  lawKeyConfigured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function collect() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/laws/collect", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMsg({ ok: true, text: `수집 완료: 조문 ${data.count}건. 페이지를 새로고침하면 건수가 갱신돼요.` });
      } else {
        setMsg({ ok: false, text: data.message ?? "수집에 실패했어요." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass" style={cardStyle}>
      <SectionHeader
        icon={<DatabaseZap size={18} strokeWidth={2} />}
        title="법령 데이터 수집"
        desc="법제처 7개 범주의 법령·규정을 수집해 분석 근거 DB로 저장해요."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--sp-2)",
        }}
      >
        {Object.entries(categoryLabels).map(([cat, label]) => (
          <div
            key={cat}
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-sm)",
              padding: "var(--sp-2) var(--sp-3)",
            }}
          >
            <div className="t-caption" style={{ color: "var(--fg-3)" }}>
              {cat}. {label}
            </div>
            <div className="t-body" style={{ fontWeight: 600 }}>
              {byCategory[Number(cat)] ?? 0}건
            </div>
          </div>
        ))}
      </div>

      <div className="t-caption" style={{ color: "var(--fg-2)" }}>
        총 {total}건 적재
        {lastCollectedAt
          ? ` · 최근 수집 ${lastCollectedAt.slice(0, 10)}${
              daysSince != null ? ` (${daysSince}일 전)` : ""
            }`
          : " · 수집 이력 없음"}
      </div>

      {!lawKeyConfigured && (
        <p style={noticeStyle(false)}>
          법제처 API 키가 없어 수집/업데이트를 할 수 없어요. 위에서 키를 먼저 등록하세요.
          (이미 수집된 데이터가 있으면 분석은 계속 동작해요)
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={collect}
          disabled={busy || !lawKeyConfigured}
          className="pressable"
          style={primaryBtn}
        >
          <Download size={15} strokeWidth={2} />
          {busy ? "수집 중... (수십 초 걸릴 수 있어요)" : "지금 수집 / 업데이트"}
        </button>
      </div>

      {msg && <p style={noticeStyle(msg.ok)}>{msg.text}</p>}
    </section>
  );
}
