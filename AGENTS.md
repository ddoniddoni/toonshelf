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

Git 저장소가 초기화된 뒤에만 다음 workflow를 적용한다. 최근 작업은 2026-10-07 아이디/비밀번호 즉시 가입·로그인과 공유 Supabase toon_ 분리(AUTH-01/03/06/07/10) 코드·원격 DB 설치다. 이전 댓글은 feature e95537a/develop merge 9c52e6b로 push 후 develop에서 종료했고 이번 개발은 최신 develop 기반 feature/username-auth-shared-supabase에서 수행했다. 2026-10-07 사용자 요청에 따라 feature 5a774c2와 develop merge 11d13d2를 push하고 develop에서 종료했다. 사용자 선택 대상 zwzncrdlqnthxgdvsqxq에 MCP/env URL을 맞추고 reload 후 실제 연결과 기존 여행 앱 테이블 6개·이력 12개·Auth trigger·ACL·Storage·extension을 read-only로 확인했다. ToonShelf 설치가 없는 상태에서 17개 SQL source를 한 트랜잭션의 MCP migration toon_shared_project_username_auth로 적용해 success:true를 받았다. 첫 creators_read의 creators.id 오류는 toon_creators.id로 수정했고 재개 inventory/재적용 성공을 기록했다. 원격 설치 이력 한 건과 로컬 17개 파일 version은 다르므로 shared linked CLI push/reset/전체 seed는 금지하고 후속 변경은 새 migration으로 작성한다. 기존 여행 Auth 기본 프로필 트리거는 유지해 공유 Auth 새 계정에 여행 기본 프로필도 생성되는 구조이며 Toon 회원/동의/역할은 별도 toon_private 데이터로 검사한다. 여행 정책/함수/데이터 및 공용 Auth 설정은 수정하지 않았다. 이전 mwepkrdlvdreoojrqegr 고객센터는 조회만 했고 전용 수정 후보는 제거했으며 적용하지 않았다. 서버 admin createUser(email_confirm:true)/server-owned marker 조건부 trigger가 아이디·기본 private 설정·필수 동의를 원자 생성하고 SSR 실제 사용자 세션을 쓴다. 다른 Auth 사용자 backfill/자동 toon 회원 생성·editable metadata 역할 승인은 없다. 내부 주소는 메일 발송/공개 연락처에 사용하지 않고 현재 비밀번호를 동일 사용자로 재검증해 변경한다. 제공된 키는 ignored .env.local(0600), .env.example은 빈 예시다. 사용자 요청 전까지 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저/DB 권한 검수·타입 생성은 모두 미실행이며 실제 확인한 Auth 흐름은 없다. 새 user/작품 seed도 생성하지 않았다. 다음은 사용자의 검수 요청에 따라 실제 Auth/권한·공유 앱 영향·타입/검사를 진행하는 것이며 연락 이메일/비로그인 복구·OAuth/SMTP와 P3~P7 잔여 기능은 후속이다. P7 앱 탈퇴와 공유 Auth 사용자 삭제가 다른 앱 데이터/세션에 미치는 영향은 구분해서 설계해야 한다.

2026-10-07 후속은 공개 티어 댓글 가중 최근 7일 인기(TIER-10)다. 최신 develop 기반 새 feature/tier-comment-popularity에서 작성했고 이전 fix/remove-weekday-menu의 미커밋 navigation/UX/진행 기록을 그대로 보존했다. 새 20261007070457_tier_comment_popularity.sql만 선택한 zwzncrdlqnthxgdvsqxq에 MCP toon_tier_comment_popularity로 추가 적용해 success:true를 받았다. 기존 17개 baseline·공용 Auth/여행 앱·공용 default privileges는 변경하지 않았다. 최근 유효 좋아요+2×서로 다른 댓글 참여자, 기존 토론/부모/계정/차단 경계와 DTO/UI를 연결했으며 대표 티어의 카드 계약은 별도 유지했다. 테스트 파일은 작성만 했고 자동 검사·타입 생성·브라우저/DB 권한·부하 검수와 실제 사용자 흐름은 모두 미실행이다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 하지 않았다. 2026-10-07 사용자가 여기까지 기본 Git Flow를 요청해 메뉴 수정과 인기순을 각 작업 브랜치의 별도 커밋/push 뒤 최신 develop에 merge/push하고 develop에서 종료한다. 실제 반영 결과는 Git 이력으로 확인하며 검사 허가는 포함하지 않는다. 다음은 SOC-02 팔로우/해제·목록·차단 관계 정리, 그다음 피드/알림이며 기존 잔여 범위는 유지한다.

