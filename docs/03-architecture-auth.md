# 03. 기술 구조와 인증

## 1. 버전과 라이브러리 정책

### Stitch 원본 재대조·화면 수정 · 2026-10-02

설치된 Next Image/CSS 안내를 읽고 기존 고정 의존성과 Server Component 구조를 재사용했다. 참조 치수와 화면별 스타일은 `src/app/stitch.css`에서 `globals.css` 뒤에 적용한다. 홈은 기존 공개 `searchWorks`로 최대 6개를 읽고 첫 작품의 `listReviews`를 읽어 제한된 공개 DTO만 표시한다. 미연결은 빈 상태, 조회 실패는 일반 안내로 처리하며 원문 오류나 합성 자료를 출력하지 않는다. `/me/library`의 `edit` query는 `none` 선택 해제 또는 서버에서 검증한 UUID만 허용하고 인증된 본인의 현재 페이지 결과에서만 선택한다. query가 없으면 현재 페이지에서 공개 메타데이터가 있는 첫 본인 기록을 선택한다. 오른쪽 패널과 작품 상세의 전체 너비 기록 입력은 기존 version 기반 `RecordForm`/저장 action을 사용한다. 작품 메타데이터는 기존 공개 상세 조회를 통과해야 표시한다.

상세의 같은 장르 목록은 기존 공개 검색에 작품의 첫 장르를 전달해 최근 등록 작품에서 현재 작품을 제외한 최대 4개를 표시한다. 이 조회 실패는 빈 안내로 처리하며 개인화 추천이나 신규 P6 집계를 제공하지 않는다. `/rankings`는 준비 안내이고 `/tiers`의 빈 보드는 저장이 없는 표현 계층이다.

Inter 4.1·Pretendard 1.3.9 폰트 원본과 라이선스를 `public/fonts`에 보관하고 `@font-face`로 자체 제공한다. 새 패키지나 런타임 CDN 호출은 추가하지 않았다. 시안의 배너 일러스트는 자동 승인 검토가 다운로드를 거절해 파일이 없으며 별도 승인 대기다. 표지 권리 proxy·세션 검증·스포일러 본문 게이트·공개 집계·private 기록 경계를 유지했다. 신규 DB/RPC/client 캐시·인증 연동·의존성은 추가하지 않았다. TypeScript/Next 컴파일·브라우저·실제 DB/저장 실행과 자동 검사는 모두 미실행이다.

### P4 비공개 티어 초안 편집 · 2026-10-03 (실행 미검증)

`/tiers/new`, `/me/tiers`, `/tiers/[id]/edit`, `/me/tiers/[id]/merges`는 동적/noindex Server Component에서 현재 계정을 확인하고 owner DAL/RPC로 읽는다. 편집기는 Client Component의 순수 배치/행/이력 연산과 메모리 상태를 사용한다. HTML Drag and Drop과 모바일 select/버튼·키보드는 같은 이동 연산을 호출하며 새 의존성은 추가하지 않았다. 공개/공유 조회·캐시·publication은 이번 증분에 만들지 않았다.

입력 이벤트에서 현재 편집 상태와 저장 revision을 함께 갱신해 React effect 이전에 도착한 응답도 새 편집을 덮지 않는다. 저장 큐는 800ms 디바운스/단일 요청/ack 버전/최신 후속 편집/충돌 정지를 처리하고 timer의 Server Action은 transition 안에서 호출한다. 저장 성공 시 owner 목록만 revalidate해 현재 편집기가 재조회로 초기화되지 않게 한다. 응답은 정규화된 draft와 현재 공개 작품 DTO/placeholder를 포함한다. 서버 오류/DB 증거는 안전한 액션 오류로 축소한다. 영구 브라우저 백업은 사용하지 않는다.

새 migration은 사용자 세션의 현재 계정 게이트와 본인 소유권 아래 전체 저장·버전 검사를 수행한다. P3 merge에 private fingerprint/소유자·draft NOWAIT 잠금/원본 archive를 확장하고 기존 개인 handler를 private으로 제한한 public wrapper로 원자성을 유지한다. 관리자 원문 접근은 부여하지 않는다. SDK는 수동 RPC 계약이며 DB 생성 타입·컴파일·브라우저·실제 저장/권한·모든 자동 검사는 미실행이다.

### P4 게시·공유 · 2026-10-04 (작성·실행 미검증)

설치된 Next Server Actions/Route Handler/Metadata/Link 문서를 읽고 기존 동적 Server Component와 사용자 세션의 no-store Supabase SDK를 사용했다. `publication-model/data/actions`는 제한된 DTO·owner/현재 계정·서버 입력 검증·RPC를 담당한다. 편집 autosave는 공개 metadata/version을 바꾸지 않는다. 게시 미리보기와 공개 설정 panel은 편집기와 별도 경로이며 저장된 초안만 서버에서 게시한다. public/unlisted 상세·목록은 현재 게시본만 조회하고 스포일러 펼치기는 명시적 action의 현재 버전 검사로 처리한다. 공유된 본문과 원격 표지 URL을 공용 cache나 metadata에 복사하지 않는다.

