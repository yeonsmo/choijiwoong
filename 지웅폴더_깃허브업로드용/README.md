# 보험광고 법령 위반 검증 웹앱

보험광고 콘텐츠의 법령 위반 여부를 검증하고, 법령 준수 콘텐츠를 생성하는 웹 애플리케이션.
Next.js(App Router) + Supabase + Vercel 기반.

## 구현 진행 상태

| Step | 내용 | 상태 |
|---|---|---|
| 1 | Next.js + Vercel + DB 인프라 및 환경변수 구조 | 진행 중 |
| 2 | 로그인 / 3등급 권한 / 관리자 페이지 / 최고권한자 보호 | 예정 |
| 3 | 법제처 API 연동, 법령 수집, 91일 카운터 | 예정 |
| 4 | AI API 키 관리(Gemini 기본) + 단일 모델 분석 | 예정 |
| 5 | 다중 모델 토론 오케스트레이션(Cross-Examination) | 예정 |
| 6 | 생성 모델(출력 유형/키 매핑/트렌드 API) | 예정 |
| 7 | 순환 워크플로우(생성 후 재검증) | 예정 |
| 8 | 웹훅/외부 API 발행 | 예정 |
| 9 | 인스타 자동 업로드(백엔드 완전 구현, 동결) | 예정 |
| 10 | 통합 테스트 / 무료 티어 검증 | 예정 |

## 사전 준비

- Node.js 20+ (확인: 현재 환경 v26)
- Supabase 프로젝트 1개(무료 티어). URL / anon 키 / service_role 키 확보.

## 환경변수

1. `cp .env.example .env.local`
2. 값 입력. `.env.local` 은 커밋되지 않는다(`.gitignore`).
3. Vercel 배포 시 동일 키들을 Project Settings > Environment Variables 에 등록.

### 비밀키 보관 정책 (중요)

- **법제처 API 키, AI API 키(Gemini/OpenAI/Claude 등), 트렌드 API 키는 환경변수에 두지 않는다.**
  설정 메뉴에서 입력받아 DB 컬럼에 **AES-256-GCM 암호화**(`lib/crypto.ts`)하여 저장한다.
  교체·삭제·재등록이 가능해야 하기 때문이다.
- 환경변수에는 그 암호화에 쓰는 **마스터 키(`APP_ENCRYPTION_KEY`)만** 둔다.
- `NEXT_PUBLIC_` 접두어 값만 브라우저에 노출된다. service_role 키, 암호화 키 등은 서버 전용이다.
  서버 전용 모듈(`lib/env.ts`, `lib/crypto.ts`, `lib/supabase/server.ts`)은 `server-only`로 보호되어
  클라이언트 번들에 포함되면 빌드가 실패한다.

`APP_ENCRYPTION_KEY` 생성:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 폴더 구조 (Step 1 기준)

```
.
├── app/
│   ├── api/health/route.ts   # 헬스체크 + env 구성 점검(비밀값 미노출)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── crypto.ts             # DB 저장 비밀값 AES-256-GCM 암복호화 (server-only)
│   ├── env.ts                # 서버 환경변수 검증 (server-only, zod)
│   └── supabase/
│       ├── client.ts         # 브라우저 클라이언트 (anon 키)
│       └── server.ts         # 서버/관리(service_role) 클라이언트
├── .env.example
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## 로컬 실행

```
npm install
npm run dev      # http://localhost:3000
npm run typecheck
```

헬스체크: `GET /api/health` → 환경변수 설정 여부(boolean)만 반환.

## 출력 규칙

- 이모지 사용 금지.
- 모든 비밀키는 서버 사이드/암호화 컬럼에만 저장. 클라이언트 노출 금지.
- 미구현/동결 기능은 삭제하지 않고 비활성 상태로 보존.
- 미확정 값은 하드코딩하지 않고 환경변수/설정 메뉴로 외부화.
