-- =============================================================================
-- 0002_app_core.sql
-- 보험광고 법령 검증 웹앱 - 핵심 기능 스키마 (Step 3~8)
--   법령 데이터, 수집 카운터, AI/트렌드 키, 외부 API 토큰, 분석/생성 기록.
--
-- 실행 방법:
--   npm run migrate            (SUPABASE_DB_URL 사용, 멱등)
--   또는 Supabase 대시보드 SQL Editor 에 붙여넣기.
--
-- 공통 원칙:
--   - 모든 테이블 RLS 활성화 + 클라이언트 정책 없음 => 일반 클라이언트 전면 차단.
--   - 모든 읽기/쓰기는 서버(service_role)에서 권한 검증 후 수행한다.
--   - 비밀값(API 키)은 평문 저장 금지. 앱에서 AES-256-GCM 으로 암호화한 cipher 만 저장.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- law_documents: 법제처 등에서 수집한 법령/규정 조문 저장소(분석 대조용).
--   지침 3-2 의 7개 범주를 category(1~7) 로 구분한다.
--   dedup_key: 중복 적재 방지용 고유 키(앱에서 합성). 재수집 시 upsert 기준.
-- ---------------------------------------------------------------------------
create table if not exists public.law_documents (
  id            bigint generated always as identity primary key,
  category      smallint not null check (category between 1 and 7),
  law_name      text not null,
  doc_type      text,                       -- 법률/시행령/시행규칙/고시/지침 등
  article_no    text,                       -- 조문 번호(있을 때)
  article_label text,                       -- 제N조(제목)
  title         text,
  content       text not null,
  source        text not null default 'moleg' check (source in ('moleg', 'manual')),
  source_id     text,                       -- 법제처 식별자(법령ID/조문키)
  dedup_key     text not null unique,
  raw           jsonb,
  fetched_at    timestamptz not null default now()
);

comment on table public.law_documents is '수집된 법령 조문. 분석 엔진의 대조 근거. 쓰기는 서버 권한 검증 후 service_role.';

create index if not exists idx_law_documents_category on public.law_documents (category);
create index if not exists idx_law_documents_law_name on public.law_documents (law_name);

alter table public.law_documents enable row level security;
-- 정책 없음 => 클라이언트 직접 접근 차단. 서버(service_role)만 접근.

-- ---------------------------------------------------------------------------
-- law_collection_meta: 법령 수집 메타(단일 행, id=1 고정).
--   지침 3-3 의 91일 카운터 기준. 법제처 API 키 관리와 완전히 독립이다:
--   이 테이블은 키 값을 일절 담지 않으며, 키 교체/삭제가 이 값을 바꾸지 않는다.
-- ---------------------------------------------------------------------------
create table if not exists public.law_collection_meta (
  id                  smallint primary key default 1 check (id = 1),
  first_collected_at  timestamptz,           -- 최초 수집일(91일 비교 기준 1)
  last_collected_at   timestamptz,           -- 최종 수집일(91일 비교 기준 2)
  last_count          integer not null default 0,
  last_status         text,                  -- 직전 수집 요약(성공/부분/오류 원문)
  updated_at          timestamptz not null default now()
);

comment on table public.law_collection_meta is '법령 수집 메타. 91일 카운터 기준. 법제처 키 관리와 독립.';

alter table public.law_collection_meta enable row level security;

-- ---------------------------------------------------------------------------
-- ai_api_keys: AI 모델 API 키(다중). 지침 4-1, 5-2.
--   kind: 용도(analysis=Vision 분석, copy=카피, image=이미지, video=영상).
--   cipher: AES-256-GCM 암호문(평문 미저장).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_api_keys (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('analysis', 'copy', 'image', 'video')),
  provider    text not null,                 -- gemini/openai/anthropic/stability/imagen/runway/pika/veo ...
  label       text not null default '',
  cipher      text not null,
  enabled     boolean not null default true,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

comment on table public.ai_api_keys is 'AI 모델 API 키(암호화). 평문은 서버에서만 복호화. 클라이언트 접근 차단.';

create index if not exists idx_ai_api_keys_kind on public.ai_api_keys (kind, enabled);

alter table public.ai_api_keys enable row level security;

-- ---------------------------------------------------------------------------
-- api_tokens: 앱이 외부에 발급하는 API 토큰(지침 7). SUPER/ADMIN 발급.
--   token_hash: sha256(전체 토큰). 평문 토큰은 발급 직후 1회만 노출.
-- ---------------------------------------------------------------------------
create table if not exists public.api_tokens (
  id            bigint generated always as identity primary key,
  name          text not null,
  token_prefix  text not null,               -- 식별용 앞 12자(평문 일부)
  token_hash    text not null unique,        -- sha256(전체 토큰)
  scope         jsonb not null default '["analyze"]'::jsonb,
  revoked       boolean not null default false,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

comment on table public.api_tokens is '외부 호출용 API 토큰. 해시만 저장. 발급/조회/폐기는 관리자.';

alter table public.api_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- analyses: 분석(검증) 결과 기록. 순환 워크플로우(지침 6)와 이력 조회에 사용.
-- ---------------------------------------------------------------------------
create table if not exists public.analyses (
  id          bigint generated always as identity primary key,
  created_by  uuid references auth.users (id),
  source_kind text not null check (source_kind in ('image', 'video')),
  source_url  text,
  mode        text not null check (mode in ('single', 'cross')),
  verdict     text check (verdict in ('VIOLATION', 'COMPLIANT', 'UNCERTAIN')),
  confidence  numeric,
  result      jsonb not null,                -- 모델 의견/비평/최종합의/근거조항 전체
  created_at  timestamptz not null default now()
);

comment on table public.analyses is '분석 결과 기록. mode=single/cross. result 에 전체 판별 내역.';

create index if not exists idx_analyses_created_by on public.analyses (created_by, created_at desc);

alter table public.analyses enable row level security;

-- ---------------------------------------------------------------------------
-- generations: 생성 결과 기록(지침 5~7). 재검증 순환의 입력원이 될 수 있다.
-- ---------------------------------------------------------------------------
create table if not exists public.generations (
  id          bigint generated always as identity primary key,
  created_by  uuid references auth.users (id),
  output_type text not null check (output_type in ('image', 'copy', 'video')),
  provider    text,
  prompt      text,
  result      jsonb not null,
  asset_url   text,
  created_at  timestamptz not null default now()
);

comment on table public.generations is '생성 결과 기록. asset_url 은 Storage 업로드 결과 URL.';

create index if not exists idx_generations_created_by on public.generations (created_by, created_at desc);

alter table public.generations enable row level security;
