import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * 인스타그램(Meta) 자동 업로드 모듈 — 동결 상태(지침 8).
 *
 * 본 모듈의 함수들은 실제 호출 가능한 완전한 형태로 구현되어 있으나,
 * 환경변수(INSTAGRAM_ENABLED, INSTAGRAM_ACCESS_TOKEN 등)가 채워지고 토글이 켜지기
 * 전까지는 동작하지 않는다(assertEnabled 가 차단). 자격증명을 .env 에 넣고
 * INSTAGRAM_ENABLED=true 로 바꾸면 즉시 동작한다.
 *
 * 외부 제약(지침 8-3): Instagram Graph API 는 다음을 요구한다.
 *   1) 비즈니스 또는 크리에이터 계정
 *   2) Facebook 페이지 연동
 *   3) Meta 앱 심사(App Review) 통과 및 권한(instagram_basic, instagram_content_publish 등)
 * 이 조건들이 충족되지 않으면 아래 함수들은 Meta 측에서 거부된다.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface InstagramConfig {
  accessToken: string;
  igUserId: string; // Instagram Business Account ID
}

/** 토글 + 자격증명이 모두 갖춰졌는지. 프론트의 '동결' 표시 판정에 사용. */
export function isInstagramEnabled(): boolean {
  const env = getServerEnv();
  return (
    env.INSTAGRAM_ENABLED === "true" &&
    Boolean(env.INSTAGRAM_ACCESS_TOKEN) &&
    Boolean(env.INSTAGRAM_BUSINESS_ACCOUNT_ID)
  );
}

/** 활성화되지 않았으면 차단(동결). 활성화 시 설정을 반환. */
function assertEnabled(): InstagramConfig {
  const env = getServerEnv();
  if (!isInstagramEnabled()) {
    throw new Error(
      "인스타그램 자동 업로드는 동결 상태입니다. .env 에 자격증명을 채우고 INSTAGRAM_ENABLED=true 로 활성화하세요.",
    );
  }
  return {
    accessToken: env.INSTAGRAM_ACCESS_TOKEN as string,
    igUserId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID as string,
  };
}

/** 액세스 토큰 유효성/계정 정보 확인(토큰 관리). */
export async function verifyAccessToken(): Promise<unknown> {
  const cfg = assertEnabled();
  const url = `${GRAPH}/${cfg.igUserId}?fields=id,username&access_token=${encodeURIComponent(cfg.accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`토큰 확인 실패 HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/**
 * 장수명 토큰으로 교환(토큰 관리). 단수명 토큰 → 60일 장수명 토큰.
 *   Meta 앱 ID/시크릿이 필요하다.
 */
export async function exchangeLongLivedToken(shortLivedToken: string): Promise<string> {
  assertEnabled();
  const env = getServerEnv();
  const url =
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(env.META_APP_ID ?? "")}` +
    `&client_secret=${encodeURIComponent(env.META_APP_SECRET ?? "")}` +
    `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`토큰 교환 실패 HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("토큰 교환 응답에 access_token 이 없습니다.");
  return json.access_token;
}

/** 1) 미디어 업로드 컨테이너 생성. 반환: creation_id. */
export async function createMediaContainer(
  imageUrl: string,
  caption: string,
): Promise<string> {
  const cfg = assertEnabled();
  const url = `${GRAPH}/${cfg.igUserId}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: cfg.accessToken,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`컨테이너 생성 실패 HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { id?: string };
  if (!json.id) throw new Error("컨테이너 응답에 id 가 없습니다.");
  return json.id;
}

/** 컨테이너 처리 상태 확인. FINISHED 가 되어야 게시 가능. */
export async function getContainerStatus(creationId: string): Promise<string> {
  const cfg = assertEnabled();
  const url = `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(cfg.accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`상태 확인 실패 HTTP ${res.status}: ${text.slice(0, 300)}`);
  return (JSON.parse(text) as { status_code?: string }).status_code ?? "UNKNOWN";
}

/** 2) 게시(publish). 반환: media id. */
export async function publishMedia(creationId: string): Promise<string> {
  const cfg = assertEnabled();
  const url = `${GRAPH}/${cfg.igUserId}/media_publish`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: cfg.accessToken }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`게시 실패 HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { id?: string };
  if (!json.id) throw new Error("게시 응답에 id 가 없습니다.");
  return json.id;
}

/** 컨테이너 생성 → 처리 완료 대기 → 게시까지 한 번에 수행. */
export async function publishImage(imageUrl: string, caption: string): Promise<string> {
  const creationId = await createMediaContainer(imageUrl, caption);

  // 처리 완료까지 폴링(최대 ~30초).
  for (let i = 0; i < 10; i++) {
    const status = await getContainerStatus(creationId);
    if (status === "FINISHED") break;
    if (status === "ERROR") throw new Error("미디어 컨테이너 처리 오류(ERROR)");
    await new Promise((r) => setTimeout(r, 3000));
  }
  return publishMedia(creationId);
}

/**
 * 스케줄러 로직: 업로드 적정 시각 결정.
 *   설정된 시각이 있으면 그 시각, 없으면 일반적으로 참여가 높은 시간대(예: 오후 7시)로
 *   다음 발생 시각을 계산한다. (AI 에이전트가 사전 조사하여 결정하도록 확장 가능)
 */
export function determineOptimalPublishTime(preferredHour = 19, now: Date = new Date()): Date {
  const target = new Date(now);
  target.setHours(preferredHour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1); // 이미 지났으면 다음 날.
  }
  return target;
}

/**
 * 예약 게시 계획 수립. 실제 작업 큐(n8n/크론)와 연동하여 when 시각에 publishImage 를
 * 호출하도록 구성한다. 현재는 동결 상태이므로 계획만 반환한다(활성화 시 큐에 등록).
 */
export function schedulePublish(
  imageUrl: string,
  caption: string,
  when: Date,
): { imageUrl: string; caption: string; scheduledAt: string } {
  assertEnabled();
  return { imageUrl, caption, scheduledAt: when.toISOString() };
}