`share-token.ts`는 server-only Node crypto이며 32바이트 CSPRNG token을 SHA-256으로 찾고 AES-256-GCM/12바이트 nonce/16바이트 tag로 암호화해 private에 보관한다. tier UUID와 형식 버전이 AAD이고 복구 때 인증 tag와 hash를 검사한다. owner version RPC를 거쳐 주소 확인을 요청할 때만 복호화한다. 키가 없거나 32바이트 정규 base64가 아니면 발급/복구를 중단한다. 일반 public 게시와 비공개 철회는 키를 사용하지 않는다. 비밀 값을 가져오거나 등록하거나 브라우저에 전달하지 않았다.

공유 경로의 no-store/no-referrer/noindex 헤더와 Next 요청/Server Action/browser-to-terminal 로그 제외를 작성했다. 배포 프록시/CDN access log의 경로 redaction/미기록은 외부 설정 대기이며 Next 설정만으로 전체 인프라 로그 차단을 주장하지 않는다. 사용자가 이미 받은 본문/링크/복사본을 회수할 수 없고 철회는 이후 DB 요청에 적용한다. 역할은 기존 private 운영자 게이트를 재사용하며 티어 신고/감사는 private 별도 테이블, 운영 DTO는 현재 게시본/제한된 신고/감사만 제공한다. 새 의존성·테스트 실행·브라우저·DB 적용·타입 생성은 없다.

### P3 개인 기록 보존 병합 · 2026-10-03

관리자 Server Action은 현재 계정/DB 역할, UUID/version, 미리보기 토큰과 `latest_private` 정책/확인을 검증한다. 개인 내용은 SQL transaction 안에서 처리하며 RPC의 관리자 DTO는 합계와 충돌 건수로 제한한다. SQL의 SHA-256 snapshot은 private에만 보관하고 브라우저에는 무작위 관리자 전용 10분 토큰만 반환한다. 이전 6-argument `admin_merge_works`를 제거하고 토큰/정책을 포함한 단일 signature로 교체한다.

`/me/library/merges`와 관련 owner RPC는 현재 계정 자신의 원본만 제공한다. 메모는 plain text로 Server Component에서 표시하며 공유 캐시·공개 DTO를 사용하지 않는다. 병합 성공 시 홈/카탈로그/관리자/내 화면/프로필/리뷰를 revalidate한다. 서재 version과 리뷰/초안 version을 갱신하며 경합 lock은 대기 없이 전체 rollback 후 미리보기 재확인을 요구한다. 설치된 Next Server Actions/revalidatePath 안내와 Vercel React 인증/직렬화 지침을 참고했다. SDK 계약은 수동 작성 상태이고 DB 생성 타입·컴파일·실행 검증은 미실행이다.

### P3 카탈로그 평점순 · 2026-10-03

기존 Server Component 탐색·GET 폼·`/api/works/search`와 `searchWorks` DAL을 재사용한다. 입력/페이지 상한/cursor 조건을 SDK 생성 전에 검증하고 검색 결과에 별도 `CatalogueRating` public summary를 포함한다. 기본 `WorkCard`/서재/상세 DTO에는 새 필드를 요구하지 않으며 탐색만 카드의 rating prop을 전달한다. 조회는 사용자 세션의 기존 no-store SDK와 한 번의 RPC이며 작품별 추가 SDK 요청이나 공용 client 캐시를 도입하지 않았다. 필터 form key로 URL 조건이 바뀔 때 uncontrolled 입력도 새 조건을 반영하도록 작성했다.

`search_catalogue`의 argument/return JSON signature는 유지하고 migration에서 본문을 교체한다. 최근/제목 정렬은 기존 cursor v1을 유지하고 해당 page/lookahead의 평가만 집계한다. 평점순은 필터에 맞는 작품의 공개 평가를 한 번 집계하며 정렬/페이지/총수가 같은 결과 집합을 사용한다. rating cursor v2는 정수 별점 합계/평가 수/현재 조회자 ID를 사용하고 DB에서 현재 기준 작품의 공개 집계·조회자를 다시 검사한다. 새 기능의 버전을 수동 DB 계약에 반영했으며 실제 생성 타입은 아니다. 설치된 Next Promise page 안내와 Supabase 공식 functions/RLS/changelog를 읽고 고정 의존성을 유지했다. migration 적용·SQL·컴파일·브라우저·모든 테스트/자동 검사는 미실행이다.

### P3 공개 서재 검색·필터 · 2026-10-03

새 `/u/[username]/library`는 Server Component이며 Promise `params/searchParams`를 읽고 username·단일 query·페이지·조건을 서버에서 검증한다. 공개 목록과 분류 선택지는 병렬 조회한다. 필터가 있는 `getPublicLibrary`는 사용자 세션의 기존 `createClient`로 `search_public_library`를 호출하고, 필터를 전달하지 않는 기존 프로필 조회는 `get_public_library`를 유지한다. 둘 다 기존 public DTO 스키마를 사용하며 private owner DTO나 비밀 키 SDK를 사용하지 않는다. `PublicLibraryItems`는 두 화면이 같은 공개 카드·내 서재 저장 경로를 재사용하도록 분리했다.

