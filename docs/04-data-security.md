# 04. 데이터 모델과 보안

이 문서는 **구현해야 할 스키마 계약**이다. 실행 가능한 migration이 이미 제공되었다는 뜻이 아니다. Codex는 이 계약을 SQL migration, 권한, trigger, 테스트로 구체화해야 한다.

## P1 작성 상태 · 2026-10-02

`20261001162407_accounts_auth.sql`에 profiles/user_settings/genres, private.user_access/consent_records/reauth_tickets/rate_limit_buckets, Auth 생성 trigger와 기존 Auth 사용자에 대한 pending 기반 행 생성을 작성했다. 모든 앱 테이블에 RLS와 명시적 grant를 적용하며 일반 사용자 DML은 제거하고 허용 RPC만 사용한다. featured_tier_list_id와 차단 관계는 P4/P5 의존 기능이므로 해당 단계에서 추가한다.

현재 역할과 정지/삭제 상태는 private.user_access에서 판단한다. 앱 쓰기는 auth.sessions의 실제 session_id, 확인된 Auth 이메일, active 상태, 최신 동의를 확인한다. 온보딩 RPC만 pending→active와 버전별 필수 동의를 원자적으로 저장한다. 사용자 이름은 온보딩 후 바꿀 수 없다. 프로필 공개 조회는 활성·동의·온보딩 상태를 재확인한다.

재인증 발급과 아바타 경로 지정 RPC는 service_role만 실행할 수 있으며 브라우저 세션은 증명을 발급하지 못한다. 사용자용 ticket 소비는 본인/세션/목적/만료/미소비 조건으로 한 번만 성공하도록 작성했다. 아바타 bucket은 공개 WebP 전용이며 일반 사용자 Storage mutation은 restrictive policy로 차단한다. 경로는 bucket `avatars` 안의 `{uid}/{uuid}.webp`이고 profile에는 이 상대 경로만 저장한다.

이는 작성한 migration 계약이며 실제 DB 적용·RLS/Storage 권한·ticket 경쟁 소비·advisors는 미검증이다. 현재 정책 버전은 내부 검수용 `2026-10-02-preview`다. 버전 변경 시 SQL과 서버 검증·온보딩 UI·법적 안내를 함께 바꾸고 실제 운영 정책으로 재동의해야 한다.

## P3 개인 기록 보존 병합 작성 상태 · 2026-10-03

`20261003091940_personal_record_safe_merge.sql`은 기존 library/private details/evaluation/reviews/content drafts의 보존 handler를 작성한다. private.work_merge_previews는 관리자/작품 쌍·무작위 token·내부 SHA-256 fingerprint·만료만, private.work_merge_history는 소유자·작품 쌍·원래 두 개인 기록·옮겨진 리뷰 참조를 저장한다. 두 private 테이블 모두 RLS를 켜고 anon/authenticated 직접 접근을 제거하며 타인 기록을 읽는 관리자 policy는 없다. 보관본은 owner RPC의 auth.uid/현재 세션·활성/동의 검증을 거쳐 조회/삭제하며 계정 삭제 시 profile FK로 cascade한다. 이력 원문은 운영 감사 로그에 복사하지 않는다. P7 export는 아직 없으므로 그때 이 보관본을 함께 처리해야 한다.

상태/평가/진행은 각 최신 행 기준, 동률은 target이며 이전 값/수정 시각도 owner 보관본에 남긴다. 메모는 양쪽 비어 있지 않을 때 제목/UUID 출처를 붙여 합치며 최종 5000자, 태그 union 20개를 넘으면 거절한다. 날짜와 planned 평가, 현재 리뷰 중복, metadata 상한 충돌은 transaction 전체를 중단한다. 원본 작품이 공개 불가능하고 개인 기록/현재 리뷰가 있으면 거절해 병합에 따른 노출 확대를 막는다. 서재와 평가 공개 범위는 독립적으로 더 제한적인 쪽을 유지한다.

전용 try-advisory lock → 작품 UUID 순서 NOWAIT → 관련 소유자 계정/개인 행/리뷰/초안 NOWAIT로 잠근 뒤 토큰·version·fingerprint를 다시 비교한다. 기존 owner→work/리뷰→work 잠금과 경합하면 기다리지 않고 CONFLICT로 rollback한다. source 행 삭제/cascade 전 target와 private 보관본을 작성한다. 공식 링크 ID를 유지하고 source 리뷰 ID/본문/게시/스포일러/운영 상태/신고 참조와 draft payload를 보존한다. source-only 기록도 version을 올린다. private details/evaluation과 inactive 공식 링크 이동을 위해 work_id 인덱스를 추가한다.

P4 tier_lists/drafts와 현재 tier_list_publications는 7절의 두 증분에서 보존 handler를 추가했다. 미구현 tier_list_items/posts는 보존 handler 작성 전까지 계속 거절한다. SQL/RLS/동시 저장/권한/성능/advisor와 DB 적용·타입 생성·모든 테스트는 미실행이다. 아래 P2/P3 최초 작성 당시의 일괄 차단 기록은 역사이며 현재 개인 도메인 handler 범위는 이 절과 7절을 따른다.

## P3 카탈로그 평점순 작성 상태 · 2026-10-03

`20261003053412_catalogue_rating_sort.sql`은 기존 `search_catalogue`의 signature를 보존해 public 별점 요약/정렬을 추가한다. 공개 가능한 작품에 속한 visibility=public, rating_steps가 있는 평가만 작품별로 먼저 집계하며 `private.profile_visible`로 현재 활성/동의/양방향 차단 조건을 검사한다. 본인 방문도 자기 private 평가를 집계하지 않는다. 비공개 library status는 읽지 않으므로 서재 공개와 평가 공개의 독립 경계를 유지한다. tier만 있는 평가는 별점 분모가 아니며 여러 링크/장르/작가가 평가 행을 곱하지 않는다.

기존 SECURITY DEFINER는 private 표지 helper/활성 계정 확인과 명시적인 공개 투영을 위한 경계다. 빈 search_path, 고정 schema-qualified SQL, 입력/페이지/cursor 상한과 제한된 anon/authenticated EXECUTE를 유지하고 table/RLS/DML grant는 넓히지 않는다. private details/개인 시각/사용자별 평가/별점 작성자 ID는 DTO에 넣지 않는다. rating next에는 현재 조회자 자신의 ID 또는 익명 null만 들어가며 token이나 타인 ID가 아니다. DB는 그 값이 실제 auth.uid와 같은지 검사한다. 공개 평가가 철회되거나 기준 작품이 숨겨지면 저장된 cursor 값으로 진행하지 않는다.

