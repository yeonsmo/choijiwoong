/** 설정 카드 공용 헤더. */
export default function SectionHeader({
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
