# 04. 데이터 모델과 보안

이 문서는 **구현해야 할 스키마 계약**이다. 실행 가능한 migration이 이미 제공되었다는 뜻이 아니다. Codex는 이 계약을 SQL migration, 권한, trigger, 테스트로 구체화해야 한다.

## 1. 공통 규칙

ID는 UUID, 시간은 timestamptz/UTC를 사용한다. 생성/수정 시각은 DB에서 관리한다. 사용자 소유 데이터의 owner/user ID는 요청 body를 신뢰하지 않고 `auth.uid()`로 확정한다. 사용자 ID와 부모 ID는 생성 후 일반 수정으로 바꿀 수 없다. 다만 관리자 작품 병합처럼 명시적으로 검증한 transaction은 승인된 예외이며 일반 사용자 UPDATE로 실행할 수 없다.

`public`은 Supabase Data API에 노출할 스키마다. 이름이 public이라는 이유로 모든 행이 공개되는 것은 아니다. 모든 노출 테이블에 RLS를 활성화하고, 읽기/쓰기/컬럼 권한을 명시한다. `private`는 Data API 노출에서 제외하고 anon/authenticated의 직접 접근을 제거한다. [S04]

서재, 개인 평가, 공유 티어표를 별개 모델로 둔다. 별점과 티어를 두 군데에 저장해 어느 값이 최신인지 모르게 만들지 않는다.

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

### tier_list_publications

`tier_list_id`, `version` composite PK, `payload` jsonb, `published_at`.

payload에는 검증한 제목/설명/태그/행/배치된 work ID만 저장한다. 이미지 URL, 허가 문서, 비공개 메모, 미배치 작품, 토큰은 넣지 않는다. 게시 시 서버가 초안에서 만들어야 하며 사용자 임의 payload를 그대로 승인하지 않는다.

일반 사용자는 현재 published_version이 가리키는 게시본만 읽을 수 있다. 과거 게시본은 작성자와 허용된 운영 기능만 접근한다. 숨겨진 작품은 payload에 ID가 남아 있어도 모든 렌더와 export에서 필터링하고 비식별 대체 카드로 처리한다. 이전 표지 URL을 snapshot에 박아 넣지 않는다.

unlisted 게시본은 public table SELECT 정책으로 읽게 하지 않는다. 토큰 검증 전용 서버 경로/RPC를 통해 제한된 DTO만 반환한다. 토큰을 알았다는 이유로 초안이나 옛 게시본을 읽게 하지 않는다.

## 8. 소셜 테이블

| 테이블 | 주요 컬럼과 불변식 |
|---|---|
| follows | follower_id, following_id composite PK, created_at; 자신 팔로우 금지 |
| blocks | blocker_id, blocked_id composite PK, created_at; 자신 차단 금지, 목록은 차단자만 |
| reactions | id, user_id, review_id/post_id/tier_list_id/comment_id nullable, created_at; 정확히 한 대상 |
| activity_events | id, actor_id, review_id/post_id/tier_list_id nullable, event_type, created_at; 정확히 한 대상 |
| notifications | id, recipient_id, actor_id nullable, type, 대상 FK들 nullable, dedupe_key, read_at nullable, created_at |

reactions는 대상 유형별 `(user_id,target_id)` partial unique를 둔다. 좋아요는 공개된 접근 가능한 활성 콘텐츠에만 가능하고 자기 콘텐츠에는 할 수 없다. 좋아요 수를 사용자가 직접 update하지 못하도록 한다.

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