새 migration은 별도 이름의 읽기 RPC를 추가해 기존 함수의 signature/호출을 바꾸지 않는다. 수동 `database.contract.ts`에 해당 계약만 추가했다. 쿠키별 no-store 조회와 noindex를 유지하며 client 캐시·새 의존성은 도입하지 않았다. 설치된 Next page/Promise 안내와 Supabase 공식 functions/RLS/changelog를 읽었다. DB 적용·타입 생성·컴파일·브라우저·모든 자동 검사/테스트는 미실행이다.

### P3 서재·평가 기반 · 2026-10-02

`src/lib/library/`의 Zod 입력 검증/명시적 DTO/Server Actions와 migration RPC를 연결했다. 모든 변경은 확인된 active 계정의 사용자 SDK로 호출하고 DB에서 현재 세션/동의/상태/작품 공개 조건을 다시 검증한다. 별도 service role 쓰기나 localStorage 저장을 사용하지 않는다. SSR의 기존 no-store 조회를 유지하고 저장 뒤 서재·작품 상세·공개 프로필·공개 범위 설정을 revalidate한다. Next 설치 문서의 Server Actions/revalidatePath를 읽고 기존 고정 의존성을 재사용했다. DB 생성 타입은 없으며 수동 migration 계약에 RPC만 추가했다. 테스트·컴파일·브라우저·실제 DB 실행 검증은 미실행이다.

### P3 리뷰·안전 기능 기반 · 2026-10-02

`src/lib/reviews/`에 별도의 입력/공개·본인·운영 DTO와 사용자 세션 RPC action을 작성했다. 쓰기는 확인된 active 계정과 리소스 소유권, 운영 조치는 private DB 역할을 서버·DB에서 재확인한다. 초안 저장과 게시를 분리하고 각각 draft/publication version을 검사한다. 운영 숨김은 작성자 action으로 해제할 수 없다. 추가 의존성이나 privileged 리뷰 쓰기는 도입하지 않았다.

공개 스포일러 조회는 초기 SSR/RSC payload에 본문을 넣지 않는다. `revealReviewBody`는 명시적 POST의 읽기 전용 함수이며 비회원도 현재 공개 조건·차단 관계·expectedVersion을 통과한 게시본을 읽을 수 있다. DB 쓰기나 초안 접근을 허용하지 않는다. 운영 원문 펼치기는 현재 moderator/admin 권한을 추가로 검사한다. 메타데이터는 일반 안내만 사용하며 비공개/운영/개인 목록은 noindex, 조회 SDK의 기존 no-store를 유지한다. 변경 후 리뷰·작품·프로필·본인 목록·운영 화면을 revalidate하고 차단 변경은 서재·차단 설정도 갱신한다. 이미 브라우저에 전달된 원문은 회수할 수 없다.

Supabase 공식 functions/RLS 문서와 설치된 Next Server Actions 안내를 읽고 기존 버전을 재사용했다. 수동 `database.contract.ts`에 RPC 계약을 추가했으며 실제 생성 타입은 아니다. migration 적용·컴파일·권한·모바일·브라우저와 자동 검사/테스트는 모두 미실행이다.

2026-10-01 확인한 Next.js 공식 설치 문서의 표시는 16.3.8이다. 구현 시작 시 공식 보안 공지와 npm 안정 버전을 다시 확인하고, 테스트한 버전을 `package-lock.json`에 고정한다. 실험판이나 canary를 기본 선택하지 않는다. Node.js는 24 LTS 계열을 기준으로 삼되 배포 환경 지원을 확인한다. 출처는 06 문서의 S01, S12다.

| 영역 | 선택 |
|---|---|
| 앱 | Next.js App Router, React, TypeScript strict |
| 패키지 관리 | npm, 단일 package-lock.json |
| 스타일 | Tailwind CSS, CSS 변수, 접근성 기반 headless UI 또는 shadcn/ui |
| DB/인증/파일 | Supabase Postgres, Auth, Storage |
| Supabase SDK | `@supabase/supabase-js`, `@supabase/ssr` |
| 입력 검증 | Zod, 복잡한 폼에 React Hook Form |
| 드래그 | P4 첫 증분은 기본 HTML Drag and Drop + 동일한 모바일/키보드 이동 연산, dnd-kit은 필요 시 공식 API/호환성 확인 후 도입 |
| 상태 | 서버 데이터는 Server Components/DAL, 티어 초안은 클라이언트 상태와 순수 배치/이력 연산 |
| 테스트 | Vitest, Testing Library, Playwright, Supabase 로컬 통합/RLS 테스트 |
| 이미지 생성 | OG는 Next.js ImageResponse, 전체 PNG는 제한된 서버 렌더 파이프라인 |
| 배포 | Vercel 앱 + 별도 Supabase 프로젝트, 개발/스테이징/운영 분리 |

dnd-kit의 과거 패키지와 현재 API를 섞지 않는다. 설치하는 UI/검증/테스트 패키지의 React 호환성을 P0에서 확인한다. 프로젝트가 작을 때 전역 상태 라이브러리, 별도 검색 서버, 벡터 DB, Redis를 자동 도입하지 않는다. 필요한 근거가 생기면 문서에 결정과 비용을 남긴다.

