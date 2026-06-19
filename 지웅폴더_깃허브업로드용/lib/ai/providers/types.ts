import "server-only";

/**
 * AI 제공자 어댑터 공통 타입.
 *   분석(Vision)과 텍스트 생성(카피/비평)을 제공자별로 통일된 인터페이스로 노출한다.
 *   비밀 키는 호출 시점에 인자로만 전달하며, 어댑터는 키를 저장하지 않는다.
 */

/** 모델에 전달할 미디어 1개(이미지/영상). base64 는 원본 바이트. */
export interface MediaPart {
  mimeType: string;
  base64: string;
}

export interface VisionRequest {
  /** 분석 대상 미디어(이미지 1장 또는 영상 1개 등). */
  media: MediaPart[];
  /** 모델에 줄 지시문(법령 컨텍스트 포함). */
  prompt: string;
}

export interface ProviderAdapter {
  provider: string;
  /** 이 제공자가 영상(video/*) 인라인 분석을 지원하는지. */
  supportsVideo: boolean;
  /** Vision 분석. 모델의 원문 응답(텍스트, JSON 기대)을 반환. */
  analyzeVision(apiKey: string, req: VisionRequest): Promise<string>;
  /** 순수 텍스트 생성(카피/비평/재판별). */
  generateText(apiKey: string, prompt: string): Promise<string>;
}
