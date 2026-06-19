/**
 * DB 마이그레이션 러너.
 *
 * 실행:  npm run migrate
 *   (--env-file=.env.local 로 환경변수 주입)
 *
 * 동작:
 *   - supabase/migrations/*.sql 을 파일명 오름차순으로 순서대로 실행.
 *   - 적용 이력을 public.schema_migrations 테이블에 기록하여 멱등 보장
 *     (이미 적용된 파일은 건너뛴다).
 *
 * 연결: SUPABASE_DB_URL (Postgres 연결 문자열). Supabase 대시보드의
 *       Connect > Session pooler URI 를 사용한다(비밀번호 포함).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "[migrate] 실패: SUPABASE_DB_URL 미설정. .env.local 에 Postgres 연결 문자열을 넣으세요.",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase 는 TLS 필요. 풀러/직접연결 모두 동작하도록 인증서 검증은 완화.
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("[migrate] DB 연결됨");

  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] 적용할 .sql 파일이 없습니다.");
    return;
  }

  for (const file of files) {
    const { rowCount } = await client.query(
      "select 1 from public.schema_migrations where filename = $1",
      [file],
    );
    if (rowCount > 0) {
      console.log(`[migrate] 건너뜀(이미 적용): ${file}`);
      continue;
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] 적용 중: ${file}`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log(`[migrate] 완료: ${file}`);
    } catch (e) {
      await client.query("rollback");
      // 오류 원문 그대로 표시(임의 복구 시도하지 않음).
      console.error(`[migrate] 실패: ${file}\n`, e?.message || e);
      process.exit(1);
    }
  }

  console.log("[migrate] 모든 마이그레이션 적용 완료.");
}

main()
  .catch((e) => {
    console.error("[migrate] 오류:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
