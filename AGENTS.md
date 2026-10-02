# ToonShelf: Codex 작업 규칙

여러 플랫폼의 웹툰을 기록하고 평가하며, 리뷰와 티어리스트로 취향을 공유하는 반응형 웹 서비스다. ToonShelf는 가칭이다.

## 먼저 읽기
- 시작 안내와 실행 프롬프트: `README.md`
- 전체 범위와 요구사항 ID: `docs/01-product.md`
- 화면과 사용자 흐름: `docs/02-ux.md`
- 기술 구조와 인증: `docs/03-architecture-auth.md`
- DB, RLS, 권한: `docs/04-data-security.md`
- 저장 규칙, API 계약, 통계: `docs/05-domain-api.md`
- 구현 순서, 테스트, 운영, 공식 참고 자료: `docs/06-delivery-operations.md`

## 반드시 지킬 것
1. Next.js App Router, React, TypeScript strict, npm, Supabase를 사용한다. 다른 패키지 관리자나 별도 DB를 도입하지 않는다.
2. 현재 설치된 버전과 공식 문서를 확인하고 버전을 lockfile에 고정한다. 이 문서만 보고 오래된 API를 복사하지 않는다.
3. P0부터 P7까지가 전체 납품 범위다. 단계 구분은 작업 순서이지 뒤 단계의 기능을 생략할 근거가 아니다.
4. 로그인, 회원가입, 저장을 가짜 데이터나 localStorage만으로 완성했다고 보고하지 않는다. 실제 Supabase 연동과 권한 테스트가 필요하다.
5. 모든 입력은 서버에서 검증한다. 사용자 요청은 사용자 세션으로 DB에 접근하며, RLS와 명시적 권한 검사를 함께 적용한다.
6. 인증은 `@supabase/ssr` 기반이다. 서버에서 `getSession()` 결과만 믿지 않는다. 관리자 여부를 사용자 수정 가능 메타데이터로 판단하지 않는다.
7. 비밀 키, 비밀번호, 토큰, 비공개 메모를 브라우저 번들, 로그, 공개 응답에 넣지 않는다. 비밀 키를 사용자에게 채팅으로 요구하지 않는다.
8. 개인 별점과 기본 티어는 사용자별 작품별 한 건이다. 여러 티어표의 배치 결과를 작품 전체 통계에 중복 반영하지 않는다.
9. 티어표의 비공개 초안과 게시본은 별도 보관한다. 저장 충돌을 감지하며, 공개 전환과 해제는 권한과 캐시까지 처리한다.
10. 플랫폼 크롤링, 표지 무단 복사, 핫링크, 작품 소개문 복사를 구현하지 않는다. 기본 표지는 직접 만든 텍스트 카드다.
11. 허가된 이미지라도 화면 표시와 PNG/OG 재배포 권한을 구분한다. 성인 작품 기능은 출시 게이트를 통과하기 전 모든 경로에서 비활성화한다.
12. 공개 리뷰와 글에는 스포일러, 신고, 차단, 운영자 조치가 필요하다. 숨겨진 원문을 메타데이터나 공유 이미지에 노출하지 않는다.
13. 실제 이용자 수, 평점, 리뷰를 만들어 운영 데이터처럼 표시하지 않는다. 합성 데이터는 로컬/테스트에서만 사용한다.
14. 코드와 migration, 테스트, 해당 문서의 진행표를 함께 갱신한다. 문서를 불필요하게 추가하지 않는다.
15. 기존 파일을 파괴하거나 운영 DB를 초기화하지 않는다. 대시보드 설정이나 외부 계정이 필요한 작업은 설정 항목과 미검증 상태를 구분해 기록한다.

## 작업 완료 보고
변경 기능, 관련 요구사항 ID, 실행한 검사와 결과, 실제로 확인한 사용자 흐름, 외부 설정으로 막힌 항목, 다음 단계를 보고한다.
검사를 실행하지 못했다면 통과했다고 쓰지 않는다. 현재 단계가 끝나면 실제 진행 상태를 `docs/06-delivery-operations.md`에 기록한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## 사용자 지정 Git 규칙 (2026-10-02)

