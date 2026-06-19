import "server-only";

import { getLawContext, LAW_CATEGORIES } from "@/lib/laws";
import type { ModelVerdict, VerdictValue } from "./types";

/**
 * 분석 프롬프트 구성 + 모델 응답(JSON) 파싱.
 *   - 법령 DB 를 대조 근거로 프롬프트에 주입한다(지침 4-2-3).
 *   - 이모지 사용 금지(지침 0-1-1, 9-2). 한국어 출력.
 *   - 출력은 엄격한 JSON 으로 강제하고, 마크다운 코드펜스를 허용 후 파싱한다.
 */

/** 법령 컨텍스트 문자열과 표시용 요약을 함께 만든다. */
export async function buildLawContext(): Promise<{ contextText: string; basis: string }> {
  const docs = await getLawContext();
  if (docs.length === 0) {
    return {
      contextText: "(수집된 법령 데이터가 없습니다. 일반적인 보험광고 규제 지식에 근거해 신중히 판단하되, 근거 부족을 명시하십시오.)",
      basis: "법령 DB 비어 있음",
    };
  }
  const lines = docs.map((d) => {
    const cat = LAW_CATEGORIES[d.category] ?? `범주 ${d.category}`;
    const label = d.article_label ? ` ${d.article_label}` : "";
    return `- [${cat}] ${d.law_name}${label}: ${d.content}`;
  });
  return {
    contextText: lines.join("\n"),
    basis: `법령 조문 ${docs.length}건 대조`,
  };
}

const VERDICT_SPEC = `
반드시 아래 JSON 형식 하나만 출력하십시오. 코드펜스나 다른 텍스트를 덧붙이지 마십시오.
{
  "verdict": "VIOLATION" | "COMPLIANT" | "UNCERTAIN",
  "confidence": 0.0~1.0 사이 숫자,
  "rationale": "판별 근거 설명(한국어, 사실 중심, 이모지 금지)",
  "violatedArticles": [ { "law": "법령명", "article": "조항(가능하면)", "reason": "위반 사유" } ]
}
위반이 아니면 violatedArticles 는 빈 배열로 두십시오.`;

/** 1차 판별용 프롬프트(Vision). */
export function buildAnalysisPrompt(lawContext: string): string {
  return [
    "당신은 대한민국 보험광고의 법령 위반 여부를 검증하는 전문 심사관입니다.",
    "첨부된 광고 콘텐츠(이미지/영상)를 분석하고, 아래 법령 근거와 대조하여 위반 여부를 판별하십시오.",
    "보험업법, 표시·광고의 공정화에 관한 법률, 금융소비자 보호에 관한 법률, 보험업감독규정 등을 기준으로 합니다.",
    "",
    "[법령 근거]",
    lawContext,
    "",
    "[판별 지침]",
    "- 과장·허위 표시, 오인 유발, 필수 고지사항 누락, 비교광고 규정 위반 등을 중점 검토하십시오.",
    "- 근거가 불충분하면 UNCERTAIN 으로 판별하고 사유를 밝히십시오.",
    "- 이모지를 사용하지 마십시오. 한국어로 답하십시오.",
    VERDICT_SPEC,
  ].join("\n");
}

/** 비평 단계 프롬프트(다른 모델이 1차 결과를 검증·반론). */
export function buildCritiquePrompt(
  lawContext: string,
  initial: ModelVerdict,
): string {
  return [
    "당신은 보험광고 법령 검증의 교차검증관입니다.",
    "다른 모델이 내린 1차 판별을 비평하십시오. 동의/반론을 근거와 함께 제시하고, 놓친 위반 가능성이나 과도한 판단을 지적하십시오.",
    "",
    "[법령 근거]",
    lawContext,
    "",
    "[1차 판별]",
    JSON.stringify(initial, null, 2),
    "",
    "비평을 한국어로 간결히 작성하십시오. 이모지 금지. JSON 이 아닌 평문으로 작성하십시오.",
  ].join("\n");
}

/** 최종 재판별 프롬프트(비평을 반영). */
export function buildFinalPrompt(
  lawContext: string,
  initial: ModelVerdict,
  critiques: string[],
): string {
  return [
    "당신은 보험광고 법령 검증의 최종 판별관입니다.",
    "1차 판별과 비평들을 종합하여 최종 결론을 도출하십시오.",
    "",
    "[법령 근거]",
    lawContext,
    "",
    "[1차 판별]",
    JSON.stringify(initial, null, 2),
    "",
    "[비평들]",
    critiques.map((c, i) => `(${i + 1}) ${c}`).join("\n\n"),
    "",
    "비평을 반영하여 최종 판별을 내리십시오. 이모지 금지. 한국어.",
    VERDICT_SPEC,
  ].join("\n");
}

/** 모델 응답(JSON 기대)을 ModelVerdict 로 안전하게 파싱한다. */
export function parseVerdict(raw: string): ModelVerdict {
  const json = extractJson(raw);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(`모델 응답 JSON 파싱 실패. 응답 앞부분: ${raw.slice(0, 200)}`);
  }

  const verdict = normalizeVerdict(obj.verdict);
  const confidence = clamp01(Number(obj.confidence));
  const rationale = typeof obj.rationale === "string" ? obj.rationale : "";
  const articlesRaw = Array.isArray(obj.violatedArticles) ? obj.violatedArticles : [];
  const violatedArticles = articlesRaw
    .map((a) => {
      const o = (a ?? {}) as Record<string, unknown>;
      return {
        law: String(o.law ?? ""),
        article: o.article ? String(o.article) : undefined,
        reason: String(o.reason ?? ""),
      };
    })
    .filter((a) => a.law || a.reason);

  return { verdict, confidence, rationale, violatedArticles };
}

/** 코드펜스/잡텍스트를 제거하고 첫 번째 JSON 객체 구간을 뽑는다. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body.trim();
}

function normalizeVerdict(v: unknown): VerdictValue {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("VIOLAT")) return "VIOLATION";
  if (s.includes("COMPLIAN")) return "COMPLIANT";
  return "UNCERTAIN";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
