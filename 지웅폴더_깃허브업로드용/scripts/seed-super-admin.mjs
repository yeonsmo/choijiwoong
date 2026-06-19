/**
 * 최고권한자(Super Admin) 시드 스크립트.
 *
 * 실행:  npm run seed
 *   (package.json 의 "seed" 가 --env-file=.env.local 로 환경변수를 주입한다)
 *
 * 동작:
 *   1) SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD 로 Supabase Auth 사용자 생성(이미 있으면 재사용).
 *   2) public.profiles 에 role=SUPER, status=ACTIVE 로 upsert.
 *   서비스 롤 키를 사용하므로 RLS를 우회한다. 멱등(idempotent)하게 동작한다.
 *
 * 전제: 0001_init_auth_roles.sql 마이그레이션이 먼저 적용되어 있어야 한다(profiles 테이블 존재).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

function fail(msg) {
  console.error("[seed] 실패:", msg);
  process.exit(1);
}

if (!url) fail("NEXT_PUBLIC_SUPABASE_URL 미설정");
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY 미설정");
if (!email) fail("SUPER_ADMIN_EMAIL 미설정 (.env.local)");
if (!password) fail("SUPER_ADMIN_PASSWORD 미설정 (.env.local)");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  // 사용자 수가 적은 초기 단계 기준. 페이지를 돌며 이메일 일치 사용자를 찾는다.
  let page = 1;
  const perPage = 200;
  // 최대 50페이지(10,000명)까지만 탐색.
  for (; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) fail("listUsers 오류: " + error.message);
    const hit = data.users.find(
      (u) => (u.email || "").toLowerCase() === targetEmail.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function main() {
  console.log("[seed] 최고권한자 계정 준비:", email);

  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) fail("createUser 오류: " + error.message);
    user = data.user;
    console.log("[seed] Auth 사용자 생성됨:", user.id);
  } else {
    console.log("[seed] 기존 Auth 사용자 재사용:", user.id);
  }

  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      role: "SUPER",
      status: "ACTIVE",
    },
    { onConflict: "id" },
  );
  if (upsertErr) fail("profiles upsert 오류: " + upsertErr.message);

  console.log("[seed] 완료. profiles 에 SUPER 권한으로 등록됨.");
  console.log("[seed] 로그인:", email);
}

main().catch((e) => fail(e?.message || String(e)));