2026-10-07 최신 작업은 SOC-02 팔로우/해제·공개 목록과 SOC-06 관계 정리다. 메뉴 d9b0311/merge d8aa65a, 인기 99a1d5a/merge 6138d89를 push하고 develop에서 종료한 뒤 fetch/fast-forward 기준 새 feature/user-follows에서 작성했다. 새 20261007092113_user_follows.sql만 선택한 zwzncrdlqnthxgdvsqxq에 MCP toon_user_follows로 추가 적용해 success:true를 받았다. 첫 후보는 기존 차단 함수의 반응 삭제를 포함한 자동 승인 검토로 거절됐고 최종은 기존 block 함수를 건드리지 않는 follows 정리 BEFORE INSERT trigger다. follows raw SELECT/DML은 RLS/revoke, 공개 제한 RPC·현재 회원의 목표 상태 저장, 양쪽/조회자 활성·동의·차단, pair mutex·중복/본인 방지·20명 페이지를 연결했다. 팔로우 제한 30회/600초, 기존 차단 30회/60초와 티어 좋아요 정리는 유지하며 차단 제한 통일은 후속이다. 코드/SQL 18번·단위/action/UI 검사 파일만 작성했고 테스트·lint/typecheck/build·React Doctor/advisor/env·타입 생성·브라우저/DB 권한·경합/부하 검수와 실제 사용자 흐름은 미실행이다. 개발 보고 시점에는 이번 stage/commit/push/통합 merge/PR를 하지 않았다. 2026-10-07 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push→최신 develop merge/push→develop 종료를 진행한다. 검사 실행 허가는 포함되지 않으며 실제 반영 결과는 Git 이력으로 확인한다. 기존 baseline·공용 Auth/여행 앱·공용 default privileges와 미검수 상태는 유지한다. 사용자는 인증을 나중에 직접 테스트할 예정이고 규장각 API 신청 승인을 기다리고 있다. 다음 개발은 SOC-03 팔로잉 피드→SOC-05 알림이며 규장각 연동은 승인 후 별도 작업이다.

2026-10-07 최신 증분은 SOC-03 공개 리뷰/티어 팔로잉 피드와 SOC-06 피드 노출 경계다. 이전 팔로우는 feature 3dcbe92/develop merge e950d27로 push하고 깨끗한 develop에서 종료했다. 새 요청으로 최신 develop fetch/fast-forward 뒤 feature/following-feed를 생성했다. `/me/feed`, 메뉴/내 서재/계정 진입, 20개 cursor 페이지·빈 상태·스포일러 제한 DTO를 작성했다. 새 20261007103840_following_feed.sql을 CLI 2.119.0 migration new로 만들고 선택한 zwzncrdlqnthxgdvsqxq의 관련 Toon 컬럼/함수 정의만 read-only로 확인한 뒤 MCP toon_following_feed로 적용해 success:true를 받았다. toon_activity_events는 원문 없는 참조·대상별 unique·RLS/raw revoke이며 기존 게시 RPC를 재정의하지 않는 invoker trigger가 첫 공개만 원자 기록한다. 기존 현재 공개 리뷰/현재 public 티어는 해당 게시 시각으로 초기 참조를 추가했고 과거 티어 visibility 이력이 없어 최초 전체 공개 시각을 복원하지 않는다. private/unlisted/삭제/숨김/비활성/차단/팔로우 해제를 매 조회 확인하고 수정/재게시로 시각을 올리지 않는다. RPC는 현재 세션/active/확인/동의/auth.uid()로 제한하며 다른 actor 입력을 받지 않는다. cursor는 UTC 소수 초 6자리를 보존하며 서버 viewer envelope와 DB 정렬 경계일 뿐 권한 토큰이 아니다. source/diff만 읽었고 단위/DAL/UI/SQL19 fixture는 작성만 했다. 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/성능 검수와 실제 사용자 흐름은 모두 미실행이다. 원격 테스트 사용자/작품·기존 baseline·공용 Auth·다른 앱·공용 default privileges를 변경하지 않았다. 개발 보고 시점에는 이번 stage/commit/push/통합 merge/PR를 요청하지 않아 하지 않았다. 이후 2026-10-07 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push→최신 develop merge/push→develop 종료를 진행한다. 검사 실행 허가는 포함되지 않으며 실제 반영 결과는 Git 이력으로 확인한다. 다음은 SOC-05 알림이며 커뮤니티 글/피드 이벤트·리뷰/글 댓글·P4 비회원 PNG/edge 제한·P6/P7과 기존 미검수 범위는 후속이다. 규장각 API는 신청 승인 후 별도 작업이고 사용자 인증 검수는 사용자가 나중에 직접 진행할 예정이다.

