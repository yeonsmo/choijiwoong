/**
 * 최고권한자(Super Admin) 계정 복구 스크립트.
 *
 * 언제 쓰나:
 *   - 관리자 비밀번호를 잊어버렸을 때(비밀번호는 Supabase가 해시로 보관하므로 원문 조회 불가 → "재설정"만 가능).
 *   - 실수로 최고권한자 계정이 DISABLED 되거나 role 이 낮아져 로그인/관리자 접근이 막혔을 때.
 *
 * 실행:  npm run reset-admin
 *   (package.json 의 "reset-admin" 이 --env-file=.env.local 로 환경변수를 주입한다)
 *
 * 동작:
 *   1) SUPER_ADMIN_EMAIL 로 Supabase Auth 사용자를 찾는다.
 *        - 있으면: SUPER_ADMIN_PASSWORD 로 비밀번호를 재설정하고 이메일을 확인 처리한다.
 *        - 없으면: 해당 이메일/비밀번호로 새로 생성한다.
 *   2) public.profiles 를 role=SUPER, status=ACTIVE 로 upsert 한다(권한/활성 상태 원복).
 *   서비스 롤 키를 사용하므로 RLS를 우회한다. 멱등(idempotent)하게 동작한다.
 *
 * 전제: 0001_init_auth_roles.sql 마이그레이션이 먼저 적용되어 있어야 한다(profiles 테이블 존재).
 *
 * 주의: 이 스크립트는 서버 전용 비밀값(SUPABASE_SERVICE_ROLE_KEY)을 사용한다.
 *       로컬에서만 실행하고, 새 비밀번호는 실행 후 .env.local 에서 지우거나 안전하게 보관한다.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

function fail(msg) {
  console.error("[reset-admin] 실패:", msg);
  process.exit(1);
}

if (!url) fail("NEXT_PUBLIC_SUPABASE_URL 미설정");
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY 미설정");
if (!email) fail("SUPER_ADMIN_EMAIL 미설정 (.env.local). 복구하려는 관리자 이메일을 넣으세요.");
if (!password) fail("SUPER_ADMIN_PASSWORD 미설정 (.env.local). 새로 지정할 비밀번호를 넣으세요(8자 이상).");
if (password.length < 8) fail("SUPER_ADMIN_PASSWORD 는 8자 이상이어야 합니다.");

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
  console.log("[reset-admin] 최고권한자 계정 복구 시작:", email);

  let user = await findUserByEmail(email);

  if (user) {
    // 기존 계정: 비밀번호 재설정 + 이메일 확인 처리.
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) fail("비밀번호 재설정(updateUserById) 오류: " + error.message);
    user = data.user;
    console.log("[reset-admin] 기존 Auth 사용자 비밀번호 재설정 완료:", user.id);
  } else {
    // 계정이 없으면 새로 생성(시드와 동일 동작).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) fail("createUser 오류: " + error.message);
    user = data.user;
    console.log("[reset-admin] Auth 사용자 신규 생성:", user.id);
  }

  // 권한/활성 상태 원복: 혹시 role 이 낮아졌거나 DISABLED 되었어도 SUPER/ACTIVE 로 되돌린다.
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

  console.log("[reset-admin] 완료. profiles 에 role=SUPER, status=ACTIVE 로 원복됨.");
  console.log("[reset-admin] 이제 로그인하세요 →", email);
  console.log("[reset-admin] 보안 주의: 방금 사용한 새 비밀번호를 .env.local 에서 지우거나 안전하게 보관하세요.");
}

main().catch((e) => fail(e?.message || String(e)));