기존 evaluation_public_work_idx와 관계 인덱스를 재사용하고 최신/제목은 page 내 별점만 집계한다. 평점순은 현재 일치하는 작품의 평가를 집계하므로 실제 데이터에서 성능 검수가 필요하다. 결과 캐시는 no-store이고 공개 평균/건수에는 차단 상태가 반영된다. 실제 DB 적용·권한/경쟁 저장/성능/advisor/타입 생성과 모든 검사는 미실행이다.

## 1. 공통 규칙

### P2 작성 상태 · 2026-10-02

`20261001174303_catalogue.sql`에 platforms/creators/works/work_creators/work_genres/work_platforms/catalogue_submissions, private.catalogue_sources/asset_licenses/admin_audit_logs를 추가했다. genres는 P1 테이블을 재사용한다. 작품에 optimistic version, 정규화 검색 문자열, 로컬 test 표시를 둔다. 공개 helper는 published·비성인·미병합·실제 작품과 유효한 확인된 비성인 공식 링크를 요구하며 작품/관계/검색/상세/표지에 적용한다. private 출처·허가 근거·이력은 일반 회원에게 노출하지 않는다.

일반 DML은 관리자 세션에도 허용하지 않고 검증된 RPC로만 변경한다. 작가 이름만으로 동일 인물로 합치지 않는다. URL/플랫폼 식별자에 unique를 두고 주소 이름은 고정한다. 링크 제외는 inactive로 처리해 ID를 보존한다. 공식 URL은 HTTPS/허용 host/안전한 query key를 검사한다. fragment와 utm_source/medium/campaign/term/content, gclid/fbclid만 제거하고 다른 query 값은 임의로 삭제하지 않는다.

제보는 현재 계정 UID에서 pending으로 생성하며 own/admin SELECT만 허용한다. 검수 결과는 원자적으로 기록하고 반영 시 실제 공개 가능한 작품을 확인한다. 병합은 작품 UUID 순서 lock과 전용 advisory lock, 미리보기 버전, 사유/확인을 사용한다. 기존 비성인 등급 중 더 제한적인 등급을 유지하고 source 표지는 철회한다. P3+ 도메인 테이블이 존재하면 보존 handler를 추가하기 전까지 병합을 거절한다.

licensed-covers는 private WebP bucket이다. anon/authenticated의 직접 읽기와 mutation은 restrictive policy로 차단하고 서버만 업로드/표시 proxy를 수행한다. staged 라이선스는 실제 Storage 객체 확인 후 활성화한다. 허가 만료·철회·작품 숨김은 새 목적별 접근을 거절한다. source/권리 기록은 관리 snapshot에서 최근 50건씩 제공한다. 모든 앱 테이블 RLS/함수 grant를 migration에 작성했으나 실제 적용·경쟁 저장·RLS/Storage/advisor 검사는 미실행이다.

로컬 seed의 합성 60개 작품은 draft/is_test 상태라 공개 helper와 공개 RPC에서 제외된다. 가짜 이용자/평점/리뷰/공식 링크는 만들지 않는다. seed 자체도 실행하지 않았다.

ID는 UUID, 시간은 timestamptz/UTC를 사용한다. 생성/수정 시각은 DB에서 관리한다. 사용자 소유 데이터의 owner/user ID는 요청 body를 신뢰하지 않고 `auth.uid()`로 확정한다. 사용자 ID와 부모 ID는 생성 후 일반 수정으로 바꿀 수 없다. 다만 관리자 작품 병합처럼 명시적으로 검증한 transaction은 승인된 예외이며 일반 사용자 UPDATE로 실행할 수 없다.

`public`은 Supabase Data API에 노출할 스키마다. 이름이 public이라는 이유로 모든 행이 공개되는 것은 아니다. 모든 노출 테이블에 RLS를 활성화하고, 읽기/쓰기/컬럼 권한을 명시한다. `private`는 Data API 노출에서 제외하고 anon/authenticated의 직접 접근을 제거한다. [S04]

서재, 개인 평가, 공유 티어표를 별개 모델로 둔다. 별점과 티어를 두 군데에 저장해 어느 값이 최신인지 모르게 만들지 않는다.

### P3 리뷰·차단·신고 작성 상태 · 2026-10-02

`20261002032637_reviews_moderation.sql`에 reviews, review 전용 content_edit_drafts, blocks, review 전용 reports와 private.review_moderation_events를 작성했다. 현재 리뷰는 사용자/작품별 미삭제 한 건이며 삭제한 리뷰는 원문과 편집 초안을 제거하고 최소 참조·상태만 남긴다. 서재·평가를 삭제하지 않는다. 게시본과 JSON 편집 초안은 별도 행/version이고 저장은 초안만 변경한다. 게시 RPC는 서버에 저장된 초안을 검증해 원자적으로 복사한다. 일반 사용자·운영자 모두 직접 DML 권한이 없다.

reviews/content_edit_drafts의 직접 SELECT는 active 소유자만 허용한다. 공개 SELECT를 부여하면 스포일러 본문을 우회할 수 있으므로 공개 조회는 제한된 RPC DTO만 사용한다. 공개 가능 조건은 published·visible·미삭제·공개 비성인 작품·활성 작성자·조회자와 양방향 차단 없음이다. 최초 spoiler body/excerpt는 null이며 펼치기 요청은 이 조건과 게시 version을 다시 검사한다. 공개 기준 회차는 명시적으로 입력한 값이며 개인 진행/메모/태그를 조회하거나 복사하지 않는다. 리뷰에 붙는 별점/티어는 공개 evaluation만 투영한다.

blocks는 본인만 읽고 현재 계정의 목표 상태 RPC로 생성/해제한다. `private.author_active`는 기존 활성 작성자 조건을 유지하고 `private.profile_visible`에 `private.users_can_interact`를 합쳐 프로필·공개 서재/평가·공개 집계에도 차단을 적용한다. 차단은 로그인 계정 사이의 노출·접촉 제한이며 비회원 조회를 막는 비공개 설정이 아니다. 본인 조회는 자기 차단이 불가능하므로 기존 계정 조건을 유지한다. follows가 없는 현재는 양방향 관계 정리를 수행하지 않으며 P5에서 같은 transaction에 추가해야 한다.

reports는 현재 공개된 타인 리뷰만 대상으로 하며 신고자/review별 pending 중복을 차단한다. 신고자는 본인 사유·상세·처리 상태/결과만 읽고 운영 검토 DTO는 신고자의 ID를 제공하지 않는다. 역할은 private.user_access의 active moderator/admin으로 확인한다. 숨김/복구/기각·결과·사유·감사 이벤트는 한 transaction이며 운영자에게 편집 초안·개인 메모를 제공하지 않는다. 감사 이벤트에 원문을 복제하지 않는다. reports의 review FK를 포함한 신고 보존/비식별화·참조 정리와 탈퇴 hard-delete는 P7 작업자에서 처리해야 하며 현재는 soft-delete만 구현했다. 글/댓글/티어/프로필/작품 신고는 후속 범위다.

