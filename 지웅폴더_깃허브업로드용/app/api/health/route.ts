import { NextResponse } from "next/server";

/**
 * 헬스체크 + 환경변수 구성 점검 엔드포인트.
 * 비밀값 자체는 절대 반환하지 않고, "설정 여부(boolean)"만 노출한다.
 */
export async function GET() {
  const configured = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    appEncryptionKey: Boolean(process.env.APP_ENCRYPTION_KEY),
    instagramEnabled: process.env.INSTAGRAM_ENABLED === "true",
  };

  return NextResponse.json({
    status: "ok",
    step: "1 - infra/env",
    configured,
  });
}
