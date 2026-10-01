# ToonShelf 개발 문서

**문서 버전:** 1.1 / **갱신일:** 2026-10-02 / **상태:** P0 코드 구성, 로컬 DB 검증 대기

ToonShelf는 가칭이다. 상표나 도메인의 사용 가능성을 확인한 이름이 아니다.

## 만들 서비스

네이버웹툰, 카카오웹툰, 카카오페이지, 탑툰 등 여러 플랫폼의 작품을 한곳에서 찾고, 개인 서재에 기록하고, 별점과 리뷰를 남기고, 티어리스트를 저장해 공유하는 서비스다. 팔로우, 커뮤니티, 취향 비교, 설명 가능한 추천을 포함한다. 원문 웹툰을 제공하는 뷰어가 아니다.

**기술:** Next.js App Router + React + TypeScript + npm + Supabase Auth/Postgres/Storage. 기본 배포 대상은 Vercel이다. 이는 설계 선택이며 특정 유료 요금제나 무상 운영을 보장하지 않는다.

원본 다운로드 자료는 문서만 포함했다. 이 프로젝트에는 사용자가 선택한 **P0 기반 코드**를 추가했다. API 키나 외부 서비스 계정은 포함하지 않는다. P1~P7 기능은 아직 구현하지 않았다.

## 지금 실행하기 (P0)

```bash
cd /Users/ddoni/dev/toonshelf
# Node.js 24 LTS 권장 (.nvmrc). npm 11 이상.
npm ci
npm run dev
```

기본 주소는 `http://localhost:3000`이다. 공개 미리 보기는 환경변수 없이 실행된다. 회원가입, 로그인, 검색, 저장 기능은 P1 이후 구현 대상이며 준비 중 화면으로 표시한다. 데이터 조회를 흉내 내거나 합성 작품/평점을 보여주지 않는다. 테마 선택만 기기에 보관한다.

- Next.js 16.3.8, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3, Supabase JS 2.117.2 / SSR 0.12.7 / CLI 2.119.0을 lockfile에 고정했다.
- Node.js 24.21.0에서 검증한다. 기존 시스템 Node.js 26도 package engines에 허용하지만 이번 검수 기준은 24 LTS다.
- 이 실행 환경에서 Turbopack의 PostCSS 작업 프로세스가 포트 바인딩 오류로 실패하여 `dev`/`build`는 공식 지원 `--webpack`을 사용한다.
- TypeScript 7 / ESLint 10은 현재 Next.js의 일부 lint 플러그인 peer 범위 밖이라 TypeScript 6.0.3 / ESLint 9.39.5를 사용한다. ESLint 9는 지원 종료 경고가 있으므로 Next lint 플러그인의 ESLint 10 호환이 확보되면 함께 업데이트한다. 현재 npm audit의 알려진 취약점은 0건이다.

## 로컬 Supabase 준비

현재 머신에서 Docker를 찾지 못해 **DB 시작·reset·migration 적용·pgTAP·타입 생성은 미검증**이다. Docker 호환 런타임을 설치하고 엔진을 실행한 뒤 다음 순서로 진행한다.

```bash
cp .env.example .env.local
npm run db:start
npm run db:status
# status의 로컬 API URL / publishable key (또는 anon key)를 .env.local에 입력
npm run env:check
npm run db:reset   # 로컬 데이터만 삭제·재생성하는 명령
npm run test:db
npm run db:types
```

포트: API 55321, Postgres 55322, Studio 55323, 로컬 메일함 55324. 프로젝트 ID는 `toonshelf`이다. API에는 `public`만 노출하며 자동 테이블 권한을 끈다. migration은 도메인 enum 및 private 스키마 권한 기반만 만들고, P1 사용자 테이블·RLS·Auth trigger는 아직 만들지 않았다. seed는 의도적으로 비어 있다.

DB 명령은 `APP_ENV=local`만 허용한다. 원격 URL, linked 프로젝트, 추가 인자(`--linked`, `--db-url` 등)가 감지되면 실행 전에 실패한다. 타입 생성 실패 시 기존 파일은 보존한다. `database.generated.ts`는 실제 로컬 DB에서 생성하기 전까지 만들지 않는다.

스테이징/운영에는 `.env.staging.example` / `.env.production.example`을 참고해 각각 별도 Supabase 프로젝트와 HTTPS 주소를 설정한다. 예제 파일은 자동 로드하지 않는다. 배포 플랫폼에서 환경변수를 설정하고 `npm run env:check`로 검증한다. 비밀 값은 커밋하거나 채팅으로 전달하지 않는다. P0에는 privileged/admin client가 없으며, 뒤 단계용 서버 비밀 변수는 예제의 빈 자리만 제공한다.