파일만 작성했으며 실제 migration/SQL/RLS/함수 권한/차단 집계/동시성/생성 타입/advisor/테스트는 미실행이다. 운영 역할을 지정하거나 실제 DB에 연결하지 않았다.

## 2. 도메인 enum

| 이름 | 값 |
|---|---|
| reading_status | reading, completed, dropped, planned |
| visibility | public, private |
| tier_visibility | public, unlisted, private |
| canonical_tier | S, A, B, C, D, F |
| serial_status | ongoing, completed, hiatus, unknown |
| age_rating | all, 12, 15, 19, unknown |
| catalogue_status | draft, published, hidden, merged |
| publication_status | draft, published |
| moderation_status | visible, hidden |
| access_status | pending, active, suspended, deleting |
| user_role | user, moderator, admin |
| job_status | queued, running, succeeded, failed |

`rating_steps`는 smallint 1-10이고 화면 별점은 rating_steps/2다. NULL은 미평가다. 0을 미평가 저장값으로 쓰지 않는다.

## 3. 공개 가능한 기본 정보

### profiles

`id` PK/FK auth.users, `username` nullable unique lower-case, `display_name`, `bio`, `avatar_path`, `discovery_opt_in` boolean 기본 false, `featured_tier_list_id` nullable, `onboarding_completed_at`, `created_at`, `updated_at`.

onboarding_completed_at은 완료 RPC만 설정하고 일반 프로필 UPDATE에서는 허용하지 않는다. featured_tier_list_id는 현재 공개된 본인 티어표만 가리킬 수 있다. username은 온보딩 후 고정하며 표시 닉네임과 소개는 변경 가능하다.

이 테이블에는 이메일, 관리자 권한, 계정 정지 사유, IP, 동의 원문을 넣지 않는다. username은 온보딩 중 null일 수 있고 완료 시 필수다. nickname은 중복 가능하다. 공개 프로필은 온보딩 완료 계정의 기본 필드만 보여준다. 삭제/정지 계정의 공개 조회는 제한한다.

### user_settings

`user_id` PK/FK profiles, `default_library_visibility` private, `default_evaluation_visibility` private, `theme` system/light/dark, `timezone` Asia/Seoul, `notification_preferences` jsonb, `preferred_genre_ids` uuid[], `updated_at`.

본인만 조회/수정한다. JSON key allowlist, 장르 존재 여부, 배열 크기를 서버와 DB 검증 함수에서 확인한다. `discovery_opt_in`은 유사 사용자 탐색과 개인 추천의 이웃 후보에 포함될지 선택하는 설정이며 권한 우회용 플래그가 아니다. 공개 작품의 평점/티어 집계와 공동 S 통계는 공개 평가의 일반 집계임을 별도로 안내한다.

## 4. 작품 카탈로그

| 테이블 | 주요 컬럼과 제약 |
|---|---|
| platforms | id, code unique, name, approved_hosts text[], active |
| creators | id, name, aliases text[]; 이름만으로 인물을 동일시하지 않음 |
| genres | id, slug unique, name, sort_order |
| works | id, slug unique, title, aliases text[], original_description, serial_status, age_rating, catalogue_status, cover_asset_id nullable, merged_into_id nullable, created_at, updated_at |
| work_creators | work_id, creator_id, role(writer/artist/original/studio), sort_order; 조합 고유 |
| work_genres | work_id, genre_id; 조합 PK |
| work_platforms | id, work_id, platform_id, official_url, external_id nullable, weekdays smallint[], serial_status, age_rating, verified_at, active |

work_platforms의 `(platform_id, external_id)`는 external_id가 있을 때 고유하다. canonical official_url도 중복을 막는다. 요일은 0-6의 중복 없는 배열이다. URL은 HTTPS와 플랫폼별 검증된 host만 허용한다. 쿼리 tracking 값 정리는 명시된 규칙으로만 수행한다.

공개 가능한 작품 조건은 catalogue_status=published, merged_into_id IS NULL, 검증된 비성인 연령 등급이다. unknown/19는 기본 공개 대상에서 제외한다. 이 조건은 작품 상세뿐 아니라 관계 테이블, 검색, 리뷰, 티어, 통계, export에서도 적용한다.

현재 범위에는 실제 성인 인증 모듈이 없다. DB 정책은 성인 데이터를 거절해야 하며 서버 환경변수 하나를 true로 바꾸는 것만으로 성인 공개가 열리지 않도록 한다. 실제 지원 시 별도 migration, 검증 adapter, 운영 검토가 필요하다.

표지 권리의 실제 컬럼은 private.asset_licenses에 둔다. public DTO에 허가 계약 문서나 내부 담당자 정보를 내보내지 않는다. 작품의 사실 정보 출처는 private.catalogue_sources에 별도로 기록한다.

## 5. 서재와 평가: 세 테이블 분리

### P3 서재·평가 작성 상태 · 2026-10-02

`20261001184908_library_evaluations.sql`에 세 테이블과 RLS/최소 SELECT grant/RPC를 작성했다. private details는 본인 전용이며 관리자라도 일반 SDK로 타인의 메모를 조회할 수 없다. 공개 entry와 공개 evaluation의 정책은 독립적이며 활성 작성자와 공개 가능한 작품을 요구한다. 공개 SELECT는 상태/평가 컬럼만 허용하여 비공개 메모 수정 시각이나 내부 version을 직접 조회할 수 없게 했다. owner DTO와 public DTO를 따로 작성했다.

쓰기 RPC는 현재 UID만 사용하고 계정 lock으로 같은 소유자의 변경을 직렬화한다. 개별/일괄 저장은 version을 비교하고 일괄 처리 전체를 transaction으로 묶는다. planned 평가를 trigger와 RPC에서 거절하며 clear 확인 없이 기존 평가를 제거하지 않는다. 진행 기록은 날짜·회차·메모·태그·작품 소속 플랫폼 링크를 검증한다. 서재 삭제는 private details/evaluation만 cascade한다. 전체 비공개는 항목·평가·기본값을 원자적으로 변경한다. 숨김/성인/unknown 작품은 public DTO·통계에서 제외하고 owner DTO에서도 작품 메타데이터를 제거한다. 기존 P2 병합 보호는 계속 차단한다. DB 적용·RLS/경쟁 저장/권한 검증은 미실행이며 리뷰 테이블·병합 보존 handler는 후속 작업이다.

### P3 공개 서재 검색의 개인정보 경계 · 2026-10-03