2026-10-08 최신 증분은 SOC-05 앱 알림과 SOC-06 현재 노출 경계다. 이전 피드는 feature b634486/develop merge e340033으로 push하고 develop에서 종료했다. 새 요청으로 최신 develop fetch/fast-forward 뒤 feature/notifications에서 작성했다. 상단 종/계정 메뉴, /me/notifications의 전체·미읽음/20개 커서·개별/모두 읽음·수신 설정, 정확한 댓글·본인 제보 상세를 연결했다. CLI 생성 20261007154622_notifications.sql만 선택한 zwzncrdlqnthxgdvsqxq에 MCP toon_notifications로 적용해 success:true를 받았다. toon_notifications는 원문 없는 참조·recipient/dedupe unique·자기 알림 제외·RLS/raw revoke와 회원 본인 RPC만 허용한다. invoker AFTER trigger로 이후 팔로우·티어 좋아요/댓글/답글·제보 처리부터 원자 생성하며 과거 활동 backfill은 없다. 반복 팔로우/좋아요는 기존 pair mutex 내 직전 알림부터 24시간 억제하고 수정/재시도는 생성 시각과 read_at를 되돌리지 않는다. 삭제/비공개/차단/비활성·관계 취소 시 kind/actor/target도 일반 안내로 바꾸며 설정은 이후 생성분부터 적용한다. 모두 읽음은 readThrough 생성 시각 경계까지이며 실시간/고정 snapshot이 아니다. 테스트 파일과 SQL20은 작성만 했고 모든 실행 검사·생성 타입·브라우저/DB 권한·경합·성능/사용자 흐름은 미실행이다. 기존 함수/baseline·공용 Auth·여행 앱/default privileges와 원격 테스트 데이터는 변경하지 않았다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 요청하지 않아 하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push→최신 develop merge/push→develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 다음은 커뮤니티 글·신고/운영·피드 연결이며 리뷰/글 댓글·다른 반응·P4 잔여/P6/P7과 기존 검수는 후속이다. 규장각 승인/사용자 인증 검수 대기는 유지한다.

2026-10-08 현재 작업은 커뮤니티 글(COM-01/02, COM-03 최신순 탐색, COM-04 글 관리)과 SOC-03 글 피드/SOC-06/OPS-01/02/04다. 최신 develop 9c9834f fetch/fast-forward 뒤 feature/community-posts에서 작성했다. 공개 목록/상세, 본인 초안·게시본 분리/작품 최대 5개/저장·게시·철회·삭제, 스포일러·신고/운영, 첫 공개 피드 연결 코드와 CLI 생성 20261008090225_community_posts.sql을 작성했다. MCP get_project_url/search_docs는 OAuth token refresh failed: Failed to parse server response로 실패했고 재연결을 요청했다. 원격 schema 조회/DDL 성공은 없으며 이번 SQL은 미적용이다. 복구 후 zwzncrdlqnthxgdvsqxq와 관련 Toon 의존 정의를 확인하고 이번 migration만 추가 적용한다. 기존 baseline/공용 Auth/여행 앱/default privileges를 변경하지 않는다. toon_posts/toon_post_works와 private toon_post_drafts/reports/moderation_events는 제한 RPC 전용이며 리뷰 초안 guard는 유지한다. 글/초안이 source/target 작품을 참조하면 보존 handler 작성 전 병합을 막고 무관한 작품의 기존 병합은 유지한다. 테스트 파일과 local rollback SQL21은 작성만 했고 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한/경합/부하·실제 사용자 흐름은 미실행이다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함되지 않는다. 다음은 MCP 복구 후 새 DB 설치, 글 좋아요·댓글/답글·인기순·알림이며 리뷰 토론/P4 잔여/P6/P7과 기존 검수는 유지한다. 규장각 승인/표지 연동은 별도 후속이고 무단 표지 수집/핫링크는 구현하지 않았다.

