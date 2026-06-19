import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, VisionRequest } from "./types";
import { DEFAULT_MODELS } from "@/lib/ai/models";

/**
 * Anthropic Claude 어댑터 — 공식 SDK 사용(@anthropic-ai/sdk).
 *   - 이미지(Vision) + 텍스트. 영상 인라인은 미지원(supportsVideo=false).
 *   - 키는 호출 시 클라이언트 생성자에만 전달. 모델은 lib/ai/models 에서 관리.
 */

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export const anthropicAdapter: ProviderAdapter = {
  provider: "anthropic",
  supportsVideo: false,
  async analyzeVision(apiKey: string, req: VisionRequest): Promise<string> {
    const content: Anthropic.ContentBlockParam[] = [];
    for (const m of req.media) {
      if (m.mimeType.startsWith("image/")) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: m.mimeType as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: m.base64,
          },
        });
      }
    }
    content.push({ type: "text", text: req.prompt });

    const res = await client(apiKey).messages.create({
      model: DEFAULT_MODELS.anthropic,
      max_tokens: 16000,
      messages: [{ role: "user", content }],
    });
    return extractText(res);
  },
  async generateText(apiKey: string, prompt: string): Promise<string> {
    const res = await client(apiKey).messages.create({
      model: DEFAULT_MODELS.anthropic,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });
    return extractText(res);
  },
};

function extractText(res: Anthropic.Message): string {
  const out = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!out) throw new Error("Claude 빈 응답");
  return out;
}