Git 저장소가 초기화된 뒤에만 다음 workflow를 적용한다. 최근 작업은 연결된 Stitch 원본 5개 화면의 HTML·이미지 재대조와 홈·탐색·작품 상세·내 서재·`/tiers` 배치 수정이다. 공식 배포 Inter·Pretendard와 라이선스를 자체 제공하며 시안 홈 배너 일러스트는 자동 승인 검토의 다운로드 거절로 별도 승인 대기다. P1~P3 코드와 이번 화면은 실행 미검증 상태이며 P4 실제 편집·저장·공유는 미착수다. P1의 실제 Supabase·메일·OAuth 연결은 사용자와 후속 공동 작업으로 진행하며 P3 잔여 범위와 P4~P7은 후속 개발이다.

- 저장소 초기화, 브랜치 생성, commit, push, tag, release, merge, rebase, PR 생성은 사용자가 **그 정확한 동작을 명시적으로 요청한 경우에만** 수행한다. 단, 커밋·push 요청에는 아래 기본 반영 순서 전체를 포함한다. 구현 요청만으로 Git 작업을 수행하지 않는다.
- 기본 Git 반영 순서: 사용자가 커밋·push를 요청하면 관련 변경을 작업 브랜치에 Conventional Commit으로 커밋 → 작업 브랜치 push → 최신 develop에 merge → develop push까지 연속 수행한다. develop 반영을 매번 다시 확인하지 않는다. 사용자가 이번 범위를 따로 지정하면 그 지시를 따른다. main 반영·릴리스·force push·PR 생성·새 브랜치 생성은 이 기본값에 포함하지 않는다. (2026-10-02 사용자 지정)
- develop은 일상 통합, main은 안정 배포 브랜치다. 명시적으로 허가된 일상 브랜치 작업은 최신 develop에서 feature/*, fix/*, docs/*, refactor/*, test/*, chore/* 중 의도가 드러나는 이름을 사용한다.
- 한 브랜치와 PR에는 한 가지 변경만 담는다. 일반 PR은 develop 대상, 안정 릴리스는 develop→main 전용 PR로 진행한다.
- develop/main 직접 커밋, force push, 공유 이력 재작성, 파괴적 Git 명령은 각각 명시적 허가 없이는 금지한다.
- Conventional Commit 형식 type(scope): subject를 사용한다. 허용 type은 feat, fix, docs, refactor, test, chore, build, ci, perf, revert다.
- push/PR 전 검사도 아래 사용자 지정 실행 규칙을 따른다. 검사 허가 없이 검사를 실행하거나 통과했다고 보고하지 않는다.
- status/diff 조회는 허용한다. git add .는 금지하며 요청된 commit 관련 파일만 stage한다. 비밀 키·로컬 env·생성된 테스트 결과·무관한 변경을 포함하지 않는다.
- 기존 dirty tree를 보존하고 브랜치 전환을 위해 변경을 버리지 않는다.

## 사용자 지정 테스트 실행 규칙 (2026-10-02)

- 테스트와 자동 검사는 사용자가 명시적으로 실행을 요청한 경우에만 실행한다. 구현, 커밋, push, PR 요청 자체는 검사 실행 허가가 아니다.
- 단위·통합·E2E·접근성·DB·회귀 테스트와 테스트를 포함하는 `npm run check` 등 복합 명령을 자동 실행하지 않는다.
- 기존 문서나 skill의 자동 테스트 지침보다 이 사용자 결정을 우선한다. 테스트를 실행하지 않은 경우 결과 보고에 미실행을 명시하며 통과했다고 쓰지 않는다.
- lint, typecheck, build, React Doctor, advisor, env 검사와 브라우저 수동·자동 검수도 자동 실행하지 않는다. 필요한 소스·문서 읽기와 코드 작성은 계속하되 실행 검증은 별도 요청을 기다린다. 테스트 파일 작성 자체는 허용한다.
