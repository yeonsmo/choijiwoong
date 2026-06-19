import "server-only";

import { getActiveKeysPlain } from "@/lib/ai/keys";
import { getAdapter } from "@/lib/ai/providers";
import { getLawContext, LAW_CATEGORIES } from "@/lib/laws";
import { fetchTrends } from "./trend";

/**
 * 카피라이팅 생성(지침 5-1, 5-2-2).
 *   - 법령 DB 를 참고해 법령 준수를 기초로 작성한다.
 *   - 트렌드 API 가 설정되어 있으면 외부 트렌드를 반영, 아니면 LLM 내재 지식.
 *   - 이모지 미사용(지침 0-1-1).
 */
export interface CopyResult {
  provider: string;
  text: string;
  trendUsed: boolean;
}

export async function generateCopy(brief: string): Promise<CopyResult> {
  const keys = await getActiveKeysPlain("copy");
  if (keys.length === 0) {
    throw new Error("카피 생성용 AI 키가 없습니다. 설정에서 카피 키(Gemini/OpenAI/Claude)를 등록하세요.");
  }
  const key = keys[0];
  const adapter = getAdapter(key.provider);
  if (!adapter) throw new Error(`알 수 없는 제공자: ${key.provider}`);

  // 트렌드(선택)
  let trends: string[] | null = null;
  try {
    trends = await fetchTrends();
  } catch {
    trends = null; // 트렌드 실패는 생성을 막지 않는다(LLM 내재 지식으로 진행).
  }

  // 법령 컨텍스트(요약)
  const docs = await getLawContext({ perCategory: 15, maxCharsPerDoc: 400 });
  const lawText = docs
    .map((d) => `- [${LAW_CATEGORIES[d.category] ?? d.category}] ${d.law_name}: ${d.content}`)
    .join("\n");

  const prompt = [
    "당신은 보험광고 카피라이터입니다. 아래 요청에 맞는 보험광고 카피를 작성하십시오.",
    "반드시 대한민국 보험광고 관련 법령(보험업법, 표시·광고법, 금융소비자보호법 등)을 준수해야 합니다.",
    "과장·허위·오인 유발 표현을 피하고, 필요한 고지사항을 고려하십시오.",
    "마케팅 트렌드와 시각적 효과를 고려하되, 사실에 근거하십시오. 이모지를 절대 사용하지 마십시오.",
    "",
    "[요청]",
    brief,
    "",
    "[참고 법령]",
    lawText || "(법령 데이터 없음 — 일반 규제 지식에 근거)",
    trends && trends.length > 0 ? "\n[참고 트렌드]\n" + trends.map((t) => `- ${t}`).join("\n") : "",
    "",
    "법령을 지키는 카피 1~3안을 한국어로 제시하고, 각 안이 준수하는 핵심 규정을 짧게 덧붙이십시오.",
  ].join("\n");

  const text = await adapter.generateText(key.apiKey, prompt);
  return { provider: key.provider, text, trendUsed: Boolean(trends && trends.length > 0) };
}
