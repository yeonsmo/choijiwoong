import "server-only";

import { getActiveKeysPlain } from "@/lib/ai/keys";

/**
 * 영상 생성(지침 5-2-3): Runway / Pika / Google Veo.
 *   - 입력된 제공자 키로만 동작한다(키 없으면 오류).
 *   - 영상 생성은 제공자마다 비동기(작업 제출 → 폴링) 구조라 한 번의 요청으로 완성본을
 *     보장하기 어렵다. 본 함수는 작업을 "제출"하고 제공자 원문 응답(작업 ID/상태/URL)을
 *     반환한다. 완성본 수신/폴링은 제공자 콘솔/후속 단계에서 처리한다.
 *   - 오류는 원문 전파(지침 9-4).
 */
export interface VideoResult {
  provider: string;
  status: "submitted";
  /** 제공자 원문 응답(작업 ID/상태/URL 등). */
  detail: string;
}

export async function generateVideo(brief: string): Promise<VideoResult> {
  const keys = await getActiveKeysPlain("video");
  if (keys.length === 0) {
    throw new Error("영상 생성용 AI 키가 없습니다. 설정에서 영상 키(Runway/Pika/Veo)를 등록하세요.");
  }
  const key = keys[0];
  const prompt = `보험광고용 짧은 영상. ${brief}. 사실에 근거하고 과장·오인 유발 요소 배제.`;

  let detail: string;
  if (key.provider === "runway") {
    detail = await submitRunway(key.apiKey, prompt);
  } else if (key.provider === "pika") {
    detail = await submitPika(key.apiKey, prompt);
  } else if (key.provider === "veo") {
    detail = await submitVeo(key.apiKey, prompt);
  } else {
    throw new Error(`지원하지 않는 영상 제공자: ${key.provider}`);
  }

  return { provider: key.provider, status: "submitted", detail };
}

/** Runway: text→video 작업 제출. 작업 ID 를 포함한 원문 반환. */
async function submitRunway(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({ promptText: prompt, model: "gen3a_turbo", duration: 5 }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Runway HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text.slice(0, 1000);
}

/** Pika: text→video 작업 제출. */
async function submitPika(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.pika.art/v1/generate", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pika HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text.slice(0, 1000);
}

/** Google Veo: text→video 작업 제출(predictLongRunning). */
async function submitVeo(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-001:predictLongRunning?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }] }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Veo HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text.slice(0, 1000);
}
