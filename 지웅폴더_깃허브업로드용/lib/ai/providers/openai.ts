import "server-only";

import type { ProviderAdapter, VisionRequest } from "./types";
import { DEFAULT_MODELS } from "@/lib/ai/models";

/**
 * OpenAI 어댑터(REST, Chat Completions). 이미지(Vision) + 텍스트.
 *   - 영상 인라인은 지원하지 않는다(supportsVideo=false). 영상은 Gemini 로 처리.
 *   - 키는 Authorization: Bearer 로 전달. 오류는 원문 전파(지침 9-4).
 */

const URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(
  apiKey: string,
  content: unknown,
): Promise<string> {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.openai,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI 응답 파싱 실패: ${text.slice(0, 300)}`);
  }
  const out = (json as { choices?: { message?: { content?: string } }[] })
    .choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error(`OpenAI 빈 응답: ${text.slice(0, 300)}`);
  return out;
}

export const openaiAdapter: ProviderAdapter = {
  provider: "openai",
  supportsVideo: false,
  async analyzeVision(apiKey: string, req: VisionRequest): Promise<string> {
    const content: unknown[] = [{ type: "text", text: req.prompt }];
    for (const m of req.media) {
      // OpenAI 는 이미지 data URL 형식을 받는다. 영상은 지원하지 않으므로 건너뛴다.
      if (m.mimeType.startsWith("image/")) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${m.mimeType};base64,${m.base64}` },
        });
      }
    }
    return callOpenAI(apiKey, content);
  },
  async generateText(apiKey: string, prompt: string): Promise<string> {
    return callOpenAI(apiKey, prompt);
  },
};
