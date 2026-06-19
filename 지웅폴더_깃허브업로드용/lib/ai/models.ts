/**
 * 제공자별 기본 모델 ID. 모델은 빠르게 바뀌므로 한 곳에서 관리한다(하드코딩 산재 방지).
 *   필요 시 이 값만 교체하면 된다. 비밀 아님(공개 가능).
 */
export const DEFAULT_MODELS = {
  // Anthropic 공식 SDK 사용. 최신 권장 모델.
  anthropic: "claude-opus-4-8",
  // Google Gemini (Vision). 멀티모달 + 영상 인라인 지원.
  gemini: "gemini-2.0-flash",
  // OpenAI Vision/텍스트.
  openai: "gpt-4o",
  // 이미지 생성
  "openai-image": "gpt-image-1",
  "google-imagen": "imagen-3.0-generate-002",
  stability: "stable-image-core",
} as const;
