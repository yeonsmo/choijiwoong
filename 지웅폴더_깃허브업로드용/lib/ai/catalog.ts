/**
 * AI 모델 제공자 카탈로그(지침 4-1, 5-2).
 *   - kind: 용도. analysis(Vision 분석), copy(카피), image(이미지), video(영상).
 *   - provider: 각 용도별 지원 제공자. 키가 입력된 provider 만 해당 기능이 활성화된다.
 *   - 이 파일은 클라이언트/서버 공용(비밀값 없음). 설정 UI 와 엔진이 함께 참조한다.
 */

export type AiKind = "analysis" | "copy" | "image" | "video";

export interface ProviderSpec {
  provider: string;
  label: string;
  /** 키 입력 안내(발급처 등). */
  hint?: string;
}

export const KIND_LABEL: Record<AiKind, string> = {
  analysis: "분석(Vision)",
  copy: "카피라이팅",
  image: "이미지 생성",
  video: "영상 생성",
};

/** 각 용도별 지원 제공자. 첫 항목이 기본 추천. */
export const PROVIDERS: Record<AiKind, ProviderSpec[]> = {
  // 지침 4-1-3: 최초 기본 입력란은 Gemini(Vision).
  analysis: [
    { provider: "gemini", label: "Google Gemini (Vision)", hint: "Google AI Studio 발급 키" },
    { provider: "openai", label: "OpenAI GPT (Vision)", hint: "OpenAI API 키" },
    { provider: "anthropic", label: "Anthropic Claude (Vision)", hint: "Anthropic API 키" },
  ],
  // 지침 5-2-2: 카피라이팅 = Gemini/OpenAI GPT/Anthropic Claude.
  copy: [
    { provider: "gemini", label: "Google Gemini", hint: "Google AI Studio 발급 키" },
    { provider: "openai", label: "OpenAI GPT", hint: "OpenAI API 키" },
    { provider: "anthropic", label: "Anthropic Claude", hint: "Anthropic API 키" },
  ],
  // 지침 5-2-1: 이미지 = DALL-E/Imagen/Stability.
  image: [
    { provider: "openai", label: "OpenAI DALL-E", hint: "OpenAI API 키" },
    { provider: "imagen", label: "Google Imagen", hint: "Google Cloud / AI Studio 키" },
    { provider: "stability", label: "Stability AI", hint: "Stability API 키" },
  ],
  // 지침 5-2-3: 영상 = Runway/Pika/Veo.
  video: [
    { provider: "runway", label: "Runway", hint: "Runway API 키" },
    { provider: "pika", label: "Pika", hint: "Pika API 키" },
    { provider: "veo", label: "Google Veo", hint: "Google Cloud 키" },
  ],
};

export const ALL_KINDS: AiKind[] = ["analysis", "copy", "image", "video"];

export function isAiKind(v: string): v is AiKind {
  return (ALL_KINDS as string[]).includes(v);
}

/** 특정 용도에서 제공자가 유효한지 검증. */
export function isValidProvider(kind: AiKind, provider: string): boolean {
  return PROVIDERS[kind].some((p) => p.provider === provider);
}
