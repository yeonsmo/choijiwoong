import "server-only";

import type { ProviderAdapter, VisionRequest } from "./types";
import { DEFAULT_MODELS } from "@/lib/ai/models";

/**
 * Google Gemini 어댑터(REST). 멀티모달(이미지/영상 인라인) + 텍스트.
 *   - 키는 호출 시 query param(?key=) 으로 전달(공식 generativelanguage 엔드포인트 방식).
 *   - 오류는 원문 그대로 전파(지침 9-4).
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGemini(
  apiKey: string,
  parts: unknown[],
): Promise<string> {
  const model = DEFAULT_MODELS.gemini;
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Gemini 응답 파싱 실패: ${text.slice(0, 300)}`);
  }
  // candidates[0].content.parts[].text 를 이어붙인다.
  const candidates = (json as { candidates?: unknown[] }).candidates ?? [];
  const first = candidates[0] as
    | { content?: { parts?: { text?: string }[] } }
    | undefined;
  const out = (first?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!out) {
    throw new Error(`Gemini 빈 응답: ${text.slice(0, 300)}`);
  }
  return out;
}

export const geminiAdapter: ProviderAdapter = {
  provider: "gemini",
  supportsVideo: true,
  async analyzeVision(apiKey: string, req: VisionRequest): Promise<string> {
    const parts: unknown[] = [{ text: req.prompt }];
    for (const m of req.media) {
      parts.push({ inlineData: { mimeType: m.mimeType, data: m.base64 } });
    }
    return callGemini(apiKey, parts);
  },
  async generateText(apiKey: string, prompt: string): Promise<string> {
    return callGemini(apiKey, [{ text: prompt }]);
  },
};