2026-10-08 최신 증분은 커뮤니티 글 좋아요·댓글/한 단계 답글·인기순·알림(COM-03/04, SOC-04/05/06, OPS-01/02/04)이다. 이전 글 작업 feature 6b58df8/develop merge 8eb6747을 push한 뒤 최신 develop fetch/fast-forward 기준 새 feature/community-discussions에서 작성했다. 글 전용 toon_post_comments/toon_post_reactions 및 private 댓글 신고/감사를 추가하고 기존 티어 테이블/반응·댓글 RPC는 유지한다. 목표 상태 좋아요·안정 요청 UUID 댓글, 본인 수정/본문 삭제, 스포일러·현재 글/부모/계정/차단·신고/운영 경계, 최근 168시간 유효 좋아요+2×서로 다른 비작성자 댓글 참여자, 기존 알림함/수신 설정·현재 접근 DTO를 연결했다. CLI 생성 20261008102414_community_discussions.sql과 이전 20261008090225_community_posts.sql 모두 MCP OAuth token refresh failed: Failed to parse server response로 원격 미적용이다. 이번 원격 schema 조회/DDL 성공은 없으며 복구 후 zwzncrdlqnthxgdvsqxq와 Toon 의존 정의/이력을 확인하고 이전 글→이번 토론 순서로 추가 적용한다. shared linked CLI push/reset/전체 seed, baseline/공용 Auth/다른 앱/default privileges 변경은 금지다. 수기 타입과 단위/action/UI/local rollback SQL22 파일만 작성했으며 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한/경합/성능·실제 사용자 흐름은 미실행이다. 개발 보고 시점에는 Git 반영을 하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 다음은 MCP 복구 후 두 SQL 설치와 별도 요청된 검수, 리뷰 좋아요/댓글·인기순/알림이며 P4 잔여/P6/P7·기존 검수·규장각/허가 표지 연동은 후속이다. 글 참조 작품 병합 보존 handler와 댓글 신고 FK/공유 Auth 탈퇴 보존 정리도 남아 있다.

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

## 최신 작업 기록 · 2026-10-08 리뷰 토론

레이아웃 `eb3d7f3`/develop merge `c57d80e`, 커뮤니티 오류 `9d87f1d`/develop merge `77bec41`을 각각 push하고 develop에서 종료했다. 새 개발 요청으로 최신 develop fetch/fast-forward 확인 뒤 `feature/review-discussions`를 생성했다. REV-03/04, SOC-04/05/06, OPS-01/02/04의 리뷰 좋아요·댓글/답글·신고/운영·정렬/인기·알림 코드를 작성했으며 개발 보고 시점에는 미커밋이었다. `20261008121123_review_discussions.sql`과 local rollback 23번 fixture를 작성했다. MCP OAuth 갱신 오류로 이전 community_posts/community_discussions와 이번 review_discussions 세 SQL은 모두 원격 미적용이다. 새 리뷰 API 미설치에는 legacy 최신순 조회와 준비 안내를 사용하며 집계를 만들어 표시하지 않는다. 기존 baseline·공유 Auth/여행 앱·공용 default privileges는 보존한다. 원격 연결 복구 후 zwzncrdlqnthxgdvsqxq의 의존 정의/이력을 확인하고 위 세 SQL만 순서대로 추가 적용한다. linked CLI push/reset/전체 seed 금지다. 테스트 파일 작성만 했고 모든 테스트·자동 검사·타입 생성·브라우저/DB 권한·실제 사용자 흐름은 미실행이다. 이후 사용자가 기본 Git Flow를 요청해 이번 리뷰 기능을 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료 순서로 반영한다. 검사 실행 허가는 포함하지 않으며 실제 결과는 Git 이력으로 확인한다. 다음 후보는 커뮤니티 작품 병합 보존/P5 잔여이며 P4/P6/P7과 인증/규장각 검수 대기는 유지한다.