공식 문서에서 가져온 구현 지식은 S01-S17을 참조한다. 기능 수치와 도메인 규칙은 이 프로젝트의 독자적인 설계다.

## 2. 전체 구조

```text
Browser
  ├─ 공개 페이지, 폼, 티어 편집기
  ├─ Supabase browser client: 인증 세션과 필요한 구독
  └─ Next.js Server Actions / Route Handlers
       ├─ 입력 검증, 인증/권한, rate limit
       ├─ server-only Data Access Layer
       ├─ 사용자 세션 Supabase client → Postgres RLS / 제한된 RPC
       └─ 제한된 privileged client → 계정 삭제, 검증된 파일 처리, 관리 작업

Supabase
  ├─ Auth: 이메일/비밀번호, Google, Kakao
  ├─ Postgres: 공개 데이터와 개인 데이터, transaction/RLS
  ├─ Storage: 아바타, 승인된 표지, 비공개 export
  └─ Cron: 재시도 가능한 운영 작업 실행
```

일반 기능은 서버 비밀 키로 읽고 쓰지 않는다. 서버에서 호출한다는 사실만으로 관리자 권한을 쓰지 않는다. 복합 작업은 transaction을 제공하는 RPC로 묶고, 높은 권한의 함수는 허용된 용도로만 작성한다.

Server Actions도 직접 요청할 수 있는 서버 진입점으로 취급하고 입력 검증, 인증, 리소스 소유권을 다시 검사한다. 페이지/레이아웃의 로그인 검사만으로 보호했다고 보지 않는다. [S05]

## 3. 권장 디렉터리

```text
AGENTS.md
README.md
docs/
src/
  app/
    (public)/
    (member)/
    (auth)/
    admin/
    auth/callback/route.ts
    api/
    layout.tsx
    globals.css
  components/
    ui/
    work/
    library/
    tier/
    social/
  features/
    auth/
    catalogue/
    library/
    reviews/
    tiers/
    community/
    discovery/
    moderation/
  lib/
    supabase/client.ts
    supabase/server.ts
    supabase/proxy.ts
    supabase/admin.ts
    auth/
    dal/
    schemas/
    security/
    images/
    errors/
  types/database.generated.ts
  proxy.ts
supabase/
  migrations/
  tests/
  seed.sql
  config.toml
tests/
  unit/
  integration/
  e2e/
public/
  placeholders/
scripts/
```

Route Group 이름은 실제 URL에 들어가지 않는다. 그룹 간 중복 경로를 만들지 않는다. `src/app/auth` 아래에 필요한 인증 페이지를 일관되게 배치하고 callback은 전용 Route Handler로 둔다. 실제 폴더 구성은 한 번 정하고 문서를 갱신한다.

`database.generated.ts`는 migration 이후 CLI로 재생성한다. SDK 응답을 any로 우회하지 않는다. 데이터 조회/변경은 feature별 DAL로 모으고 화면 컴포넌트에 권한 정책을 흩뿌리지 않는다.

## 4. 환경변수 계약

Codex는 아래를 바탕으로 비밀 값 없는 `.env.example`을 생성한다.

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# 서버 전용. 로컬 환경에서는 해당 환경의 service-role 값으로 매핑할 수 있다.
SUPABASE_SECRET_KEY=
APP_INTERNAL_JOB_SECRET=
RATE_LIMIT_HASH_SECRET=
SHARE_TOKEN_ENCRYPTION_KEY=

