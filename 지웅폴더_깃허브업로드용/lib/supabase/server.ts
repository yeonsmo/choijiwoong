import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * 서버 컴포넌트/Route Handler 용 Supabase 클라이언트 (사용자 세션 기반).
 * anon 키 + 쿠키 세션을 사용한다. RLS가 적용되어 로그인한 사용자의 권한만큼만 접근.
 */
export async function createServerSupabase() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 set이 막힐 수 있다(미들웨어가 세션 갱신 담당).
          }
        },
      },
    },
  );
}

/**
 * 관리 작업 전용(서비스 롤) 클라이언트.
 * RLS를 우회하므로 반드시 서버에서 권한 검증을 직접 마친 뒤에만 사용한다.
 * 절대 클라이언트로 노출 금지.
 */
export function createServiceRoleSupabase() {
  const env = getServerEnv();
  return createAdminClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