## 최신 작업 기록 · 2026-10-08 커뮤니티 작품 병합

리뷰 feature `d39e988`/develop merge `627c94a`를 push하고 깨끗한 develop에서 종료했다. 다음 개발 요청으로 fetch/fast-forward 확인 후 `feature/community-work-merge`를 생성했다. CAT-08, COM-01/02/03, OPS-04의 게시본/초안 연결 치환·첫 위치 dedupe·버전/미리보기 충돌·원문/상태/반응 보존·본인 전용 연결 이력을 작성했다. 새 `20261008141422_community_work_merge.sql`과 rollback 24번 fixture를 작성했으며 개발 보고 시점에는 미커밋이었다. 2026-10-09 사용자 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 직전 codex mcp login supabase는 성공했지만 이번 get_project_url과 사용자 재연결 후 재시도는 모두 MCP authentication required. Reconnect to continue using this server.였다. 원격 조회/설치 성공은 없고 이전 community_posts/community_discussions/review_discussions와 이번 community_work_merge 총 4개 SQL이 적용 대기다. 복구 후 zwzncrdlqnthxgdvsqxq·관련 Toon 정의/이력을 확인하고 네 SQL만 순서대로 추가 적용한다. 기존 baseline/공유 Auth/다른 앱/default privileges는 유지하며 linked CLI push/reset/전체 seed는 금지다. 모든 테스트/자동 검사/타입 생성/브라우저·DB 권한·경합·성능/실제 사용자 흐름은 미실행이다. 다음 개발 후보는 P6 취향 비교이며 기존 미검증/출시 잔여 범위는 유지한다.

## 사용자 지정 테스트 실행 규칙 (2026-10-02)

- 테스트와 자동 검사는 사용자가 명시적으로 실행을 요청한 경우에만 실행한다. 구현, 커밋, push, PR 요청 자체는 검사 실행 허가가 아니다.
- 단위·통합·E2E·접근성·DB·회귀 테스트와 테스트를 포함하는 `npm run check` 등 복합 명령을 자동 실행하지 않는다.
- 기존 문서나 skill의 자동 테스트 지침보다 이 사용자 결정을 우선한다. 테스트를 실행하지 않은 경우 결과 보고에 미실행을 명시하며 통과했다고 쓰지 않는다.
- lint, typecheck, build, React Doctor, advisor, env 검사와 브라우저 수동·자동 검수도 자동 실행하지 않는다. 필요한 소스·문서 읽기와 코드 작성은 계속하되 실행 검증은 별도 요청을 기다린다. 테스트 파일 작성 자체는 허용한다.

## 최신 작업 기록 · 2026-10-09 취향 비교

이전 작품 병합 feature `2799db3`/develop merge `be37d0e`를 push하고 develop에서 종료했다. 새 개발 요청으로 최신 develop fetch/fast-forward 확인 뒤 `feature/taste-comparison`에서 DISC-01/05, SOC-06의 프로필 진입·내 평가/상대 public 평가 비교·5편 기준·함께 S/차이 목록·20편 페이지·private 응답 코드를 작성했다. CLI 생성 `20261009091203_taste_comparison.sql`과 local rollback 25번 fixture를 작성했으며 개발 보고 시점에는 미커밋이었다. 이후 2026-10-09 사용자 Git Flow 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사·원격 SQL 적용 허가는 포함하지 않는다. MCP 연결 복구 후 `zwzncrdlqnthxgdvsqxq`·migration 이력·Toon 의존 함수/제약/컬럼을 read-only로 확인했다. 첫 대기 `toon_community_posts` apply_migration은 자동 승인 검토가 공유 원격 DDL 적용의 명시적 사용자 승인 부족으로 거절했다. 우회/재시도나 원격 변경 성공은 없다. 적용 승인 범위는 community_posts → community_discussions → review_discussions → community_work_merge → taste_comparison 총 5개 파일이다. 기존 baseline/공유 Auth/여행 앱/default privileges·운영 데이터는 유지하고 linked CLI push/reset/전체 seed 금지다. 모든 테스트/자동 검사/타입 생성/브라우저·DB 권한/성능/실제 사용자 흐름은 미실행이며 SQL 적용 승인은 검사 허가가 아니다. 다음 기능 후보는 P6 S 공동 평가 기반 작품 추천이며 기존 잔여 범위는 유지한다.

