"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";

/**
 * 인터랙티브 유리 카드. 커서를 따라 스포트라이트(--mouse-x/y)가 움직이고,
 * lift 옵션 시 hover에서 살짝 떠오른다. (LiquidOS Glass: glass-card)
 */
export default function GlassCard({
  children,
  lift = true,
  className = "",
  style,
}: {
  children: ReactNode;
  lift?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`glass-card${lift ? " glass-card--lift" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
