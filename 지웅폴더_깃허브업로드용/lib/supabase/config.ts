/**
 * Supabase 접속 공개 정보 (URL / anon 키).
 *
 * 이 두 값은 브라우저 번들에 그대로 인라인되어 공개되는 값이다. anon 키는
 * RLS(행 수준 보안)로 보호되도록 설계된 "공개 키"이므로 소스에 두어도 보안상 안전하다.
 *
 * 배포 환경변수(NEXT_PUBLIC_SUPABASE_URL 등)가 폐기된 예전 Supabase 프로젝트를
 * 가리키고 있어(사이트 전체 502/504 원인), 현재 사용하는 프로젝트 값을 여기에 고정한다.
 *
 * 주의: service_role 등 "비밀" 값은 절대 이 파일에 두지 않는다(서버 환경변수로만 관리).
 */
export const SUPABASE_URL = "https://ymxpnddwzcktopitocoj.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteHBuZGR3emNrdG9waXRvY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjU4ODMsImV4cCI6MjA5NjQwMTg4M30.V_2M1SDmrVW067NPmhS_0eyZngtwPeKDugo3n5xMCfg";
