import "server-only";

import { getTrendConfigForEngine } from "@/lib/settings";

/**
 * 마케팅 트렌드 데이터 연동(지침 5-3).
 *   - 미설정: null 반환 → 생성 엔진은 LLM 내재 지식만 사용.
 *   - 설정: 엔드포인트 호출 후 파싱 규칙으로 트렌드 텍스트를 추출(범용 구조).
 *   - 어떤 API 든 연결 가능하도록 응답 파싱 규칙(parseRule)으로 경로를 지정한다.
 */

/** 설정된 트렌드 API 에서 트렌드 텍스트 목록을 가져온다. 실패/미설정 시 null. */
export async function fetchTrends(): Promise<string[] | null> {
  const cfg = await getTrendConfigForEngine();
  if (!cfg) return null;

  const headers: Record<string, string> = { accept: "application/json" };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;

  const res = await fetch(cfg.endpoint, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`트렌드 API HTTP ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  if (json == null) throw new Error("트렌드 API 응답이 JSON 이 아닙니다.");

  if (!cfg.parseRule) {
    // 규칙 없으면 전체를 문자열화하여 한 덩어리로 제공.
    return [JSON.stringify(json).slice(0, 2000)];
  }
  const values = resolvePath(json, cfg.parseRule);
  return values.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).slice(0, 30);
}

/**
 * 점 표기 경로를 해석한다. 배열 펼침은 "[]" 로 표기.
 *   예: "data.items[].title" → data.items 배열의 각 원소의 title.
 */
function resolvePath(root: unknown, rule: string): unknown[] {
  const segments = rule.split(".");
  let current: unknown[] = [root];

  for (const segRaw of segments) {
    const seg = segRaw.trim();
    if (!seg) continue;
    const isArray = seg.endsWith("[]");
    const key = isArray ? seg.slice(0, -2) : seg;

    const next: unknown[] = [];
    for (const node of current) {
      if (node && typeof node === "object" && key in (node as Record<string, unknown>)) {
        next.push((node as Record<string, unknown>)[key]);
      }
    }
    if (isArray) {
      // 각 배열을 펼친다.
      const flat: unknown[] = [];
      for (const n of next) {
        if (Array.isArray(n)) flat.push(...n);
        else if (n != null) flat.push(n);
      }
      current = flat;
    } else {
      current = next;
    }
  }
  return current;
}
