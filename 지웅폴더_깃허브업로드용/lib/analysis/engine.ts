import "server-only";

import { getActiveKeysPlain, type AiKeyPlain } from "@/lib/ai/keys";
import { getAdapter, type MediaPart } from "@/lib/ai/providers";
import {
  buildLawContext,
  buildAnalysisPrompt,
  buildCritiquePrompt,
  buildFinalPrompt,
  parseVerdict,
} from "./prompt";
import type { AnalysisResult, ModelOpinion } from "./types";

/**
 * 분석 엔진(지침 4-2, 4-3).
 *   - 활성 분석 키 1개  → 단일 모델 판별(single).
 *   - 활성 분석 키 2개+ → 교차검증(cross, Cross-Examination):
 *       1) 1차 판별(1개 모델, Vision)
 *       2) 다른 모델들이 비평/반론
 *       3) 1차 모델이 비평을 반영해 최종 재판별
 *     키가 늘수록 비평에 참여하는 모델이 늘어난다.
 *   - 키가 없으면 오류(설정에서 등록 안내). 오류 원문 전파(지침 9-4).
 */
export async function runAnalysis(media: MediaPart[]): Promise<AnalysisResult> {
  const keys = await getActiveKeysPlain("analysis");
  if (keys.length === 0) {
    throw new Error(
      "분석용 AI 키가 없습니다. 설정 메뉴에서 분석(Vision) 키(예: Gemini)를 먼저 등록하세요.",
    );
  }

  const { contextText, basis } = await buildLawContext();
  const hasVideo = media.some((m) => m.mimeType.startsWith("video/"));

  // Vision 1차 판별에 쓸 키 선택: 영상이면 영상 지원 제공자 우선.
  const visionKey = pickVisionKey(keys, hasVideo);
  if (!visionKey) {
    throw new Error(
      "영상 분석을 지원하는 키가 없습니다. 영상은 Gemini 키로 분석할 수 있습니다. (이미지로 시도하거나 Gemini 키를 추가하세요)",
    );
  }

  const visionAdapter = getAdapter(visionKey.provider);
  if (!visionAdapter) {
    throw new Error(`알 수 없는 제공자: ${visionKey.provider}`);
  }

  // 1) 1차 판별 (Vision)
  const initialRaw = await visionAdapter.analyzeVision(visionKey.apiKey, {
    media,
    prompt: buildAnalysisPrompt(contextText),
  });
  const initial = parseVerdict(initialRaw);

  const opinions: ModelOpinion[] = [
    { provider: visionKey.provider, stage: "initial", verdict: initial },
  ];

  // 단일 모드: 1차 판별이 곧 최종.
  if (keys.length === 1) {
    return { mode: "single", final: initial, opinions, lawBasis: basis };
  }

  // 2) 비평 단계 — 1차 모델을 제외한 나머지 키들이 비평.
  const critics = keys.filter((k) => k.id !== visionKey.id);
  const critiques: string[] = [];
  for (const c of critics) {
    const adapter = getAdapter(c.provider);
    if (!adapter) continue;
    try {
      const text = await adapter.generateText(
        c.apiKey,
        buildCritiquePrompt(contextText, initial),
      );
      critiques.push(`[${c.provider}] ${text}`);
      opinions.push({ provider: c.provider, stage: "critique", text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opinions.push({ provider: c.provider, stage: "critique", text: `비평 실패: ${msg}` });
    }
  }

  // 3) 최종 재판별 — 1차 모델이 비평을 반영.
  let final = initial;
  if (critiques.length > 0) {
    try {
      const finalRaw = await visionAdapter.generateText(
        visionKey.apiKey,
        buildFinalPrompt(contextText, initial, critiques),
      );
      final = parseVerdict(finalRaw);
      opinions.push({ provider: visionKey.provider, stage: "final", verdict: final });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opinions.push({
        provider: visionKey.provider,
        stage: "final",
        text: `최종 재판별 실패(1차 결과 유지): ${msg}`,
      });
    }
  }

  return { mode: "cross", final, opinions, lawBasis: basis };
}

function pickVisionKey(keys: AiKeyPlain[], hasVideo: boolean): AiKeyPlain | null {
  if (!hasVideo) return keys[0] ?? null;
  for (const k of keys) {
    const a = getAdapter(k.provider);
    if (a?.supportsVideo) return k;
  }
  return null;
}
