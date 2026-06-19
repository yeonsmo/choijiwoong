-- =============================================================================
-- 0001_init_auth_roles.sql
-- 보험광고 법령 검증 웹앱 - 인증/권한 기반 스키마 (Step 2)
--
-- 실행 방법:
--   Supabase 대시보드 > 좌측 SQL Editor > New query > 이 파일 전체 붙여넣기 > Run
--   (한 번만 실행하면 됩니다. 재실행해도 안전하도록 idempotent 하게 작성됨.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: 로그인 계정의 권한/상태 마스터.
--   auth.users(Supabase Auth) 와 1:1. 비밀번호/세션은 Supabase Auth가 관리.
--   여기서는 역할(role)과 활성상태(status)만 관리한다.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null default 'USER' check (role in ('USER', 'ADMIN', 'SUPER')),
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISABLED')),
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is '로그인 계정 권한/상태. 모든 쓰기는 서버(service_role)에서 권한 검증 후 수행.';

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- current_user_role(): 현재 로그인 사용자의 역할을 반환 (SECURITY DEFINER).
--   RLS 정책 안에서 profiles 를 직접 조회하면 무한 재귀가 발생하므로,
--   RLS를 우회하는 이 함수를 통해 역할을 조회한다. 이후 단계의 다른 테이블
--   RLS 정책에서 재사용한다.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RLS: 기본 거부. 본인 프로필만 조회 가능.
--   쓰기(insert/update/delete)는 어떤 일반 사용자에게도 허용하지 않는다.
--   계정 생성/수정/삭제는 전부 서버의 service_role 경로(권한 검증 후)로만 수행.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  using (auth.uid() = id);

-- insert/update/delete 정책을 일부러 만들지 않는다 => 일반 클라이언트는 전면 차단.
-- service_role 키를 쓰는 서버만 RLS를 우회하여 쓰기 가능.

-- ---------------------------------------------------------------------------
-- system_settings: 시스템 핵심 설정(예: 법제처 API 키 등은 별도 암호화 테이블).
--   여기서는 단순 key-value 설정. 최고권한자 설정 보호는 API 레벨에서 강제.
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now()
);

comment on table public.system_settings is '시스템 설정 key-value. 쓰기는 서버 권한 검증 후 service_role로만.';

alter table public.system_settings enable row level security;
-- 읽기/쓰기 모두 정책 없음 => 클라이언트 직접 접근 차단. 서버(service_role)만 접근.

drop trigger if exists trg_system_settings_updated_at on public.system_settings;
create trigger trg_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();