`20261002162554_public_library_search.sql`의 `search_public_library`는 기존 가시성/차단 helper를 통과한 회원과 공개 가능한 작품만 조회한다. 공개 평가 행만 join하고 서재 상태는 visibility=public일 때만 투영한다. 이 값에만 상태/정확한 별점/티어 필터와 정렬을 적용해 비공개 값이 일치 여부·총수·순서를 바꾸지 않게 작성했다. 검색 문자열·장르·플랫폼은 공개 작품 메타데이터만 사용하며 플랫폼 조건은 유효한 비성인 공식 링크를 요구한다. 개인 details나 활동 시각을 읽지 않는다.

RPC는 공개 평가만 있는 작품도 합쳐 표현해야 하므로 기존 공개 서재 RPC와 같이 제한된 `SECURITY DEFINER`를 사용하고 빈 search_path·명시적 스키마·고정 SQL·엄격한 입력/크기/페이지 검증을 적용한다. PUBLIC 실행 권한을 철회하고 anon/authenticated에 명시적으로 허용한다. 기존 RLS·컬럼 grant·쓰기 권한은 바꾸지 않았으며 공개 경로에서는 소유자도 비공개 필터를 사용할 수 없다. 테스트 파일에 anon/A/B·독립 공개 조합·비공개 값 변경·차단·정지·숨김 작품·페이지 경계 사례를 작성했지만 DB에 적용하거나 실행한 근거는 없다.

### library_entries

`user_id`, `work_id` composite PK, `status` reading_status, `visibility` private 기본값, `created_at`, `updated_at`.

공개 서재에서 필요한 작품/읽기 상태만 저장한다. 상태를 planned로 바꾸는데 평가가 남아 있으면 거절하거나 명시적 `clearEvaluation` 요청과 함께 한 transaction으로 처리한다.

### library_private_details

`user_id`, `work_id` composite PK/FK library_entries ON DELETE CASCADE, `last_read_episode` nullable integer >=0, `started_on` date nullable, `finished_on` date nullable, `private_note` text, `tags` text[], `preferred_work_platform_id` nullable, `updated_at`.

회차, 날짜, 메모, 개인 태그는 항상 본인 전용이다. 공개 library_entries 조회에서 이 테이블을 무심코 join하여 클라이언트에 전달하지 않는다. 종료일은 시작일보다 빠를 수 없다. 작품이 다른 platform link를 연결하지 못하도록 검증한다.

### user_evaluations

`user_id`, `work_id` composite PK/FK library_entries ON DELETE CASCADE, `rating_steps` nullable smallint, `canonical_tier` nullable, `visibility` private 기본값, `created_at`, `updated_at`.

rating_steps와 canonical_tier 중 적어도 하나는 존재해야 한다. 둘 다 지우면 평가 행을 삭제한다. planned 상태의 서재에는 평가가 들어갈 수 없도록 DB trigger/RPC에서 검사한다. 사용자가 표를 10개 만들어도 이 테이블의 작품별 한 행만 평가 통계의 원천이다.

서재 공개와 평가 공개는 독립적이다. 공개 평가만 있고 서재 상태는 비공개인 사용자도 가능하다. 이 경우 공개 별점/티어는 보이지만 `완독자` 통계에는 포함하지 않는다.

## 6. 리뷰와 커뮤니티

| 테이블 | 주요 컬럼 |
|---|---|
| reviews | id, user_id, work_id, body, is_spoiler, read_upto_episode nullable, publication_status, moderation_status, published_at nullable, deleted_at nullable, created_at, updated_at |
| posts | id, user_id, title, category, body, is_spoiler, publication_status, moderation_status, published_at nullable, deleted_at nullable, created_at, updated_at |
| post_works | post_id, work_id; 조합 PK, 게시글당 최대 5개 |
| content_edit_drafts | id, user_id, review_id/post_id 중 하나, payload jsonb, version, updated_at; 대상별 한 건, 본인 전용 |
| comments | id, user_id nullable, review_id nullable, post_id nullable, tier_list_id nullable, parent_id nullable, body nullable, is_spoiler, moderation_status, deleted_at nullable, created_at, updated_at |

content_edit_drafts는 리뷰 또는 글 중 정확히 하나를 가리키며, 부모와 동일한 소유자만 읽고 저장한다. 새 초안과 게시 후 수정 내용을 이곳에 저장하고, 게시 RPC만 reviews/posts의 공개 본문을 교체한다. payload에는 해당 콘텐츠의 허용 필드만 담는다.

reviews는 deleted_at IS NULL인 `(user_id,work_id)`에 partial unique를 둔다. 한 사람의 현재 리뷰는 한 작품에 한 건이다. 리뷰의 별점은 공개 가능한 user_evaluations에서 읽으며 별도 rating 컬럼을 만들지 않는다.

comments는 `num_nonnulls(review_id,post_id,tier_list_id)=1`을 강제한다. 부모 댓글의 대상과 자신 대상이 같아야 하고, 부모의 parent_id는 NULL이어야 한다. 댓글 깊이는 한 단계다. parent_id 변경으로 다른 스레드에 옮기는 요청은 거절한다.

삭제한 댓글의 본문은 제거하고 tombstone으로 남겨 다른 사람의 답글 문맥을 유지할 수 있다. 자신의 리뷰/글/티어가 삭제되면 그 토론 전체는 일반 사용자에게 접근 불가다. 회원탈퇴 시 타인 글에 남긴 본인 댓글은 익명 tombstone으로 처리한다.

## 7. 티어 초안과 게시본

### tier_lists

`id`, `user_id`, `visibility` private, `published_version` nullable bigint, `moderation_status`, `deleted_at` nullable, `created_at`.

제목, 설명, 편집 중 행 이름을 여기의 공개 컬럼에 넣지 않는다. 변경 중인 초안 제목이 이미 공개된 표의 제목으로 누출되지 않게 하기 위해서다.

### tier_list_drafts

`tier_list_id` PK/FK tier_lists, `title`, `description`, `tags` text[], `rows` jsonb, `placements` jsonb, `version` bigint, `updated_at`.

본인만 조회한다. 데이터 형식은 05 문서에 정의한다. 버전은 저장 성공 transaction에서 1 증가한다. 2-10개 행, 최대 300작품, 중복 work ID 금지, 모든 row ID 참조 유효성을 DB에서 검사한다.

**P4 첫 증분 · 2026-10-03 (파일 작성, 미적용):** `20261003130130_tier_draft_editor.sql`은 위 두 테이블과 `private.tier_merge_history`를 생성한다. 모두 RLS를 켜고 anon/authenticated 직접 권한·정책을 부여하지 않는다. 빈 search_path의 owner RPC만 현재 실제 세션·활성/동의·auth.uid와 소유권을 확인해 읽고 변경한다. 관리자도 타인의 제목/설명/태그/행/배치/원본을 직접 조회할 수 없다. published_version=null/visibility=private CHECK가 있으며 게시본 테이블/토큰은 아직 생성하지 않았다. 신규 숨김 work ID는 거절하고 본인 기존 숨김 배치는 placeholder/제거·본인 복사로만 보존한다. 명시적 UUID·행·canonical·태그·참조·중복·연속 위치·크기 제한을 DB CHECK/RPC에서 검사하고 사용자별 잠금 아래 50표 상한을 검사한다.

