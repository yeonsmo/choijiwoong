/**
 * 액체 배경(.liquid-bg) — 네 개의 흐릿한 파스텔 블롭이 유리 뒤에서 떠다닌다.
 * 화면 전체에 고정되어 모든 콘텐츠 뒤에 깔린다. (LiquidOS Glass 시스템의 히어로)
 * prefers-reduced-motion 에서는 토큰/CSS가 애니메이션을 멈춘다.
 */
export default function LiquidBackground() {
  return (
    <div
      className="liquid-bg"
      aria-hidden="true"
      style={{ position: "fixed" }}
    >
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
    </div>
  );
}