# 서버에서 읽고 공개 UI에는 필요한 활성 여부만 전달한다.
AUTH_GOOGLE_ENABLED=false
AUTH_KAKAO_ENABLED=false
FEATURE_ADULT_CATALOGUE=false
DEMO_MODE=false
```

Supabase 공개 키는 접근 권한의 대체물이 아니다. 실제 보호는 DB 정책과 권한 검사에서 한다. 비밀 키는 `NEXT_PUBLIC_` 접두사를 붙이지 않으며 브라우저에서 import할 수 없는 모듈에 격리한다. 새 publishable/secret 키와 기존 anon/service-role 키 체계는 프로젝트 환경에 맞춰 확인한다. [S11]

OAuth Client Secret, SMTP 자격증명은 Supabase/공급자 관리 화면에 설정한다. Supabase CLI access token과 DB 비밀번호는 개발/CI 비밀로 관리하며 앱의 공개 환경변수로 만들지 않는다. 환경변수가 없으면 구체적인 설정 오류를 보여주고 가짜 인증으로 대체하지 않는다.

## 5. Supabase SSR 인증

브라우저용 client, 요청별 서버 client, token refresh용 Proxy, 관리자용 client를 분리한다. 서버 client를 사용자 간 전역 singleton으로 공유하지 않는다.

현재 공식 Next.js SSR 가이드에 맞춰 `@supabase/ssr`와 `proxy.ts`를 사용한다. Proxy가 갱신한 request/response 쿠키와 캐시 헤더를 최종 응답에 유지한다. `getClaims()`로 서명 검증된 신원을 사용하고, 현재 Auth 사용자 정보가 필요한 중요한 작업에는 `getUser()`를 사용한다. `getSession()`에 포함된 user만 신뢰하지 않는다. [S02]

Proxy는 세션 갱신과 UX 차원의 경로 분기만 담당한다. 권한의 최종 판단은 DAL/RPC/RLS에서 수행한다. 계정 정지와 삭제 상태는 JWT가 아니라 서버 관리 테이블을 기준으로 재확인한다.

Supabase SSR 쿠키 설정을 임의로 전부 HttpOnly로 바꾸어 브라우저 SDK 세션 처리를 깨뜨리지 않는다. provider 권장 cookie adapter를 따르고 TLS, SameSite, 안전한 토큰 취급을 적용한다. 별도의 재인증 ticket 쿠키는 HttpOnly/Secure/SameSite=Lax로 관리한다.

## 6. 인증 흐름 상세

### 6.1 이메일 가입

폼: 이메일, 비밀번호, 확인 비밀번호, 필수 서비스/개인정보 동의, 서비스의 14세 이상 이용 조건 확인. 나이 체크는 제품 가입 조건이며 법적 연령 검증을 충족한다는 뜻이 아니다. 생년월일은 기본 수집하지 않는다.

제품 비밀번호 기준은 12-128자이며 공백을 허용한다. 비밀번호를 자동 trim하지 않는다. 서버와 Supabase 비밀번호 정책을 일치시키고, 문자 조합 강제보다 충분한 길이와 유출 비밀번호 방어 설정을 우선 검토한다. 비밀번호를 DB에 직접 저장하지 않는다.

`signUp` 성공 후 이메일 인증 안내로 이동한다. 인증 전을 로그인 완료/온보딩 완료로 간주하지 않는다. Auth 사용자 생성 trigger는 최소 profile/user_settings/user_access만 생성하며 외부 API를 호출하지 않는다. trigger 실패로 가입이 막히는 경우를 테스트한다. [S03, S09]

가입 동의는 `complete_onboarding`에서 서버 검증 후 버전별로 기록한다. OAuth를 통하여 Auth 계정만 만들어진 사용자는 앱 동의를 완료하기 전 앱 쓰기를 허용하지 않는다.

### 6.2 이메일 확인

프로젝트의 이메일 템플릿은 공식 SSR 확인 흐름에 맞춰 앱의 확인 경로로 연결한다. 토큰 종류는 email/recovery/email_change 등 실제 활성화한 목적만 allowlist로 검증하고 임의 문자열을 SDK에 넘기지 않는다.

메일 보안 스캐너가 GET 링크를 미리 열 수 있음을 고려하여 `/auth/confirm`은 먼저 확인 화면을 보여주고, 사용자의 확인 POST/Server Action에서 토큰을 소비하는 흐름을 우선 구현한다. 성공하면 토큰 없는 URL로 이동한다. 만료/사용 완료 시 재발송 경로를 제공한다.

token_hash, OAuth code, recovery token을 접근 로그나 분석 도구에 남기지 않는다. 확인 페이지에는 제3자 리소스/분석 스크립트를 넣지 않고 no-store/no-referrer를 적용한다. 토큰을 React 오류 메시지에 출력하지 않는다.

### 6.3 이메일 로그인

`signInWithPassword`로 검증하고 현재 사용자/접근 상태를 확인한다. 입력 실패 메시지는 `이메일 또는 비밀번호를 확인해 주세요`로 통일한다. 필요할 때는 인증 메일 재발송 안내를 별도로 제공한다.

로그인 성공 후 검증된 내부 returnTo로 이동한다. `//evil.example`, 역슬래시, 인코딩된 우회, 외부 origin, `javascript:`를 거절한다. 기본 목적지는 `/me/library`다. 인증 경로로 다시 돌아가는 순환 리다이렉트를 차단한다.

### 6.4 Google/Kakao OAuth

Supabase의 Google과 Kakao provider를 사용한다. 공급자 콘솔에서 Supabase callback URL을 등록하고, Supabase에는 로컬/스테이징/운영의 앱 callback allowlist를 등록한다. provider 설정과 앱 redirect 설정은 서로 다른 설정이다. [S06, S07]

PKCE 코드 교환은 `/auth/callback`에서 처리한다. returnTo와 재인증 목적은 공급자가 돌려준 임의 query 값을 신뢰하지 않고 서버가 발급한 상태와 대조한다. code가 없거나 교환에 실패하면 오류 안내로 이동한다.

이메일이 없거나 확인되지 않은 공급자 응답이면 기본 앱 권한을 주지 않고 연락 이메일 확인 절차로 보낸다. `getUser()`가 확인한 이메일 상태를 사용하며 공급자 사용자 메타데이터의 임의 필드를 인증 증거로 보지 않는다.

동일 이메일 계정 처리는 Supabase의 검증된 identity 동작을 따른다. 이메일 문자열이 같다는 이유만으로 자체 SQL에서 계정을 병합하지 않는다. 계정 연결을 지원하지 않는 상황은 기존 로그인 방법 안내로 처리한다. 로그인 취소, 다른 브라우저, 기존 계정, 공급자 장애, 누락된 email scope를 검수한다.

### 6.5 온보딩