티어 병합 원본은 user_id/tier_list_id/source/target/원래 제목/draft_before/전후 버전/중복 정리 건수/시각을 private에 보관한다. 본인 활성 초안의 RPC로만 최근/20건 페이지 조회가 가능하고, 초안 삭제 시 draft와 원본을 제거한다. 계정 FK cascade는 있으나 P7 실제 탈퇴/export worker는 미완성이다. 병합 fingerprint와 NOWAIT 잠금은 양쪽 작품이 포함된 초안·현재 게시본·owner·metadata를 포함한다. 원 게시 snapshot은 수정하지 않고 매 조회/복제에서 merged ID를 해석하며 현재 target 배치를 보존해 중복을 제거한다. lifecycle version도 올려 옛 미리보기/펼치기/복제를 무효화한다. 공개 불가능한 source가 현재 게시본에 있으면 노출 확대를 막기 위해 병합을 거절한다. 기존 P3 처리·초안 archive·version 변경은 같은 transaction이고 관리자 응답/감사에는 건수만 들어간다. 미구현 `tier_list_items/posts`는 handler 작성 전 계속 차단한다.

### tier_list_publications

`tier_list_id`, `version` composite PK, `payload` jsonb, `published_at`.

payload에는 검증한 제목/설명/태그/행/배치된 work ID만 저장한다. 이미지 URL, 허가 문서, 비공개 메모, 미배치 작품, 토큰은 넣지 않는다. 게시 시 서버가 초안에서 만들어야 하며 사용자 임의 payload를 그대로 승인하지 않는다.

일반 사용자는 현재 published_version이 가리키는 게시본만 읽을 수 있다. 과거 게시본은 작성자와 허용된 운영 기능만 접근한다. 숨겨진 작품은 payload에 ID가 남아 있어도 모든 렌더와 export에서 필터링하고 비식별 대체 카드로 처리한다. 이전 표지 URL을 snapshot에 박아 넣지 않는다.

unlisted 게시본은 public table SELECT 정책으로 읽게 하지 않는다. 토큰 검증 전용 서버 경로/RPC를 통해 제한된 DTO만 반환한다. 토큰을 알았다는 이유로 초안이나 옛 게시본을 읽게 하지 않는다.

**P4 게시 증분 · 2026-10-04 (미적용/미검증):** `20261003145059_tier_publication_sharing.sql`에 위 publication PK와 검증·미배치 금지·RLS/직접 SELECT/DML 제거를 작성했다. tier_lists의 private-only 임시 제약을 current publication FK/visibility 제약과 독립 lifecycle version·단조 publication_counter로 교체했다. 게시/회전/철회는 owner 현재 계정과 기대 버전을 검사한다. token은 `private.tier_share_tokens`의 hash unique와 암호문/nonce만 저장하며 키와 원문은 DB/public DTO에 없다. owner RPC만 현재 암호문을 반환하고 서버가 AAD/hash/tag를 검증해 복구한다. 오래된 번호를 재사용하지 않는다.

게시 미리보기 hash에는 저장된 배치와 현재 공개 작품 DTO를 함께 넣는다. 게시 transaction은 owner→작품 SHARE→metadata/draft UPDATE 순서로 초안·lifecycle version과 hash를 재검사한다. public/current reader는 현재 작성자 활성·동의·온보딩·양방향 차단·visibility·운영 상태·토큰 철회/만료를 검사한다. 숨겨진 작품은 공개 DTO에서 UUID/원문 없이 null 대체 카드가 된다. spoiler body/목록 제목은 최초 응답에 없으며 펼치기에는 현재 lifecycle version이 필요하다. 목록 DTO는 본문·배치·token이 없고 12개 페이지다. 원 게시본은 현재 포인터 외 일반 경로에서 읽지 못한다.

신고·감사는 `private.tier_reports/tier_moderation_events`에 RLS/직접 권한 제거와 owner/운영자 RPC를 둔다. reporter+list pending unique, 사유·길이·현재 접근/자기 신고 금지·DB rate를 검사한다. 운영 조치는 역할·버전·현재 게시 상태·사유/신고 소속을 확인하고 숨김/복구/신고 결과/감사를 원자적으로 저장한다. 숨김은 token도 철회하고 복구만으로 이전 token을 살리지 않는다. 삭제는 공개 포인터를 지우고 publication·token·초안·병합 원본을 제거하되 private 신고/감사는 유지한다. 대표 티어 필드/설정과 그 철회 연동·과거 게시본 owner UI·P7 보관본 export/계정 삭제 정리는 후속이다. DB 적용/권한/경합/성능/모든 검사는 실행하지 않았다.

**P4 PNG 증분 · 2026-10-04 (파일만 작성·미적용):** `20261003171347_tier_image_export.sql`의 `get_tier_image_source`/`begin_tier_image_export`는 authenticated execute만 허용하고 현재 실제 세션/활성/이메일 확인/동의를 다시 검사한다. 초안은 소유자만, 게시본은 현재 public 또는 유효 hash와 차단/author/운영/버전 조건을 통과해야 한다. 관리자 역할도 타인 초안 export 권한이 아니다. 스포일러 게시본은 별도 확인하며 text-only DTO에서 work/asset ID·URL·메모·회차·token을 제거한다. private helper의 직접 execute도 제거하고 빈 search_path/statement timeout을 작성했다. 예약 RPC는 기존 private 회원별 rate bucket을 5회/고정 600초로 사용한다. 원시 IP 수집·임의 header 신뢰·service key 사용자 접근은 구현하지 않았다. 비회원 PNG/token·IP/HMAC 제한은 후속이고 이번에는 로그인 안내/DB execute 거절로 처리한다. 렌더 직후 현재 DTO/권한을 재확인하고 모든 이미지 응답은 no-store다. 이미 수신한 파일과 외부 OG cache는 회수할 수 없다. 이미지에는 원격/허가된 표지까지 사용하지 않고 텍스트 카드만 포함해 표시 권한을 재배포 권한으로 추정하지 않는다. 실제 DB/RLS/권한/동시 철회·이미지/배포 검수는 미실행이다.

**P4 기본 평가 연결 · 2026-10-04 (파일만 작성·미적용):** `20261003182649_tier_canonical_evaluations.sql`은 새 테이블/직접 DML 권한 없이 owner 전용 후보/미리보기/적용 RPC를 추가한다. PUBLIC/anon과 private helper execute는 제거하고 authenticated만 실제 세션·활성·이메일·동의·초안 소유권을 검사한다. 후보는 본인 평가/서재와 현재 작품 제목·배치·필요한 별점/공개 범위/version만 투영하고 메모/태그/회차/token은 반환하지 않는다. 선택 1–100개·UUID 중복·읽기 상태·명시 코드·작품/행 가용성과 300작품 상한을 DB에서도 검사한다.