## 최신 작업 기록 · 2026-10-10 공동 S 작품 추천

취향 비교 feature `dbb09ee`/develop `9a924f9`를 push하고 develop에서 종료했다. 최신 develop fetch/fast-forward 후 새 `feature/shared-s-recommendations`에서 DISC-03/05, SOC-06의 작품 상세 공동 S 추천 최대 6편·실제 n/s·계산 시각·설명/빈 상태·독립 로딩/오류·private/no-store를 작성했다. CLI 생성 `20261009170725_shared_s_recommendations.sql`과 local rollback 26번 fixture를 추가했다. 개발 보고 시점에는 미커밋이었다. 이후 2026-10-10 사용자 Git Flow 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 사용자 ‘좋아 고고’로 직전 안내한 기존 대기 SQL 5개 적용과 추천 개발을 진행하기로 했으나 이번 get_project_url/list_migrations 모두 OAuth token refresh failed: Failed to parse server response라 원격 조회/DDL 성공은 없다. MCP 재연결을 요청했으며 연결 복구 후 zwzncrdlqnthxgdvsqxq·현재 정의/이력을 확인하고 이전 5개→이번 추천 총 6개 SQL을 순서대로 이어간다. 기존 적용 승인을 다시 요청하지 않는다. 이번 원격 DDL 호출/새 자동 승인 검토 거절은 없으며 baseline/공유 Auth/다른 앱/default privileges·원격 데이터는 유지하고 linked CLI push/reset/전체 seed 금지다. 모든 테스트/자동 검사/타입 생성/브라우저·DB 권한/성능/실제 사용자 흐름은 미실행이다. 다음 후보는 P6 공개 평가 기반 이웃 개인 추천이며 기존 잔여 범위를 유지한다.


## 최신 작업 기록 · 2026-10-10 대기 SQL 6개 원격 적용 완료

공동 S 추천 feature `cb2ada5`/develop merge `1d1014c` push 이후 사용자 SQL 작업 요청으로 최신 develop fetch/fast-forward 확인 후 `chore/apply-pending-supabase-migrations`를 만들었다. MCP 연결 복구 및 대상 `zwzncrdlqnthxgdvsqxq`·migration 이력·Toon 관련 테이블/제약/함수 정의를 확인하고 기존 SQL 6개를 수정 없이 순서대로 적용했다. community_posts `20261009180324` → community_discussions `20261009180338` → review_discussions `20261009180344` → community_work_merge `20261009180351` → taste_comparison `20261009180358` → shared_s_recommendations `20261009180403` (원격 이름은 각각 toon_ 접두사, version은 UTC). 각 apply_migration success:true와 마지막 list_migrations 6건을 확인했다. 이번 대기 SQL은 전부 설치 완료다. 과거 기록의 미적용/재연결 대기는 당시 이력이며 재적용하지 않는다. 로컬 파일명과 원격 version 대응은 docs/06-delivery-operations.md 최신 기록에 있다. baseline/공유 Auth/여행 앱/default privileges는 변경하지 않았고 linked CLI push/reset/전체 seed도 실행하지 않았다. 테스트/자동 검사/타입 생성/브라우저·DB 권한/경합·성능/실제 사용자 흐름은 모두 미실행이며 설치 성공과 기능 검수는 구분한다. README/진행표/이 기록만 갱신했고 SQL 적용 보고 시점에는 미커밋이었다. 이후 사용자 Git Flow 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 다음 후보는 P6 공개 평가 기반 이웃 개인 추천이며 기존 잔여 범위를 유지한다.