username은 소문자 영문/숫자/밑줄 3-20자다. 대소문자를 구분하지 않는 고유 제약으로 동시 등록 경쟁을 해결한다. admin, auth, api, support 등 예약어를 막는다. 닉네임은 2-30자, 소개는 최대 160자다.

관심 장르, 기본 서재 공개와 평가 공개를 선택한다. 기본값은 둘 다 private다. 프로필/동의/설정/접근 상태를 한 transaction으로 완료하고 다음 요청부터 정식 회원 권한을 부여한다.

### 6.6 비밀번호 복구

찾기 요청은 계정 존재 여부와 무관하게 같은 안내를 제공한다. Supabase의 복구 이메일을 사용한다. 검증된 recovery 토큰 소비 후에만 재설정 화면의 실제 제출을 허용한다. 단순히 URL에 `recovery=true`가 있거나 일반 로그인 상태라는 이유로 복구 권한을 부여하지 않는다. [S03]

복구 확인 시 서버가 일회용 `reauth_ticket`을 발급하고 목적 password_reset, 사용자, 현재 session_id, 짧은 만료와 연결한다. 제출 시 ticket과 현재 인증 사용자를 검증하고 소비한 뒤 Supabase의 현재 비밀번호 변경 정책을 따른다. 필요 nonce/secure password change 설정은 공식 SDK 버전에 맞게 구현한다.

### 6.7 프로필/이메일/비밀번호 변경

일반 프로필 편집은 소유권 검증으로 처리한다. 이메일 변경과 계정 삭제에는 최근 재인증을 요구한다. secure email change 설정을 사용하고 새 주소의 확인 전까지 변경 완료라고 표시하지 않는다. 이메일 변경 요청 여부를 공개 profile에 넣지 않는다.

이메일 비밀번호 사용자는 현재 비밀번호로 재검증하고, 소셜 사용자는 공급자 재인증 또는 현재 확인된 이메일의 OTP를 사용한다. 검증된 동일 사용자임을 확인한 서버만 ticket을 발급한다. JWT `iat`는 token refresh로 갱신될 수 있으므로 최근 비밀번호 입력 증거로 사용하지 않는다.

### 6.8 로그아웃과 탈퇴

로그아웃은 POST/Server Action으로 수행하며 쿠키, 사용자별 캐시, 로컬 편집 임시 저장을 정리한다. 전역 로그아웃은 refresh 세션 철회와 기존 access token의 만료를 구분해서 설명한다. 기존 토큰이 즉시 모두 무효화된다고 주장하지 않는다. [S10]

탈퇴는 04 문서의 다단계 삭제 작업을 사용한다. 활성 토큰이 남아도 user_access의 deleting 상태로 DB 접근과 공개 콘텐츠 노출을 차단한다. Storage 소유 파일 처리를 포함하며 인증 계정만 먼저 삭제하고 끝내지 않는다. [S09]

## 7. 서버 데이터와 캐시

공개 작품 메타데이터는 짧게 캐시할 수 있다. 초기 구현에서는 공개 UGC, 공개/비공개 전환되는 사용자 데이터, 알림, 비교, 인증/설정 응답에 persistent cache를 적용하지 않고 no-store로 시작한다.

사용자 응답을 전역 키로 캐시하지 않는다. 쿠키나 Set-Cookie가 포함된 인증 응답을 CDN 공개 캐시로 보내지 않는다. 로그아웃/다른 계정 로그인 후 이전 사용자 데이터가 남는지를 테스트한다. [S02]

후속 최적화는 public-only projection과 명시적 cache tag 무효화가 갖춰진 경우에만 허용한다. 삭제, 정지, 비공개, 권리 철회는 모든 관련 목록/상세/OG/내보내기에서 확인해야 한다. 검색봇의 외부 캐시는 완전 회수를 보장할 수 없다.

## 8. 검색과 페이지네이션

### P2 작성 계약 · 2026-10-02

`20261001174303_catalogue.sql`과 `src/lib/catalogue/`를 작성했다. `search_catalogue`는 공개 조건을 명시적으로 확인하는 제한된 DTO RPC다. 정규화된 제목/별칭/역할별 작가·필명에 pg_trgm 인덱스를 두고 LIKE의 %/_를 escape한다. 플랫폼/요일은 같은 유효 링크에 적용한다. 제목순 또는 (created_at,id) 최근 등록순 keyset이며 cursor는 필터 fingerprint와 위치를 담는다. fingerprint는 무결성 서명이 아니라 조건 변경 감지용이다. 조작한 cursor도 공개 조건을 완화하지 못한다.

페이지 크기는 24, 최대 50이며 자동완성 HTTP 경로는 8개를 반환한다. 입력·배열·페이지 크기를 서버/DB에서 제한하고 search RPC에 statement timeout을 지정했다. 라이브 세션에는 DB 사용자별 120회/분 제한을 작성했다. 비회원 IP 기준 외부 edge 제한은 아직 구현·설정하지 않았으며 P7 운영 검수에서 필요하다. 단문 검색 성능/실제 쿼리 계획은 미검증이다.

관리자 페이지와 action은 사용자 SDK와 역할 확인 RPC를 사용하고 DB 함수도 실제 세션·확인된 이메일·active 상태·현재 동의·private 역할을 재검사한다. 사용자 메타데이터나 UI 상태로 역할을 부여하지 않는다. 초기 관리자 지정은 사용자와 DB 연결 후 별도 운영 절차로 진행한다.

