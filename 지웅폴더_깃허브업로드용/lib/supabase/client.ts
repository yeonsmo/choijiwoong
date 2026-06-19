"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * NEXT_PUBLIC_* 공개 값만 사용한다(빌드 시 인라인됨).
 * service_role 키 등 서버 비밀값은 절대 여기에 들어오지 않는다.
 * (server-only 모듈을 import 하지 않는다 — 클라이언트 번들 오염 방지.)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