## 검증 명령

```bash
npm run check       # lint + typecheck + unit/adapter tests + production build
npx playwright install chromium
npm run test:e2e    # 360 / 768 / 1280px 브라우저 흐름
npm run test:a11y   # 라이트 / 다크, 홈 / 준비 중 화면의 WCAG AA 자동 검사
npm run test:db     # 실제 Docker/Supabase 필요. check에 포함되지 않음
```

`check`에는 DB, E2E, 접근성 검사가 **포함되지 않는다**. 자동 접근성 통과는 전체 수동 접근성 검수나 P7 완료를 뜻하지 않는다. SSR cookie adapter 테스트는 mock 기반이며 실제 로그인 검증이 아니다. 전체 진행과 검수 기록은 [06 문서](docs/06-delivery-operations.md)에 기록한다.

테스트는 사용자가 명시적으로 실행을 요청할 때만 실행한다. `npm run check`도 테스트를 포함하므로 자동 실행하지 않는다. lint/typecheck와 build는 별도로 실행할 수 있다. 자세한 실행 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

원본 문서는 보존했으며 다음의 전체 기능 명세는 이후 작업의 설계 자료다. 아래 예시 프롬프트 자체가 추가 실행이나 Git 작업에 대한 허가를 뜻하지 않는다. P0 기반 구축 당시에는 Git을 초기화하거나 커밋하지 않았다.

## Git workflow

원격 저장소는 `https://github.com/ddoniddoni/toonshelf.git`이다. `main`은 안정 릴리스, `develop`은 일상 통합 브랜치이며 작업 브랜치는 최신 `develop`에서 시작한다. 일반 PR은 `develop`, 릴리스 PR은 `develop` → `main`으로 진행한다.

빈 저장소의 초기 기준 커밋에는 파일을 넣지 않으며, `main`과 `develop`은 그 기준에서 시작한다. P0 파일은 `chore/p0-bootstrap`에 별도로 커밋한다. 이후 통합이나 릴리스는 별도 요청에 따라 진행한다. Git 동작별 명시 요청 규칙과 Conventional Commits 형식은 [AGENTS.md](AGENTS.md)를 따른다.

## 문서 구성

| 파일 | 내용 |
|---|---|
| [AGENTS.md](AGENTS.md) | Codex가 작업마다 따라야 할 핵심 규칙 |
| [01-product.md](docs/01-product.md) | 전체 기능, 범위, 공개 정책, 요구사항 ID |
| [02-ux.md](docs/02-ux.md) | URL, 화면 구성, 모바일, 주요 사용자 흐름 |
| [03-architecture-auth.md](docs/03-architecture-auth.md) | 기술 구조, 인증 상세, 환경변수, 캐시와 업로드 |
| [04-data-security.md](docs/04-data-security.md) | 테이블, 제약조건, RLS, Storage, 권한과 탈퇴 |
| [05-domain-api.md](docs/05-domain-api.md) | API 계약, 트랜잭션, 티어 편집, 통계와 추천 수식 |
| [06-delivery-operations.md](docs/06-delivery-operations.md) | P0-P7 구현 순서, 검수, 배포, 운영, 공식 출처 |

하나의 기능을 변경할 때 관련 문서의 내용도 함께 수정한다. 충돌 시 데이터와 보안 규칙은 04 문서, 계산과 저장 계약은 05 문서를 기준으로 해결하고 다른 문서를 정정한다. 최신 사용자 결정은 기존 설계를 대체할 수 있으나 보안과 권리 제한을 임의로 없애지 않는다.

## 사용 방법

새 프로젝트 폴더에 이 압축 파일을 풀고, 그 폴더를 Codex에서 연다. 프로젝트 루트에 `AGENTS.md`, `README.md`, `docs/`가 있어야 한다. 애플리케이션이 이미 있다면 같은 위치에 문서를 추가하고 기존 코드를 보존한다.

이후 아래 프롬프트를 입력한다. P0에는 문서가 있는 비어 있지 않은 폴더에서 안전하게 Next.js를 초기화하는 작업도 포함된다.

