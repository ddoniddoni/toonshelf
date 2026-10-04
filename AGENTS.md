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


## 사용자 지정 Git 규칙 (2026-10-03)

Git 저장소가 초기화된 뒤에만 다음 workflow를 적용한다. 최근 작업은 2026-10-05 P4 공개 티어 좋아요 첫 증분(TIER-10 일부/SOC-04 티어 대상) 코드 작성이다. 최신 develop에서 새 `feature/tier-likes`를 만들었다. 사용자가 2026-10-05 이번 증분의 기본 Git Flow(작업 브랜치 commit/push→최신 develop merge/push→develop에서 종료)를 요청했으며 실제 반영 결과는 Git 명령 출력과 최종 보고에서 확인한다. 공개 목록의 실제 수·상세 좋아요/취소·서버 확인 뒤 상태 갱신/응답 유실 재조회, 회원 세션·목표 boolean·자기 반응/현재 공개/차단/버전 검사, 회원 제한과 회원별 unique를 작성했다. `20261004144839_tier_likes.sql`은 첫 대상인 티어 FK만 있는 reactions의 RLS/직접 권한 제거·차단과 공유하는 사용자 쌍 잠금·양방향 반응 정리·soft delete/FK 정리를 포함한다. 수는 현재 유효한 실제 행만 집계하며 조회자의 차단 관계에 따라 달라진다. private/unlisted 전환은 반응을 보존하지만 상태/수는 숨기며 좋아요 회원 ID와 스포일러 원문을 공개 DTO로 내보내지 않는다. 좋아요 수만 바뀐 경우 OG fingerprint 충돌을 만들지 않게 조정했다. 단위/컴포넌트/액션 mock/DB rollback 테스트 파일은 작성만 했고 다중 세션 잠금·성능을 포함한 모든 실행 검수는 대기다. 앞선 TIER-11 기본 티어 가져오기/명시적 개인 평가 반영은 개인 기록·게시본을 보존하며 작업 브랜치 89c40ae와 develop merge c5084dc까지 Git Flow 반영했다. 초안/게시·PNG/분할 ZIP·OG·공개 평균 평점순 탐색·공개 서재 검색/필터·Stitch 원본 배치·Inter/Pretendard 자체 제공은 유지하며 홈 배너 일러스트는 별도 승인 대기다. P1~P4 코드·화면·migration과 모든 새 테스트는 실행 미검증이다. 실제 Supabase·메일·OAuth 연결과 서버 전용 SHARE_TOKEN_ENCRYPTION_KEY 등록은 사용자와 후속 공동 작업으로 진행한다. 다음은 공개 티어 인기순·테마 필터이며 댓글/팔로우/알림·대표 티어·리뷰/글/댓글 반응, 비회원 PNG/token·IP 제한·OG edge 제한과 허가 표지 목적별 선택은 후속이다. 미구현 tier_list_items/posts 도메인 보호, P6 보정 순위/경험별 통계와 P7의 티어/개인 보관본 export/탈퇴 정리는 유지한다.

- 공통 Git Flow 기준은 `/Users/ddoni/.codex/AGENTS.md`다. 아래 새 작업 브랜치 기본 승인은 기존의 브랜치 생성 별도 요청 규칙을 대체한 2026-10-03 사용자 결정이다.
- 새 기능·수정 등 집중된 개발 작업을 시작하면 최신 develop을 가져와 가능한 경우 fast-forward로 기준을 맞추고, 작업에 맞는 새 브랜치를 생성·전환한 뒤 구현한다. 이 준비는 개발 요청에 포함된 기본 승인으로 매번 다시 묻지 않는다. 같은 미완료 작업의 후속 수정만 현재 작업 브랜치에서 이어간다.
- 저장소 초기화, commit, push, tag, release, merge, rebase, PR 생성은 사용자가 **그 정확한 동작을 명시적으로 요청한 경우에만** 수행한다. 단, 위 작업 브랜치 준비와 아래 기본 반영 순서는 사용자가 미리 승인한 예외다. 개발 요청만으로 commit·push·PR를 수행하지 않으며 일반 작업 준비 이외의 브랜치 생성은 별도 요청을 따른다.
- 기본 Git 반영 순서: 사용자가 커밋·push를 요청하면 관련 변경을 작업 브랜치에 Conventional Commit으로 커밋 → 작업 브랜치 push → 최신 develop에 merge → develop push → develop으로 복귀까지 연속 수행한다. develop 반영을 매번 다시 확인하지 않는다. 사용자가 이번 범위를 따로 지정하면 그 지시를 따른다. main 반영·릴리스·force push·PR 생성은 이 기본값에 포함하지 않는다. (반영 순서: 2026-10-02, develop 복귀: 2026-10-03 사용자 지정)
- develop은 일상 통합, main은 안정 배포 브랜치다. 작업 브랜치는 feature/*, fix/*, docs/*, refactor/*, test/*, chore/* 중 의도가 드러나는 이름을 사용한다. 완료한 작업 브랜치는 새 작업에 재사용하지 않으며 `chore/p0-bootstrap`도 후속 기능 개발·커밋에 재사용하지 않는다.
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