owner→UUID순 원본/병합 대상 작품 SHARE→표/초안/서재 UPDATE 순서로 잠근 후 owner/방향/초안 version/선택과 해당 개인 기록 상태·version·별점·공개 범위·작품 상태 fingerprint를 재계산한다. 충돌은 전체 rollback이며 가져오기는 기존 저장 함수의 검증/정규화로 초안 version만 올린다. 반영은 기존 별점·각 visibility·private details를 건드리지 않고 canonical_tier와 필요한 planned 상태만 변경한다. 새 서재/평가는 private, 기존 서재 version+1로 오래된 편집을 거절한다. 미배치/사용자 행/불가 작품은 평가 삭제나 코드 추정의 근거가 아니다. 게시본·개인 통계 원본 단일 PK는 유지한다. 미리보기 60회/분·적용 30회/분의 기존 회원 bucket을 사용한다. DB 적용/권한/동시성/성능 검사는 모두 미실행이다.

## 8. 소셜 테이블

| 테이블 | 주요 컬럼과 불변식 |
|---|---|
| follows | follower_id, following_id composite PK, created_at; 자신 팔로우 금지 |
| blocks | blocker_id, blocked_id composite PK, created_at; 자신 차단 금지, 목록은 차단자만 |
| reactions | id, user_id, review_id/post_id/tier_list_id/comment_id nullable, created_at; 정확히 한 대상 |
| activity_events | id, actor_id, review_id/post_id/tier_list_id nullable, event_type, created_at; 정확히 한 대상 |
| notifications | id, recipient_id, actor_id nullable, type, 대상 FK들 nullable, dedupe_key, read_at nullable, created_at |

reactions는 대상 유형별 `(user_id,target_id)` partial unique를 둔다. 좋아요는 공개된 접근 가능한 활성 콘텐츠에만 가능하고 자기 콘텐츠에는 할 수 없다. 좋아요 수를 사용자가 직접 update하지 못하도록 한다.

**P4 좋아요 첫 대상 · 2026-10-05 (작성·미적용):** `20261004144839_tier_likes.sql`은 reactions의 tier_list_id를 not-null FK로만 도입한다. 위 표의 review/post/comment 대상은 각 도메인 migration에서 FK·정확히 한 대상 제약·partial unique/RPC와 함께 확장한다. 임의의 미구현 대상 ID를 보관하지 않는다. RLS를 켜고 PUBLIC/anon/authenticated의 직접 SELECT/DML을 제거해 반응자 ID나 private 대상 조회를 막는다. 변경 RPC는 현재 실제 세션·활성/이메일/동의/소유자가 아닌 회원·public/운영/작성자 상태·양방향 차단·expected lifecycle version을 검사한다. desired boolean과 unique로 idempotent insert/delete를 사용하며 40회/분 DB 제한을 적용한다.

현재 사용자 access lock→정렬된 사용자 쌍의 advisory transaction lock→tier SHARE 순서로 변경한다. set_user_block도 같은 pair lock을 사용하고 양쪽이 상대 표에 남긴 반응을 같은 transaction에서 삭제한다. 타인의 다른 작성자 콘텐츠 반응은 삭제하지 않고 조회자 차단에 따라 집계에서만 제외한다. 유효 수는 활성/확인/온보딩/현재 동의 반응자만 포함하며 작성자↔반응자 및 조회자↔반응자 차단을 검사한다. 숫자는 사용자별로 달라질 수 있다. private/unlisted/숨김/삭제/비활성 작성자는 상태/수를 노출하지 않는다. private/unlisted 전환의 기존 반응은 보관하고 이후 public 재게시 때 현재 조건으로만 다시 집계한다. soft delete trigger와 profile FK cascade는 반응을 정리한다. 현재 표 ID에 붙는 반응은 공개 게시본 갱신/작품 병합으로 복제되지 않는다. 실제 DB/RLS/성능/다중 세션 동시성은 모두 미검증이며 알림 dedupe/생성·다른 소셜 도메인은 후속이다.

**P4 탐색 증분 · 2026-10-05 (작성·미적용):** `20261004162937_tier_discovery.sql`의 `search_public_tiers`는 현재 public/미삭제/visible·활성 작성자/조회자 차단 검사를 통과한 후보만 집계·정렬·페이지 수에 넣는다. `private.tier_like_metrics`가 총수와 최근 168시간 수의 동일한 반응자/작성자/조회자 가시성 규칙을 적용하며 기존 상세 수 helper도 이를 사용한다. 미래 시각은 최근 수에서 제외하고 repeated desired true는 기존 created_at을 유지한다. 태그는 현재 published_version의 payload에 literal JSON containment로 비교한다. 스포일러 payload는 태그 필터에서 제외하고 카드 제목/태그도 null이다. 초안/옛 게시본/개인 태그를 보지 않으며 숨겨진 반응자 ID·개인 기록·공유 token은 DTO에 없다. 익명/회원은 제한 RPC만 실행하고 private helper·원문/반응 table 직접 권한은 계속 제거한다. 새 공개 table/정책/서비스 키는 없다. 태그 GIN partial index와 반응 시간 index는 migration 파일에만 작성했으며 적용·query plan/성능·권한/동시성은 미검증이다. 전체 댓글 가중 인기 점수와 익명 edge 제한은 후속이다.

activity_events는 첫 공개 게시 이벤트를 중복 없이 만든다. 공개 필드의 원문을 복제하지 않고 대상 ID를 참조한다. 조회 시 원본이 현재도 공개/활성 상태인지 검증한다. 공개 취소와 차단 이후 과거 피드 항목이 남지 않는다.

notifications는 recipient만 SELECT와 read_at 변경이 가능하다. 생성은 신뢰된 DB trigger/RPC만 할 수 있다. 알림 payload에는 리뷰/댓글 본문을 복사하지 않는다. FK가 삭제로 없어져도 일반 안내로 표시할 수 있어야 한다.

follows와 reactions는 타깃 존재 확인, 상호 차단 확인, active 계정 확인을 transaction 안에서 처리한다. 차단 시 양방향 follows를 삭제하고 이후 댓글/좋아요/알림 생성을 막는다.

## 9. 제보와 신고

### catalogue_submissions

`id`, `user_id`, `kind` new_work/correction, `work_id` nullable, `proposal` jsonb, `status` pending/accepted/rejected, `reviewer_id` nullable, `review_note`, `created_at`, `resolved_at`.

