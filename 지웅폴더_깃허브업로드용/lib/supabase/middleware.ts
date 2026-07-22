import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/**
 * 세션 쿠키를 갱신하고, 미인증 사용자를 /login 으로 보낸다.
 * 공개 경로(로그인, 헬스체크, 정적 자원)는 통과시킨다.
 *
 * 역할(ADMIN/SUPER) 검증은 여기서 하지 않는다(요청마다 DB 조회 비용).
 * 역할 검증은 각 보호 페이지/서버 액션에서 requireRole 로 정밀하게 수행한다.
 */

// /api/v1/* 는 외부 시스템용(Bearer 토큰 자체 인증)이라 세션 가드를 건너뛴다.
const PUBLIC_PATHS = ["/login", "/api/health", "/api/v1"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인된 사용자가 /login 으로 오면 홈으로.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