```text
AGENTS.md와 README.md를 먼저 읽고 docs의 01부터 06까지 문서를 확인해.
이 프로젝트는 ToonShelf라는 가칭의 웹툰 기록, 리뷰, 티어 공유 서비스야.
Next.js App Router, TypeScript, npm, Supabase로 실제 작동하는 서비스를 구현해.

전체 기능은 P0부터 P7까지 모두 구현 대상이지만, 이번 작업은 P0와 P1부터 진행해.
기존 파일과 문서를 보존하고, 인증 UI만 있는 목업으로 끝내지 마.
회원가입, 이메일 인증, 로그인, 비밀번호 재설정, 온보딩을 실제 Supabase와 연결하고
Google과 카카오 로그인은 공식 흐름에 맞게 구현해.

현재 코드와 환경을 확인한 뒤 필요한 migration, RLS, 테스트를 함께 작성해.
사용자가 대시보드에서 해야 하는 설정은 정확한 항목으로 정리하되,
비밀 키를 채팅으로 요청하거나 코드에 하드코딩하지 마.
외부 설정이 없어 검증할 수 없는 기능을 가짜 성공 처리하지 마.

완료한 요구사항 ID, 실행한 검사 결과, 실제로 검증한 흐름, 막힌 항목을 보고하고
진행 상태를 docs/06-delivery-operations.md에 기록해.
```

다음 작업을 이어갈 때:

```text
AGENTS.md와 docs/06-delivery-operations.md의 실제 진행 상태를 읽어.
미완료된 가장 앞 단계를 이어서 구현하고 해당 단계의 완료 기준까지 검증해.
직전 단계의 회귀 테스트도 실행해.
문서에만 있고 구현되지 않은 기능, 목업, TODO를 완료로 취급하지 마.
이번에 끝나지 않은 항목은 구체적으로 남겨.
```

## 전체 납품 범위

| 단계 | 결과물 |
|---|---|
| P0 | 프로젝트, 디자인 토큰, Supabase 로컬 환경, 테스트 기반 |
| P1 | 회원가입, 인증, 계정 관리, 온보딩, 프로필, 기본 보안 |
| P2 | 작품 카탈로그, 검색, 필터, 관리자 등록, 권리 관리 |
| P3 | 개인 서재, 별점, 기본 티어, 리뷰, 스포일러, 신고 |
| P4 | 티어 편집기, 자동 저장, 공개/링크 공개/비공개, URL 및 PNG 공유 |
| P5 | 팔로우, 피드, 커뮤니티 글, 댓글, 좋아요, 알림, 차단 |
| P6 | 순위, 취향 분석, 취향 비교, 관련 작품 추천 |
| P7 | 관리자 운영, 데이터 내보내기, 탈퇴 완결, 접근성, 성능, 배포 검수 |

P0-P3은 제한된 내부 알파 테스트가 가능한 시점이다. 사용자가 요청한 기능이 전부 갖춰진 버전은 P7까지 통과해야 한다.

## 처음부터 정해 둔 중요 결정

- 작품 표지 없이도 모든 핵심 기능이 동작한다. 허가받은 표지는 나중에 등록할 수 있다.
- 별점은 0.5부터 5.0까지 0.5 단위이고, 미평가는 별도 상태다.
- 기본 티어는 S/A/B/C/D/F다. 별점과 티어를 강제로 서로 변환하지 않는다.
- 개인 평가와 공유용 티어표는 분리한다. 한 사람이 여러 표를 만들어도 작품 통계에는 한 표만 반영한다.
- 서재와 개인 평가의 기본값은 비공개다. 리뷰와 커뮤니티 글은 게시 전에 공개 여부를 분명히 알린다.
- 공유용 티어표는 비공개 초안으로 시작한다. 게시본은 초안 자동 저장과 분리한다.
- 계정은 이메일/비밀번호와 Google, Kakao 로그인을 지원한다. 실제 공급자 설정은 사용자가 완료해야 한다.
- 실서비스에서 합성 작품과 합성 이용자를 실제 데이터처럼 표시하지 않는다.
- 한국어 우선, 모바일 우선 반응형 웹이다. 네이티브 앱, 결제, 원문 뷰어는 이번 범위가 아니다.

## 사용자가 준비해야 하는 외부 설정

Supabase 프로젝트와 공개 키, 배포 환경의 서버 비밀 키, Google/Kakao OAuth 설정, 운영 도메인과 허용 Redirect URL, 실제 인증 이메일 발송을 위한 SMTP 설정이 필요하다. 개발 중에는 Supabase 로컬 환경과 테스트 메일함으로 이메일 흐름을 검증할 수 있다.

플랫폼에서 표지를 가져오는 비공식 API나 무단 크롤링은 준비 사항이 아니다. 실제 작품은 관리자가 검증한 사실 정보와 공식 링크로 등록한다. 권리 허가가 없는 이미지는 넣지 않는다.

상세 설정, 테스트, 공개 출시 전 별도 확인 사항은 03과 06 문서를 따른다.
