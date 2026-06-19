import "server-only";

import type { ProviderAdapter } from "./types";
import { geminiAdapter } from "./gemini";
import { openaiAdapter } from "./openai";
import { anthropicAdapter } from "./anthropic";

/** 분석/카피 제공자 어댑터 레지스트리. */
const ADAPTERS: Record<string, ProviderAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
};

export function getAdapter(provider: string): ProviderAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export type { ProviderAdapter, VisionRequest, MediaPart } from "./types";