표지 파일은 직접 업로드한 허가 이미지에 한정한다. MIME/이미지 디코딩/16MP·2MB/정지 프레임 검사 후 900×1350 안에 WebP로 재인코딩하여 private bucket에 저장한다. Storage 업로드/다운로드만 서버 전용 privileged SDK를 사용하고 권리 등록·활성화·철회는 사용자 세션 RPC로 처리한다. 실제 Storage metadata 및 정책 동작은 미검증이다. 표시 proxy는 Storage I/O 전후 현재 허가와 작품 공개를 검사하고 no-store를 사용한다. OG/export renderer는 각 목적의 별도 helper를 호출해야 하며 상업적 이용은 공개 운영 정책과 함께 판단해야 한다.

Next 설치 버전의 page/searchParams/Route Handler/metadata 안내와 Supabase의 [RLS 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control), PostgreSQL [pattern matching](https://www.postgresql.org/docs/current/functions-matching.html)을 참고했다. 패키지 추가/업데이트나 실행 검사는 이번 작업에서 하지 않았다.

Postgres `pg_trgm`과 정규화 검색 문자열로 시작한다. 작품 제목, 별칭, 작가 이름을 공백/영문 대소문자 정규화한 검색 대상에 넣고, parameterized query/RPC로 검색한다. trigram 인덱스는 LIKE/ILIKE와 유사도 검색에 활용할 수 있으나 한/두 글자 검색은 별도 성능 검수가 필요하다. [S13]

페이지 크기 기본 24, 최대 50. 피드/댓글/알림은 `(created_at,id)` cursor를 사용한다. 순위와 인기 정렬에는 `(score,id)`와 계산 기준 시각을 포함해 중복/누락을 줄인다. 임의 전체 테이블 다운로드 후 브라우저에서 검색하지 않는다.

## 9. 업로드와 이미지 렌더

아바타는 JPEG/PNG/WebP만 받으며 최대 2MB, 디코딩 후 픽셀 수 상한을 적용한다. 원본 EXIF 제거와 안전한 재인코딩을 거쳐 UUID 파일명으로 저장한다. SVG, HTML, GIF, 외부 이미지 URL 업로드는 받지 않는다. 확장자와 MIME만 믿지 않는다.

표지는 관리자만 권리 근거와 함께 올린다. 원격 URL을 서버가 임의로 가져오는 기능을 만들지 않아 SSRF를 줄인다. 이미지 최적화 remotePatterns는 검증된 Storage 경로만 허용하고 전체 인터넷 wildcard를 사용하지 않는다.

OG는 공개 게시본을 바탕으로 생성하고 원본 표지를 직접 긁지 않는다. 전체 PNG는 서버가 검증한 작품/허가 자산만 렌더한다. 페이지당 최대 60작품, 최대 높이 8000px, 동시 생성과 요청 횟수를 제한한다. 큰 표는 여러 PNG를 ZIP으로 묶는다. 생성 직전에도 게시 접근 권한과 자산 export 허가를 확인한다.

서버에서 사용 가능한 한글 폰트를 준비하고 라이선스 및 배포 허용을 기록한다. 사용자 입력은 escape된 텍스트로만 렌더하고 SVG 마크업/URL/CSS를 직접 주입하지 않는다.

## 10. 운영 작업

`private.operation_jobs`를 작업 원장으로 사용하고 Supabase Cron이 보호된 `/api/internal/jobs` POST 경로를 호출하는 방식을 기준으로 구현한다. 내부 secret은 Vault 또는 배포 비밀로 저장하고 일반 사용자 요청과 분리한다. Supabase Cron은 SQL 및 HTTP 작업을 실행할 수 있다. [S14]

작업은 계정 삭제, 대량 데이터 export, 만료 자산 정리, 고아 파일 청소를 처리한다. 작업 claim은 잠금과 lease를 사용하고 idempotency key, 재시도 횟수, next_run_at, 실패 상태를 둔다. 서버리스 요청을 끝낸 뒤 실행될지 모르는 fire-and-forget 작업으로 만들지 않는다.

추천은 초기에는 제한된 실시간 SQL로 계산한다. 사용자 쌍 전체를 전수 계산하는 일괄 작업이나 머신러닝 파이프라인은 기본 구축하지 않는다.


## P0 구현 메모 · 2026-10-02

아래 P0 기록은 당시 상태다. 이후 P1 구현 내용은 다음 절을 따른다.

- 실제 사용 버전은 package.json/package-lock.json 및 README 실행 안내를 기준으로 한다. Node 24.21.0 검수, Next 16.3.8, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3.
- 홈은 src/app/page.tsx에 두고 아직 route group을 만들지 않았다. P0에 필요한 공통 컴포넌트와 SDK 모듈만 생성했다.
- APP_ENV=local/staging/production을 추가했다. 원격 환경은 HTTPS site/Supabase 주소가 필요하다. .env.local은 로컬 전용이며 staging/production 예제는 배포 변수 작성용이다.
- getServerEnv는 server-only로 격리한다. 공개 키 자리에 sb_secret/service_role 키를 넣으면 오류를 발생시키고 값은 메시지에 포함하지 않는다.
- SDK 클라이언트·SSR Proxy를 준비했다. Proxy에서 getClaims를 사용하고 연속 setAll의 쿠키와 cache-control/expires/pragma를 보존한다. 미설정일 때 P0 공개 화면만 실행되며 클라이언트 생성은 실패한다.
- 실제 Auth·권한·private 데이터 경로는 아직 없다. P1에서 DB 생성 타입을 클라이언트 generic에 연결하고 DAL/RLS/동의/접근 상태 검사와 no-store 정책을 추가해야 한다. 원래 admin.ts는 P0에 사용처가 없어 생성하지 않았다.
- Supabase CLI 2.119.0으로 init/migration new를 실행했다. CLI가 생성한 현재 local_smtp 설정 이름을 사용한다. 테스트 메일함 55324, 이메일 확인/secure password change 활성, 비밀번호 최소 12자, 재발송 60초로 준비했다. P1의 앱 확인 페이지와 메일 템플릿은 아직 미구현이다.
- 2026-10-01 Supabase changelog를 확인했다. 자동 API 권한 변경을 반영해 public만 노출하고 auto_expose_new_tables=false를 설정한다. 9월 Postgres minor 변경은 기존 ltree/pgcrypto 데이터가 없는 신규 P0에는 마이그레이션 영향이 없다. 원격 서버 반영/버전 확인은 아직 수행하지 않았다.
- dev/build는 이 실행 환경의 Turbopack CSS worker 포트 오류 때문에 공식 Webpack 모드를 사용한다.

## P1 구현 메모 · 2026-10-02

- `src/lib/auth/`에 Zod 검증, 사용자 세션 DAL, 인증/설정 Server Actions, 재인증·아바타 처리를 추가했다. 이메일 및 OAuth 로그인은 공통 `signIn` 서버 진입점을 사용한다. 액션에서 권한을 재확인하고 실제 Auth 사용자는 `getUser()`, session_id는 검증된 `getClaims()`로 확인한다.
- P1 SDK generic은 실제 migration 계약을 손으로 작성한 `database.contract.ts`다. DB 타입 생성/비교는 Docker 대기이며 `.generated.ts`로 위장하지 않는다. 실제 생성 후 SDK generic 교체가 필요하다.
- `admin.ts`는 server-only이며 증명 발급 및 검증된 아바타 처리만 사용한다. 32바이트 난수 ticket의 SHA-256 hash를 DB에 저장하고 원문은 HttpOnly/Secure(HTTPS)/SameSite=Lax 쿠키에만 둔다. 만료 10분, 목적/사용자/현재 session_id 바인딩, DB 원자적 1회 소비를 사용한다.
- recovery proof는 확인 POST에서 실제 recovery 토큰 검증 후에만 발급한다. 계정 변경 proof는 별도 Auth 클라이언트에서 비밀번호 또는 OTP를 검증하고 동일 사용자 ID를 대조한 뒤 발급한다. 일반 로그인, URL의 recovery 플래그, JWT iat로 proof를 발급하지 않는다. Supabase secure password change의 nonce 요청/입력도 제공한다.
- OAuth는 PKCE와 임의 nonce를 HttpOnly flow 쿠키에 묶고 callback query의 flow와 비교한다. cookie에 보관한 returnTo도 다시 검증하며 callback query에서 재인증 목적을 받지 않는다. 확인된 이메일이 없는 계정에는 온보딩/앱 쓰기를 허용하지 않는다. 이메일 자체가 누락된 pending 계정만 최초 연락 이메일을 등록할 수 있다.
- Auth 메일 템플릿 4개를 로컬 config에 연결했다. confirm GET은 소비하지 않으며 토큰 allowlist/POST 확인 후 토큰 없는 URL로 이동한다. 개발 요청 로그에서 `/auth`를 제외하고 Server Function 인자 로그/브라우저 로그 전달을 끈다. 배포 CDN/프록시/접근 로그에서도 query와 요청 body의 토큰·비밀번호 제거 설정이 필요하다.
- 요청별 SDK fetch와 인증/설정 응답은 no-store다. 기본 테마는 계정 DB 설정에서 읽고 기기 테마 UI에 반영한다. 테마 외 인증/프로필 저장을 localStorage로 흉내 내지 않는다.
- APP_ENV/실제 로컬 DB 호스트를 확인해 로컬 가입을 허용한다. 원격은 AUTH_REGISTRATION_ENABLED를 명시해야 앱 가입/OAuth 진입이 열린다. Supabase 자체 signup/provider 활성화와 확정 운영 정책은 별도 설정이며 앱 플래그만으로 Auth API가 차단된다고 주장하지 않는다.
- Sharp 0.35.5를 직접 의존성으로 고정했다. 아바타 입력은 2MB/16M pixels/JPEG·PNG·WebP, 단일 프레임만 허용한다. 디코딩한 형식과 MIME을 대조하고 회전·최대 512px·WebP 재인코딩으로 메타데이터를 제거한다. Server Action body limit은 multipart 여유를 포함해 3MB다.