회원은 자신의 제보와 처리 결과만 읽고 새 pending 제보를 생성할 수 있다. status/reviewer는 일반 사용자가 변경할 수 없다. proposal은 제목/작가/플랫폼/공식 URL/설명 제안만 허용하며 표지 파일/이미지 URL 수집을 받지 않는다.

### reports

`id`, `reporter_id`, work/profile/review/post/comment/tier 대상 FK 중 정확히 하나, `reason`, `detail`, `status` pending/reviewing/resolved/rejected, `created_at`, `resolved_at`.

일반 사용자는 자신의 접수 결과만 읽는다. 타인의 신고자 정보는 콘텐츠 작성자에게도 제공하지 않는다. 대상이 삭제돼도 최소 처리 기록이 필요한 경우 target_type/target_reference를 분리 보존하고 개인정보/본문은 최소화한다. 보존 기간은 공개 운영 정책에서 확정한다.

## 10. private 스키마

| 테이블 | 목적과 핵심 컬럼 |
|---|---|
| user_access | user_id PK, status, role, suspension_reason nullable, updated_at; 권한 원천 |
| consent_records | user_id, policy_kind, version, accepted_at; 앱 이용 동의 |
| reauth_tickets | token_hash, user_id, session_id, purpose, expires_at, consumed_at; 짧은 일회용 확인 |
| asset_licenses | id, work_id, storage_path, rights_holder, evidence_reference, display_allowed, og_allowed, export_allowed, commercial_allowed, attribution, valid_from, expires_at, status, verified_by |
| catalogue_sources | id, work_id, source_url, verified_fields text[], verified_at, verified_by, note |
| tier_share_tokens | tier_list_id unique, token_hash unique, encrypted_token, encryption_nonce, expires_at nullable, revoked_at nullable, rotated_at |
| admin_audit_logs | id, actor_id nullable, action, target_type, target_id, reason, before_summary, after_summary, created_at |
| rate_limit_buckets | subject_hash, action, window_start composite PK, request_count, expires_at |
| operation_jobs | id, type, user_id nullable, payload, idempotency_key unique, status, lease_until, attempts, next_run_at, result_path nullable, last_error_code, created_at, finished_at |

서버 관리 모듈은 필요한 테이블만 다룬다. 무제한 SQL 실행 RPC나 관리자 키를 사용하는 범용 데이터 프록시를 만들지 않는다.

링크 전용 토큰은 CSPRNG 32바이트 이상을 URL-safe 문자열로 만든다. 조회용 SHA-256 hash와 작성자가 나중에 다시 복사할 수 있게 서버에서 암호화한 token을 저장한다. 원문은 로그/공개 테이블에 넣지 않는다. `SHARE_TOKEN_ENCRYPTION_KEY`는 서버 전용 32바이트 키로 배포 비밀에 보관하며 코드 저장소에 넣지 않는다. 서버의 인증된 소유자 전용 동작만 token을 복호화해 반환한다.

암호화는 검증된 AES-GCM 구현을 사용하고 nonce를 매번 새로 생성한다. 키가 없으면 링크 공개 기능은 설정 오류로 실패해야 하며 평문 저장으로 우회하지 않는다. 키 교체는 기존 링크 재발급 또는 관리된 재암호화 절차로 처리한다.

## 11. RLS 읽기/쓰기 표

공통 전제: 접근 가능한 작품, 활성 대상 계정, 삭제/숨김 아님, 현재 게시 상태를 확인한다. 차단 정책은 로그인 사용자의 콘텐츠 노출과 상호작용에 적용한다. 공개 콘텐츠는 로그아웃한 누구나 볼 수 있으므로 차단을 인터넷 전체에 대한 비공개 보장으로 설명하지 않는다.

| 데이터 | 비회원 읽기 | 타 회원 읽기 | 소유자 변경 |
|---|---|---|---|
| profiles | 온보딩 완료 기본 정보 | 동일, 상호 차단 필터 | 허용된 프로필 컬럼만 |
| user_settings | 불가 | 불가 | 본인만 |
| 작품과 관계 | 공개 가능한 작품 | 동일, 관리자 예외 | 관리자만 |
| library_entries | visibility=public | public 또는 본인 | 본인만 |
| library_private_details | 불가 | 불가 | 본인만 |
| user_evaluations | visibility=public | public 또는 본인 | 본인만 |
| content_edit_drafts | 불가 | 불가 | 소유자 RPC만 |
| reviews/posts | 게시된 visible 원문 | 공개 또는 본인 초안 | 본인, moderation 컬럼 불가 |
| comments | 공개 부모의 visible 댓글 | 동일, 차단 필터 | 본인 본문/삭제만 |
| tier_lists/publications | 현재 public 게시본만 | public 또는 소유자 | 일반 DML 금지, RPC |
| tier_list_drafts | 불가 | 불가 | 소유자 RPC만 |
| follows | 공개 관계 | 차단 필터 적용 | follower 본인만 |
| blocks | 불가 | 본인이 만든 차단만 | blocker 본인만 |
| reactions | 공개 대상 반응 | 동일, 차단 필터 | 본인 생성/삭제만 |
| activity_events | 공개 대상 이벤트 | 동일/팔로잉 조건 | 직접 쓰기 불가 |
| notifications | 불가 | recipient 본인만 | 본인 read_at만 |
| submissions/reports | 불가 | 본인 접수만 | 허용된 새 접수만 |
| private.* | 불가 | 직접 읽기 불가 | 허용된 함수/서버 절차만 |

public-safe view도 기반 테이블 RLS가 적용되도록 지원 버전에서 `security_invoker=true`를 사용한다. owner 권한으로 실행되는 view나 materialized view를 무심코 공개하지 않는다. [S04]

## 12. 권한 구현 규칙

단순 자기 행 변경은 컬럼 GRANT와 RLS, 제약조건, DB rate-limit trigger를 함께 적용한 뒤 사용자 세션으로 수행할 수 있다. 복합 저장과 관리용 테이블은 일반 DML 권한을 제거하고 지정 RPC로만 쓴다.

RLS는 일반적으로 행 단위이므로 다음 불변식에는 별도 컬럼 권한/trigger/RPC가 필요하다: user_id와 대상 FK 불변, notifications의 recipient 변경 금지, report 처리 상태 변경 금지, moderation_status 수정 금지, 좋아요 수 조작 금지. `owner=true` 정책만으로 이 컬럼을 보호했다고 보지 않는다.

pending 계정에는 이메일 확인/온보딩/로그아웃 등 필요한 경로만 허용한다. complete_onboarding은 확인된 Auth 사용자와 동의를 검증하는 별도 허용 함수이며, 일반 프로필 수정으로 active 상태를 만들 수 없다.

