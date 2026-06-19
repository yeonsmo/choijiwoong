import "server-only";
import { z } from "zod";

/** 빈 문자열("")은 "미설정(undefined)"으로 취급한다. .env에 키만 있고 값이 빈 경우 대응. */
const emptyToUndefined = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema);

/**
 * 서버 사이드 환경변수 스키마.
 * 이 모듈은 "server-only"로 보호되어 클라이언트 번들에 포함되면 빌드가 실패한다.
 * 따라서 service_role 키, 암호화 마스터 키 등 비밀값이 브라우저로 새지 않는다.
 */
const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // 암호화 마스터 키 (base64 인코딩된 32바이트)
  APP_ENCRYPTION_KEY: z.string().min(1),

  // Super Admin 시드 (시드 스크립트에서만 필요. 런타임에는 선택)
  SUPER_ADMIN_EMAIL: emptyToUndefined(z.string().email().optional()),
  SUPER_ADMIN_PASSWORD: emptyToUndefined(z.string().min(8).optional()),

  // 웹훅 서명 (Step 8). 미설정 허용(해당 기능 비활성).
  WEBHOOK_SIGNING_SECRET: emptyToUndefined(z.string().optional()),

  // Instagram 동결 모듈 (Step 9). 기본 비활성.
  INSTAGRAM_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),

  // 파일 저장소 (선택)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * 검증된 서버 환경변수를 반환한다.
 * 누락/형식오류 시 명확한 오류 원문을 던진다(임의 복구하지 않는다 — 지침 9-4).
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `환경변수 검증 실패. .env.local 또는 Vercel 환경변수를 확인하십시오.\n${issues}`,
    );
  }

  cached = parsed.data;
  return cached;
}