사용자 token으로 RPC를 호출할 때 함수 내부에서 `auth.uid()`를 검사한다. SECURITY DEFINER가 필요한 함수는 역할/소유자/부모 권한/입력/속도 제한을 스스로 검사한다. `search_path=''`와 fully-qualified 객체명을 사용하고 기본 PUBLIC EXECUTE를 revoke한다. 실행 권한은 함수별로 anon/authenticated 등 필요한 역할에만 부여한다. 동적 SQL은 사용하지 않는다.

차단 관계와 user_access 확인 helper는 필요 최소 bool만 반환한다. 호출자가 임의 user ID 목록을 넣어 private 상태를 전수 수집할 수 있는 RPC를 만들지 않는다. user_metadata의 role 값을 인증 권한으로 사용하지 않는다. [S04]

UI를 건너뛴 Supabase REST/SDK 쓰기에서도 동일 규칙이 적용되어야 한다. rate limit이 Next.js Route Handler에만 있으면 직접 DB 접근으로 우회될 수 있으므로 DB 변경 trigger 또는 동일 제한을 가진 RPC로 막는다.

## 13. Storage 정책

| Bucket | 공개 여부 | 허용 |
|---|---|---|
| avatars | public | 기본 프로필용으로 공개된 재인코딩 이미지. 업로드는 소유자 확인 후 서버에서 재인코딩한 파일만 |
| licensed-covers | private | 관리자가 승인한 파일만. 표시/OG/export마다 권한 검사 |
| user-exports | private | 생성 요청한 사용자만 짧은 만료 URL 발급 |

avatars의 anon/authenticated 직접 INSERT/UPDATE/DELETE는 허용하지 않는다. 인증된 서버 업로드 경로가 파일을 검증/재인코딩한 후 해당 사용자 경로에만 privileged client로 쓴다. 직접 Storage API로 검증을 우회할 수 없어야 한다. 삭제도 같은 서버 소유권 검증을 거친다.

경로는 `avatars/{uid}/{uuid}.webp`, `licensed-covers/{workId}/{assetId}.webp`, `user-exports/{uid}/{jobId}/...`로 제한한다. 업로드/삭제/목록 조회에 각각 정책이 필요하다. Storage 정책은 별도로 구성하고 DB RLS만 설정한 상태를 완료로 보지 않는다. [S08]

표지 요청은 현재 허가/작품 공개 조건을 확인하는 서버 프록시를 거친다. 클라이언트에 영구 공개 원본 URL을 주지 않는다. 캐시는 최대 60초를 초기 상한으로 두고, 철회 후 신규 응답은 차단한다. 이미 발급한 짧은 URL/클라이언트 캐시의 잔여 유효 시간과 이미 배포한 파일은 회수할 수 없음을 구분한다.

이미지 표시와 PNG/OG 사용 허가는 각각 다른 boolean이다. 아바타 bucket이 public이면 프로필 이미지 자체는 URL을 가진 사람이 볼 수 있다는 사실을 업로드 전에 설명한다. 비밀 데이터를 아바타로 업로드하도록 유도하지 않는다.

## 14. 삭제와 보존

콘텐츠 본인 삭제는 일반 화면에서 즉시 숨기고 짧은 정리 작업으로 원문/연결 파일을 제거한다. 법적 보존 필요성이나 분쟁 보존이 있으면 제한된 별도 저장소와 실제 정책을 따른다. 개발 문서가 임의의 법정 보존 기간을 확정하지 않는다.

계정 삭제 절차:
1. 최근 재인증 ticket을 확인하고 소비한다. user_access를 deleting으로 바꾸고 deletion job을 한 transaction으로 생성한다.
2. 해당 계정의 공개 프로필/평가/글/리뷰/티어/반응은 RLS와 조회 조건에서 즉시 제외한다. 공유 token을 철회한다.
3. worker가 avatar와 export 등 소유 Storage 객체를 먼저 제거한다. 자신의 일반 콘텐츠를 삭제하고 타인 스레드의 자신의 댓글은 본문 제거/author null로 만든다.
4. follows/blocks/reactions/notifications/개인 기록/티어 초안을 정리한다. 필요한 audit은 개인정보를 최소화하고 actor를 익명화한다.
5. Auth Admin API로 인증 계정을 삭제하고 잔여 FK/Storage/노출/통계를 검사한다. 작업 원장은 user FK 삭제로 함께 사라지지 않게 설계한다.
6. 단계별 idempotency와 재시도를 지원한다. 실패하면 deleting을 유지하고 관리자에게 처리 필요 상태를 남긴다.

Auth 사용자 삭제와 JWT 만료, Storage 소유 객체는 별도 문제이므로 모두 확인해야 한다. [S09, S10]

데이터 내보내기는 자기 기록만 포함하고 공급자 access token, 타인 비공개 데이터, 신고자의 신원, 허가 계약을 제외한다. 결과 파일은 24시간 보관 후 제거하고 60초 서명 URL로 전달하는 것을 초기 설계값으로 둔다.

## 15. 인덱스와 migration 순서

FK 조회 컬럼, 공개 상태/시간 정렬, `(user_id,work_id)`, follows의 양방향, blocks의 양방향, notifications `(recipient_id,read_at,created_at,id)`, comments `(target,parent_id,created_at,id)`, 공개 evaluations `(work_id,visibility,rating_steps)`에 적절한 인덱스를 둔다.

works의 검색 문자열과 creator/alias 검색에는 trigram 인덱스를 검토한다. 동일한 join 경로에서 원작자/장르/플랫폼 조합으로 평점 행이 곱해지지 않도록 통계는 평가를 먼저 집계한 뒤 메타데이터를 붙인다.

migration 권장 순서: enum/기본 helper → 프로필/접근 상태 → 카탈로그 → 서재/평가 → 리뷰/글 → 티어 → 소셜 → 신고/작업 → Storage → 공개 view/RPC → 인덱스/정책 테스트.

모든 migration에는 새 테이블 RLS, GRANT, 함수 EXECUTE, trigger를 포함한다. 스키마 재생성과 기존 데이터 migration을 각각 검사한다. 운영 데이터가 있는 테이블을 reset으로 갱신하지 않는다.


## P0 실제 스키마 상태 · 2026-10-02

`20261001151027_foundation.sql`은 CLI로 생성한 migration으로, 위 12개 도메인 enum과 private 스키마, 기본 권한 축소만 포함한다. 사용자 데이터 테이블, Storage 정책, RLS/RPC는 P1 이후 구현한다. **아직 로컬 DB에 적용하지 않았다.** `supabase/tests/00_foundation.test.sql`에는 스키마 권한·enum 및 앞으로 추가될 public 테이블의 RLS 누락을 검사하는 pgTAP 8개를 작성했으나 Docker 부재로 실행하지 못했다. 이 파일을 A/B/anon 직접 접근 검증을 완료한 근거로 삼지 않는다.
