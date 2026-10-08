# 05. 도메인 규칙과 API 계약

## 현재 인증 API·물리 접두사 · 2026-10-07

`signUp` 입력은 `{username,password,confirmPassword,terms,privacy,age14,returnTo}`이고 `signIn`은 `{username,password,returnTo}`다. 아이디를 서버 전용 Auth 식별자로 변환하며 비밀번호·서비스 키·Auth 응답 원문을 action state/URL에 넣지 않는다. 내부 주소는 연락/복구 이메일이 아니다. 가입 후 기본 private 설정과 필수 동의를 저장하고 자동 로그인하며 mail confirmation/추가 onboarding을 요구하지 않는다. 계정 복구는 준비 상태다. username 계정 비밀번호 변경은 currentPassword를 요구하고 실제 동일 Auth 사용자 재로그인 후 수행한다.

아래 논리 DB 함수/테이블 이름에는 실제로 `toon_`를 붙인다. private 객체는 `toon_private.toon_*`이며 DTO 필드명과 enum 값은 그대로다. 가입 reservation RPC는 service-role만 허용하고 global 60회/분·아이디별 3회/10분을 검사한다. 직접 사용자 데이터는 계속 사용자 세션/RLS/제한 RPC로 접근한다. IP 기반 배포 제한/CAPTCHA는 기존 후속 계약이며 이번에 구현했다고 주장하지 않는다. `zwzncrdlqnthxgdvsqxq`에 이 API의 DB source 17개를 MCP migration `toon_shared_project_username_auth`로 설치했다. 도구 success:true를 확인했고 실제 Auth/RLS/API 검수는 별도 사용자 요청 대기다.


아래 함수명은 구현 계약이다. 기존 코드에 더 적합한 이름이 있다면 일관되게 변경하고 문서를 갱신한다. Server Action과 REST API를 같은 기능마다 중복 구현하지 않는다.

## 1. 공통 응답

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | 'AUTH_REQUIRED' | 'EMAIL_UNVERIFIED' | 'ONBOARDING_REQUIRED'
          | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT'
          | 'RATE_LIMITED' | 'CONFIG_REQUIRED' | 'RIGHTS_RESTRICTED'
          | 'INTERNAL_ERROR';
        message: string;
        fieldErrors?: Record<string, string[]>;
        retryAfterSeconds?: number;
      };
    };

type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
```

오류에는 비밀번호, token, SQL 원문, 타인 계정 정보, 계약 근거를 넣지 않는다. 로그에는 correlation ID와 안전한 error code를 기록한다. Route Handler에서 같은 오류를 사용할 경우 401/403/404/409/422/429/500 등으로 매핑한다. 타인의 비공개 자료는 NOT_FOUND로 응답하는 것을 기본으로 한다.

client가 전달한 `userId`, `isAdmin`, `likesCount`, `publishedAt`를 그대로 저장하지 않는다. 소유자와 서버 관리값은 서버/DB에서 정한다. idempotency key를 사용자가 재시도할 때 유지하되 다른 사용자의 key를 재사용할 수 없게 범위를 묶는다.

## 2. 입력 크기와 기본 제한

| 입력 | 제한 |
|---|---|
| 검색어 | trim 후 1-100자, 빈 검색은 필터 탐색 |
| username | 소문자 영문/숫자/밑줄 3-20자 |
| 닉네임/소개 | 2-30자 / 0-160자 |
| 리뷰 본문 | 게시 시 20-5000자, 초안은 비어 있어도 됨 |
| 커뮤니티 제목/본문 | 5-100자 / 20-10000자 |
| 댓글 | 1-1000자 |
| 티어 제목/설명 | 1-80자 / 0-1000자 |
| 티어 행 이름 | 1-12자 |
| 개인 메모 | 최대 5000자 |
| 개인 태그 | 최대 20개, 태그당 1-20자 |
| 티어 테마 태그 | 최대 5개, 태그당 1-20자 |
| 신고 상세 | 10-2000자 |
| 티어 저장 payload | 최대 256KiB |
| 한번에 서재 일괄 변경 | 최대 100개 작품 |

문자 수는 검증 함수에서 일관된 Unicode code point 기준을 사용한다. 바이트 크기도 별도로 제한한다. HTML은 plain text로 escape한다. 외부 URL protocol과 host를 검증하고 SQL wildcard/필터 문자열을 직접 연결하지 않는다.

## 3. 서버 기능 목록

### 카탈로그

P2의 실제 함수 매핑은 다음과 같다. 아래는 작성한 계약이며 실행 검증 결과가 아니다.

| 서버 함수 | 사용자 세션 DB RPC | 현재 동작 |
|---|---|---|
| searchWorks | search_catalogue | 공개 DTO·필터·keyset; 최근/제목/공개 평균 별점 정렬 |
| getWorkDetail | get_catalogue_detail | 현재 공개 가능한 상세; merged slug는 공개 target만 반환 |
| submitSuggestion | submit_catalogue_suggestion | current UID/pending/요청 제한 |
| upsertWork | admin_upsert_work | 역할·source·expectedVersion·관계 저장·감사 log transaction |
| 관리 중복 확인 | admin_find_duplicates | 정확한 제목/별칭/정규화 URL 후보, 최대 25개 |
| getMergePreview / mergeWorks | admin_merge_preview / admin_merge_works | metadata 미리보기·version/확인/사유·원자적 관계 병합 |
| uploadCover / revokeCover | admin_begin_cover / admin_activate_cover / admin_revoke_cover | staged→파일 확인→active / 권리 철회 |
| reviewSuggestion | admin_review_submission | pending에서만 결과 변경; 반영한 공개 작품 확인 |

작품 입력은 제목 200자, 별칭 20개·각 200자, 직접 쓴 소개 2000자, 작가/공식 링크 각각 최대 20개, 장르 최대 12개, 전체 관리 payload 최대 256KiB(DB)를 기준으로 작성했다. 글자 수는 Unicode code point로 확인한다. source는 제목·연령·공식 링크 확인을 필수로 요구한다. 단순 같은 제목의 자동 병합이나 외부 플랫폼 소개/표지 수집을 제공하지 않는다.

**P3 평점순 카탈로그 계약 · 2026-10-03 (작성·미검증):** `search_catalogue`의 기존 argument signature를 유지하며 sort에 rating을 허용한다. 모든 검색 결과 카드에 `rating:{average:number|null,ratingCount:number}`를 추가하고 별점이 없으면 null/0이다. 평가 표본은 현재 볼 수 있는 활성 회원의 public rating_steps 한 행/회원/작품이며 비공개 상태에 종속되지 않는다. canonical tier만 있는 평가나 private 평가는 별점 분모에 넣지 않는다. 분류/작가 관계는 평가 집계 이후 카드에 붙여 중복을 방지한다. 검색·분류·공식 링크 필터와 page limit 기본 24/최대 50을 유지한다.

rating 정렬은 공개 별점 평균 내림차순(null last) → ratingCount 내림차순 → 작품 UUID 오름차순이다. 표시에만 소수 둘째 자리 반올림을 사용한다. rating next는 `{id,ratingSum,ratingCount,viewerId}`이며 ratingSum은 반점 단위 정수 합계다. 합계/건수는 0~JS safe integer 범위이고 건수 0이면 합계도 0, 양수면 건수~건수×10이다. server cursor v2는 모든 필터 fingerprint에 묶고 DB는 정수/키/현재 조회자/기준 작품의 현재 공개 합계·건수를 검증한다. 기준이 바뀌거나 접근 불가능하면 VALIDATION_ERROR로 첫 페이지 재시작을 안내한다. 기존 latest/title cursor v1 `{id,createdAt,title}`은 유지하며 title은 200 Unicode code point다. 페이지는 실시간 조회이며 다른 작품의 평가가 이동 중 바뀌면 순서/위치가 달라질 수 있다. snapshot/cross-user 캐시에 오래된 공개 점수를 남기지 않는다.

CAT-03 탐색의 rating은 일반 공개 평균 기준이며 평가 없는 작품도 포함한다. 아래 P6 순위용 최소 표본/weighted_score와 경험별 세부 표본 계약은 별도 후속 구현이다. P2 제보 결과는 `/submissions`에서 확인하며 P5에서 알림을 연결한다. P3 개인 기록 보존 병합은 아래 13절의 작성 범위로 확장했고 티어·게시글 등 후속 도메인은 각 보존 handler 작성 전까지 거절한다.

| 기능 | 입력/출력 | 규칙 |
|---|---|---|
| searchWorks | filters/cursor → WorkCardDTO page | 공개 작품만, 사용자 전체 기록을 포함하지 않음 |
| getWorkDetail | slug → 공개 메타데이터/집계 | 개인 평가 부분은 별도 인증 조회 |
| submitCatalogueSuggestion | kind/workId/proposal | 회원, pending만 생성 |
| adminUpsertWork | 검증된 work/creator/links | 관리자, source 기록, transaction |
| adminMergeWorks | sourceId/targetId/conflictPolicy | 관리자, 병합 미리보기와 감사 로그 |
| adminManageAsset | license metadata/upload | 관리자, 화면/OG/export 권한 구분 |

### 서재와 평가

**P3 첫 구현 · 2026-10-02:** `saveReadingRecord→save_reading_record`는 상태·개인 진행·평가를 한 번에 저장한다. payload에 owner ID를 받지 않으며 expectedVersion=null은 새 기록만 허용한다. `copyWorkToLibrary→copy_work_to_library`는 planned/default 범위로 최초 생성하고 기존 기록은 변경하지 않는다. `bulkLibraryChange→bulk_library_change`는 최대 100개 `{id,version}`과 delete/status/tag/libraryVisibility/evaluationVisibility를 검증한다. 삭제·planned 평가 제거는 확인을 요구하고 한 건의 오류도 전체를 rollback한다. `makeAllLibraryPrivate`는 항목/평가/기본값을 함께 변경한다.

본인 조회는 `get_my_library(filters,page)` 및 `get_my_reading_record`로 private details를 포함하며 기존 공개 조회 `get_public_library(username,page)`는 상태/평가 각각의 공개 여부만 투영하고 UUID순 프로필 목록 계약을 유지한다. 페이지는 24개, 번호 1~1000의 bounded offset 방식이다. 목록 변경 중 페이지를 이동하면 항목 위치가 바뀔 수 있다. cursor와 대규모 서재 pagination 최적화는 후속 작업이다. 본인 필터에는 제목·상태·플랫폼·장르·별점·티어·개인 태그를 지원한다. 모든 텍스트는 plain text다.

**공개 서재 필터 계약 · 2026-10-03 (작성·실행 미검증):** `getPublicLibrary(username,page,filters)`는 새 `search_public_library(p_username,p_filters,p_page)`를 호출한다. filters는 정확히 `{q,status,platform,genre,rating,tier,sort}`이며 null은 해당 조건 없음이다. q는 최대 100 Unicode code point의 공개 제목/별칭/작가 포함 검색이고 `%`·`_`·역슬래시는 LIKE 와일드카드가 아닌 문자로 처리한다. status는 reading/completed/dropped/planned, rating은 1~10 정수의 정확한 반점 단위 평가, tier는 S/A/B/C/D/F이며 플랫폼/장르는 활성 분류 한 개씩이다. tag·개인 메모·진행 정보·소유자 위조·알 수 없는 필드는 거절한다. 공개 투영 후 조건을 AND로 적용하며 평가는 공개 평가 행만 join한다. 상태 비공개/평가 공개 작품은 status 필터에 일치하지 않고 반대 경우에는 rating/tier 필터에 일치하지 않는다. 본인 방문도 public 투영을 유지한다.

sort는 title/rating/tier만 허용한다. rating은 공개 별점 내림차순, tier는 공개 S→F이며 미공개/미지정 값은 마지막이다. 동률은 공개 제목·작품 UUID로 정리하고 개인 생성/수정 시각은 사용하지 않는다. items는 기존 `{work,status,ratingSteps,canonicalTier}` public DTO이며 total/hasNext도 같은 필터 집합에서 계산한다. 가시성이 없는 회원은 null이고 현재 차단·계정·작품 공개 조건을 재사용한다. 공개 endpoint의 필터/총수/정렬에는 비공개 데이터를 넣지 않는다.

`get_reading_stats(null)`은 확인된 본인의 공개·비공개 기록, username을 전달하면 해당 사용자의 공개 상태와 공개 평가만 각각 집계한다. 장르는 작품별 장르 수로 비중을 나눈다. `get_work_evaluation_stats`는 활성 회원의 public evaluation 한 행씩으로 별점/티어 분모와 평균을 계산한다. 평가 없음은 null/0이다. 모두 현재 공개 가능한 작품만 포함하며 미실행·미검증이다. 평점순 카탈로그는 위 계약으로 작성했고 보정 순위/완독자 세부 표본은 아직 연결하지 않았다.

| 기능 | 입력 | 규칙 |
|---|---|---|
| saveLibraryEntry | workId, status, visibility, privateDetails | 상태와 private data를 transaction으로 저장 |
| saveEvaluation | workId, ratingSteps?, canonicalTier?, visibility | 서재가 있고 planned가 아니어야 함 |
| saveReadingAndEvaluation | entry와 evaluation | 작품 상세에서 함께 저장하는 단일 transaction |
| removeLibraryEntries | workIds, confirmEvaluationDeletion | private details/평가 cascade, 리뷰/티어는 유지 |
| bulkUpdateLibrary | 최대 100 workIds와 operation | 전부 검증 후 원자적 처리 |
| copyWorkToMyLibrary | workId | 존재하면 idempotent no-op, 타인 평가 미복사 |
| makeAllLibraryPrivate | confirmation | 항목/평가/기본 설정을 함께 private |
| getMyLibrary | own filters/cursor | 본인만, 공개/비공개와 개인 메모 포함 가능 |
| getPublicLibrary | username/page/선택 public filters | 기존 프로필 RPC 또는 search_public_library, 공개 상태/평가만 필터·정렬 |

서재/평가/상태 변경이 공개 수치에 영향을 주면 관련 집계는 다음 요청부터 반영되게 한다. 직접 테이블로 변경했을 때도 같은 불변식이 유지되어야 한다.

### 리뷰와 커뮤니티

**P3 리뷰 구현 계약 · 2026-10-02 (실행 미검증):**

| 서버 함수/조회 | 사용자 세션 DB RPC | 작성한 동작 |
|---|---|---|
| createReview | create_review_draft | 공개 작품에 현재 리뷰/초안 생성, 기존 current ID 반환 |
| saveReviewDraft | save_review_draft | owner + expectedDraftVersion, JSON 편집 초안만 변경 |
| publishReview | publish_review | expectedDraftVersion + expectedReviewVersion, 저장된 초안 검증/복사 |
| withdrawReview | withdraw_review | owner/version/확인, 공개 취소 또는 원문·초안 삭제 |
| getReview / revealReviewBody | get_review | current public DTO, 펼치기는 confirm + expectedVersion |
| listReviews | list_reviews | 작품 또는 username 한 조건, 첫 게시 최신순, 12개/페이지 |
| 본인 편집/목록 | get_my_review_editor / list_my_reviews | owner-only 초안/게시본 상태, 12개/페이지 |
| reportReview | report_review | 공개 타인 리뷰, reason/detail, pending 중복 방지 |
| setUserBlock / getMyBlocks | set_user_block / get_my_blocks | 확인된 본인 목표 상태, private 차단 목록 |
| 운영자 확인 | get_my_review_moderator_role | private 역할·현재 계정 조건 |
| 운영 목록/상세 | list_review_reports / moderation_review_snapshot | pending 20개/페이지, 최근 신고·감사 각각 최대 50개 |
| revealModerationBody | moderation_review_snapshot | 현재 운영 역할·게시 version 재검사, 공개 게시본만 |
| moderateReview | moderate_review | 현재 version·사유·hide/restore/reject_report, 선택 신고 결과·감사 원자적 저장 |

초안 payload는 `{body,isSpoiler,episode}`만 허용하며 32KiB/5000 Unicode code point 상한, 게시 때 trim 후 20자 이상을 검사한다. DB의 `review_text_trim`에도 JavaScript trim과 같은 공백 집합을 지정해 직접 RPC의 탭·줄바꿈·Unicode 공백만으로 게시 길이를 채우지 못하게 한다. 공개 회차는 null 또는 0~1,000,000 정수다. owner/역할/게시 상태는 입력받지 않는다. 게시 첫 시각은 업데이트·재게시에서도 유지하며 별도 수정 시각을 표시한다. 현재 UI는 수동 초안 저장 후 저장된 내용을 확인해 게시한다. 자동 저장은 구현하지 않았고 좋아요·댓글·좋아요순은 P5에서 연결한다. 공개 리뷰에서 작품을 가져오면 기존 서재 복사 RPC를 사용하며 리뷰 작성자의 평가/개인 기록을 복사하지 않는다.

스포일러 초기 body/excerpt는 null이고 직접 공개 테이블 조회도 허용하지 않는다. 읽기 전용 펼치기 action은 로그인 없이 명시적 POST 확인을 받을 수 있지만 DB에서 현재 published/visible/live work/author/차단/version을 다시 확인한다. 메타데이터와 목록에는 숨겨진 본문을 넣지 않는다. 운영 펼치기도 원문 version과 현재 역할을 검사하고 private 초안은 반환하지 않는다.

차단 변경은 이후 요청의 양방향 리뷰·프로필·공개 기록·집계에 적용한다. 작품의 공개 평가 집계는 로그인한 조회자의 차단 관계에 따라 분모가 달라질 수 있으므로 현재 볼 수 있는 평가 기준임을 표시한다. 비회원 조회에는 개인 차단 관계가 없고 이미 받은 본문을 회수할 수 없다. P5의 팔로우 정리·반응·댓글·피드/알림 검사는 아직 구현하지 않았다. `/me/reports`는 own RLS SELECT를 사용해 20개와 다음 페이지 여부만 제공한다. 아래 글/반응/댓글 및 범용 신고 계약은 후속 구현 대상이다.

| 기능 | 규칙 |
|---|---|
| createReviewDraft / createPostDraft | 작성자 부모 레코드와 owner-only 편집 초안을 생성 |
| saveContentDraft | expectedVersion을 검사해 private 편집 초안을 저장 |
| publishReview / publishPost | 초안 검증 후 공개 본문을 transaction으로 교체 |
| unpublishReview / unpublishPost | 게시 상태 변경, 피드/알림 조회에서 즉시 제외 |
| deleteReview / deletePost | 소유권, 즉시 숨김, 연결 토론 접근 차단 |
| createComment / updateComment / deleteComment | 공개 부모, 깊이/차단/소유권, 스포일러 검증 |
| setReaction | target + liked boolean, toggle 연산이 아니라 목표 상태 저장 |
| reportContent | target/reason/detail, 동일 pending 신고 중복 방지 |

리뷰/글의 게시 후 수정 내용은 현재 공개 본문을 덮어쓰지 않는다. 리뷰는 `toon_content_edit_drafts`, 글은 `toon_private.toon_post_drafts`에 저장하고 `게시본 업데이트`를 눌렀을 때만 공개 본문을 교체한다. 현재 두 편집 UI는 수동 초안 저장이며 자동 저장은 제공하지 않는다.

### P5 커뮤니티 글 계약 · 2026-10-08 (코드·migration 작성, DB 미적용)

| action/조회 | 사용자 세션 RPC | 계약 |
|---|---|---|
| createPost | toon_create_post_draft | caller UUID, 현재 owner 생성/동일 ID 재시도 |
| savePostDraft | toon_save_post_draft | owner + draftVersion, 허용 payload만 저장 |
| publishPost | toon_publish_post | owner + draftVersion/postVersion, 저장본 검증·원자 게시 |
| withdrawPost | toon_withdraw_post | owner/postVersion/확인, 공개 취소 또는 본문·초안 삭제 |
| getPost / revealPost | toon_get_post | 현재 공개 DTO, reveal은 확인 + expectedVersion |
| listPosts | toon_list_posts | category/work/q/page, 최초 게시 최신순 20개 + 다음 여부 |
| getMyPostEditor / listMyPosts | toon_get_my_post_editor / toon_list_my_posts | 소유자만, 목록에 draft 본문 제외 |
| reportPost / getMyPostReports | toon_report_post / toon_list_my_post_reports | 현재 공개 타인 글 신고, 본인 접수·결과 20개 |
| 운영 큐/검토/펼치기 | toon_list_post_reports / toon_moderation_post_snapshot | private 운영 역할, 큐 20개/신고·감사 각 최근 50개, 현재 게시본만 |
| moderatePost | toon_moderate_post | 버전·사유·hide/restore/reject_report·선택 신고 결과/감사 원자 저장 |

초안 payload는 `{title,body,category,isSpoiler,workIds}`만 허용한다. category는 request/recommendation/information/general, workIds는 중복 없는 공개 UUID 최대 5개이며 순서를 보존한다. 64KiB JSON/제목 최대 100자/본문 최대 10000 Unicode code point, 게시 시 JS와 같은 Unicode trim 후 제목 5자·본문 20자 이상을 검사한다. 작업자·상태·버전을 payload로 바꿀 수 없다. 작품 검색 action은 현재 회원/2~100자 검색어를 검사하고 공개 카탈로그 결과 최대 10개의 ID/제목/slug만 반환한다.

목록 q는 최대 100자, page는 1~1000, category/work는 지정된 enum/UUID만 받는다. 스포일러 글은 title/excerpt/body=null, works=[]이며 q/work 검색에서 숨긴 내용을 이용하지 않는다. 펼치기에 저장된 private 초안을 섞지 않는다. 메타데이터는 일반 안내이고 모든 글 페이지는 noindex다. 최초 게시 시각은 업데이트·공개 취소 후 재게시에도 유지하며 피드 이벤트도 한 번만 생성한다. offset 목록은 고정 snapshot이 아니므로 탐색 중 변경으로 항목 위치가 달라질 수 있다.

DB 사용자별 제한: 초안 생성 10회/10분, 저장 60회/분, 게시 10회/10분, 철회·삭제 20회/분, 신고 5회/10분, 운영 조치 30회/분. 동일 글 pending 신고는 중복 생성하지 않는다. 이미 받은 화면을 회수하지는 못하며 다음 조회부터 차단/공개 철회/운영 상태를 반영한다. 글 좋아요·댓글·인기순·관련 알림과 글 참조를 보존하는 작품 병합은 후속이다. 테스트 파일은 작성만 했으며 실제 사용자 흐름·DB 권한/경합·부하·UI 검수는 미실행이다.

### 티어와 소셜

| 기능 | 규칙 |
|---|---|
| createTierList | 기본 6행의 private 초안 생성 |
| saveTierDraft | expectedVersion, 전체 검증, 원자적 replace |
| publishTierList | expectedDraftVersion, visibility, 현재 초안에서 게시본 생성 |
| unpublishTierList | visibility=private, 공유 token 철회 |
| rotateTierShareToken | owner-only, 현재 게시본이 있을 때 새 토큰과 암호문 생성 |
| getMyTierShareLink | owner-only, 복호화하여 현재 유효 링크 반환 |
| getTierByShareToken | 토큰 hash/만료/현재 게시본/작품 조건, 제한 DTO |
| cloneTierList | 접근 가능한 게시본을 새 private 초안으로 복제 |
| importCanonicalTiers | 자신의 평가를 초안 배치로 가져오기 |
| applyTierToCanonical | 표준 행만, 변경 미리보기와 동의, 개인 평가 transaction |
| setFollow | targetUserId, following boolean |
| setBlock | targetUserId, blocked boolean, 양방향 follows 정리 |
| getFollowingFeed | 라이브 공개 권한 join, cursor |
| markNotificationRead / markAllNotificationsRead | recipient만 |

### P5 알림 계약 · 2026-10-08 (코드·DB 반영, 실행 미검증)

`toon_list_notifications(p_unread,p_cursor)`는 현재 수신자에 대해 `(created_at,id)` 내림차순으로 20개와 다음 위치, unreadCount, readThrough를 반환한다. 21개까지만 후보를 읽고 별도 원문 조회 없이 제한 DTO를 만든다. cursor는 UTC 소수 초 6자리를 보존하며 앱 envelope의 viewer/filter/v를 확인한다. DB cursor는 권한 없는 위치이고 수신자 권한을 넘기지 않는다. strict 입력과 응답 순서/중복/다음 위치/미읽음 개수를 검사하며 null/오류를 성공한 빈 목록이나 0으로 처리하지 않는다. `toon_notification_unread_count()`는 본인 전체 미읽음 수이고 일반 안내로 바뀐 알림도 포함한다.

`toon_mark_notification_read(p_id)`는 자신의 한 알림만 읽음으로 표시하고 재시도 시 기존 시각을 보존한다. 타인/없는 ID는 같은 NOT_FOUND다. `toon_mark_all_notifications_read(p_through)`는 본인의 미읽음 중 생성 시각이 cutoff 이하인 것만 처리하고 변경 개수·같은 cutoff를 반환한다. 미래/무한/잘못된 시각은 거절한다. cutoff는 화면에서 받은 생성 시각 경계이며 transaction commit 순서나 고정 snapshot을 보장하는 토큰은 아니다. 변경 응답의 ID/시각 형식을 확인한 후에만 inbox와 root layout을 무효화한다. 개별 읽음 120회/분, 모두 읽음 20회/분이며 모든 변경은 사용자 세션 RPC다.

수신 설정 followers/reactions/replies/announcements는 각각 팔로우/티어 좋아요/댓글·답글/제보 결과에 연결한다. 팔로우·좋아요는 기존 source pair mutex 안에서 직전 같은 사용자/대상/종류 알림으로부터 24시간 동안 생성을 억제하고 UTC 일자 dedupe key를 보조로 둔다. 취소/다시 누르기·재시도는 기존 시각이나 read_at를 되돌리지 않는다. 댓글은 source ID+수신자, 제보는 submission ID+수신자로 한 번만 생성한다. 답글은 원 댓글 작성자와 표 작성자에게 알리되 동일 수신자는 하나의 답글 알림, 자기 자신은 제외한다. 수정/재공개만으로 새 알림을 만들지 않는다. 원문 없는 불가 DTO에서는 원래 kind·actor·target도 제거한다. 기존 활동은 소급 알리지 않으며 리뷰/커뮤니티 등 아직 없는 반응/댓글 대상은 해당 도메인 구현 때 추가한다.

**P5 팔로우 계약 · 2026-10-07 (코드·DB 반영, 실행 미검증):**

- `toon_get_public_follow_state(username)` → 공개 `{id,username,name,avatarPath,followerCount,followingCount,following,canFollow,isSelf}` 또는 null. 별도 전역 캐시 없이 요청 단위 조회자 조건을 적용한다.
- `toon_list_public_follows(username,kind,page)` → `{profile,kind,page,total,hasNext,items}` 또는 접근 불가 null. kind는 followers/following, page는 1~1000이며 20명씩 관계 생성 시각 내림차순·상대 UUID 오름차순이다. 활성/현재 동의/확인·양쪽/조회자 차단을 페이지와 수에 먼저 적용한다. item은 id/username/name/avatarPath뿐이다.
- `toon_set_user_follow(targetUserId,following:boolean)` → 현재 target state. actor/카운터를 입력받지 않고 `require_current`와 pair 잠금으로 검사한다. 자기 팔로우는 SELF_FOLLOW, 불가 대상의 새 팔로우는 NOT_FOUND다. `following=false`는 불가 대상의 본인 관계도 지우고 state=null을 정상 반환한다. 새 팔로우의 null/잘못된 응답은 성공 안내 없이 INTERNAL_ERROR/재조회로 처리한다.
- `toon_set_user_block`의 API/기존 함수는 그대로다. 새 blocks BEFORE INSERT trigger로 양방향 follows만 추가 정리하며 기존 좋아요 정리도 유지된다. 차단 해제는 이전 팔로우를 복원하지 않는다. 팔로우/차단 action은 프로필·양쪽 목록 경로를 무효화한다.

DTO는 실제 정수 수와 공개 프로필 필드를 요구하고 추가 비공개 필드는 제거한다. 서버 입력은 strict schema로 actor/관계 수·문자열 boolean 주입을 거절한다. 버튼은 서버 확인 후 갱신하고 불확실한 변경 응답에서 재조회 전 새 변경을 막는다. 이 SQL만 MCP로 추가 적용했으며 실제 Auth/RLS/DB·UI·페이지/부하 검수는 미실행이다. 피드/알림과 다른 소셜 대상은 후속이다.
| compareWithUser / getRecommendations | 8-11절의 데이터와 수식 사용 |

### P5 팔로잉 피드 계약 · 2026-10-07 (코드·DB 반영, 실행 미검증)

- `toon_get_following_feed(p_cursor jsonb|null)` → `{hasFollowing,items,next}`. 사용자 ID는 받지 않고 현재 세션의 활성 회원만 읽는다. cursor는 정확히 `{id,createdAt}`이며 UTC 소수 초 6자리와 UUID를 검증한다. `(created_at,id)` 둘 다 내림차순, 현재 가시성 적용 후 최대 21개를 읽고 20개만 반환한다. 다음 후보가 있을 때 next는 마지막 반환 항목의 위치다.
- item 공통은 `{eventId,createdAt,author:{id,username,name,avatarPath},kind,id,isSpoiler}`다. review는 현재 공개 작품 `{id,title,slug}`와 비스포일러일 때만 최대 240자 excerpt, tier는 현재 공개 게시본의 비스포일러 title만 추가한다. 개인 평가/태그/회차/메모/초안/공유 token/원문 body는 없다. 글 대상은 후속이다.
- URL은 `/me/feed?cursor=<v1 envelope>`다. 서버 envelope는 현재 viewer와 정렬 위치에 묶고 1024자 상한·단일 인자·버전을 검사한다. DB 직접 호출에서 정렬 위치를 바꿔도 현재 auth.uid()의 공개 팔로잉 조건을 넘어설 수 없다. 기준 이벤트가 철회돼도 해당 위치 뒤의 현재 유효 항목을 읽는다.
- 초기 기존 공개 게시물 참조 이후 첫 공개 이벤트는 대상별 한 번만 생성한다. 수정/재게시/팔로우 반복으로 이벤트나 시각을 늘리지 않는다. 현재 내용/권한을 매번 읽으므로 이동 중 공개 상태·팔로우 관계 변화에 따라 목록은 달라질 수 있다. 고정 snapshot/실시간 전송은 제공하지 않는다.

빈 응답은 실제 `hasFollowing`에 따라 팔로우 없음과 공개 글 없음으로 구분한다. DTO 누락/null·스포일러 불일치·20개 초과·중복/순서·next 불일치·커서 이전 범위 위반은 INTERNAL_ERROR이며 빈 값으로 보정하지 않는다. 수정/철회/차단 후 재조회와 실제 SDK/DB/화면·권한·경합 검수는 미실행이다.

## 4. 제한된 HTTP 경로

| 경로 | 용도 |
|---|---|
| GET `/auth/callback` | OAuth 코드 교환, 공급자 검증 후 리다이렉트 |
| GET `/api/works/search` | 디바운스 자동완성, 제한된 공개 결과 |
| GET `/api/covers/[assetId]` | 현재 표시 권한 확인 후 이미지 프록시 |
| GET `/api/og/tiers/[id]` | 현재 public 게시본의 OG |
| POST `/api/tiers/[id]/export` | 본인 초안 또는 접근 가능한 게시본 PNG 생성 |
| POST `/api/share/tier/export` | 링크 토큰을 body로 전달하고 게시본 export |
| POST/DELETE `/api/account/avatar` | 소유자 확인, 업로드 재인코딩 또는 아바타 삭제 |
| POST `/api/account/export` | 본인 데이터 export job 생성 |
| GET `/api/account/exports/[jobId]` | 본인 job 상태/유효 다운로드 경로 |
| POST `/api/account/delete` | 재인증 후 deleting과 job 생성 |
| POST `/api/internal/jobs` | 내부 secret 전용 worker, 일반 사용자 호출 불가 |

나머지는 Server Actions와 DAL을 사용한다. GET에서 좋아요, 팔로우, 로그아웃, 삭제 같은 일반 사용자 변경을 수행하지 않는다. OAuth callback은 인증 프로토콜 목적의 예외다. 내부 worker는 origin 정책과 별개로 전용 secret을 검증하고 재시도에 안전해야 한다.

사용자 POST 경로는 세션과 Origin/CSRF 조건을 검사한다. CORS 전체 허용이나 임의 사이트에 쿠키 기반 API를 개방하지 않는다.

## 5. 티어 JSON 계약

```ts
type CanonicalTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
type TierRow = {
  id: string;             // UUID, 배열 순서가 행 순서
  label: string;
  colorToken: string;     // 미리 정의한 디자인 토큰 allowlist
  canonicalTier: CanonicalTier | null;
};
type TierPlacement = {
  workId: string;
  rowId: string | null;   // null은 미배치함
  position: number;       // 같은 행 안에서 0부터 연속
};
type TierDraftInput = {
  title: string;
  description: string;
  tags: string[];
  rows: TierRow[];
  placements: TierPlacement[];
};
type SaveTierDraftInput = {
  tierListId: string;
  expectedVersion: number;
  draft: TierDraftInput;
};
```

표준 행의 canonicalTier는 숨은 점수 추정값이 아니라 명시적 식별자다. 같은 canonicalTier를 여러 행에 배정할 수 없다. 새 사용자 지정 행은 null이다. 표시 이름이 `S급`이어도 null이면 개인 기본 티어로 자동 반영하지 않는다.

각 workId는 표당 한 번이다. rowId는 현재 rows 안에 있거나 null이어야 한다. position은 행마다 0부터 중복 없이 이어지고 서버가 다시 정렬/정규화한다. 다른 사람의 private 데이터나 숨겨진 새 작품 ID를 주입할 수 없다.

편집 중 기존 작품이 숨김 처리되면 작성자에게 접근 불가 placeholder를 보여주고 삭제는 허용한다. 새로운 숨김 작품을 추가하는 것은 금지한다. 게시 시 접근 불가 작품을 제외한 결과를 미리 보여주며, 공유 렌더 시에도 다시 검사한다.

## 6. 자동 저장, 게시, 동시성

### 초안 저장

변경 후 800ms 디바운스로 저장한다. 동시에 한 요청만 보내고 요청 중 새 변경이 생기면 가장 최신 상태를 다음 저장으로 보낸다. AbortController만으로 서버 변경 취소를 보장했다고 생각하지 않는다.

RPC 흐름: 인증/소유권/계정 상태 → 대상 행 FOR UPDATE → expectedVersion 비교 → payload와 신규 work ID 검증 → draft 전체 replace → version+1 → savedAt/version 반환. 불일치 시 CONFLICT와 서버 최신 version/updatedAt만 반환한다.

응답 전에 브라우저를 닫으면 저장되지 않을 수 있으므로 상태를 표시하고 이탈 경고를 제공한다. 임시 로컬 백업은 user ID와 list ID로 분리하고 로그아웃 시 지운다. 다른 계정 로그인에서 이전 초안을 복구하지 않는다. 클라이언트 undo/redo는 최근 50개 상태를 기준으로 하되 서버 version은 되돌리지 않는다.

**P4 첫 증분 RPC · 2026-10-03 (미적용/미검증):** `create_tier_draft(p_draft,p_origin)`은 본인 50표 상한을 검사한다. UI 신규 생성은 기본 6행, 본인 초안 복제는 `copy_tier_draft(id,version)`, 충돌 새 표 저장은 owner 검증된 origin의 기존 unavailable 작품만 보존할 수 있다. `save_tier_draft(id,version,draft)`은 성공 시 `{ok:true,version,savedAt,draft,works}`의 정규화된 초안과 현재 공개 작품 카드/placeholder를, 충돌 시 `{ok:false,conflict:{version,savedAt}}`만 반환하며 액션이 안전한 CONFLICT 메시지를 붙인다. 사용자 잠금 → 작품 UUID 순 SHARE → 초안 UPDATE 잠금으로 저장하고 merge의 반대 잠금은 NOWAIT 재확인으로 처리한다. hidden/merged 기존 작품을 보존/정규화하며 신규 숨김 주입은 거절한다. `delete_tier_draft(id,version,confirm)`은 초안/병합 원본을 지우고 metadata를 soft-delete한다.

`get_my_tier_editor`는 owner draft/현재 공개 작품 카드 또는 placeholder/최근 병합 원본 10건을 반환한다. `get_my_tier_merge_history(id,page)`은 본인 원본 20건 페이지다. `list_my_tier_drafts(page)`는 본인 초안 20건, `search_tier_draft_works(origin,q,page)`는 library/catalogue 출처의 공개 작품만 24건으로 반환하며 개인 메모/평가/태그를 검색 응답에 넣지 않는다. 색상 token allowlist는 S/A/B/C/D/F이며 canonical과 독립적이다. 로컬 영구 백업은 이번 증분에서 사용하지 않는다. API 지원 범위 밖 SPA 뒤로가기 경고의 브라우저 동작은 미검증 상태다. 게시/기본 평가 가져오기·반영/공개 복제는 후속 증분이다.

### 게시

발행은 별도 transaction이다. owner와 expectedDraftVersion을 확인하고 유효한 현재 초안에서 미배치 항목을 제거해 게시 payload를 만든다. `published_version`은 첫 게시 1, 이후 1씩 증가하는 게시 전용 번호다. 초안 version과 동일해야 할 필요가 없다.

새 publication 저장과 tier_lists의 published_version/visibility 변경을 원자적으로 처리한다. 링크 공개 게시/업데이트는 매번 새 token을 발급하고 기존 token을 철회한다. 암호화 자료는 서버에서 준비하여 소유권을 검증하는 지정 RPC에 전달한다. 클라이언트가 전달한 actor ID를 권한 증거로 삼지 않는다.

게시 성공 후 현재 공개 내용과 초안의 저장 상태를 따로 표시한다. 초안 autosave가 늦게 도착해도 게시본을 변경하지 않는다. 대표 티어표로 지정된 표를 private/unlisted로 바꾸거나 삭제하면 profiles.featured_tier_list_id도 같은 transaction에서 비운다. public→private/unlisted 변경 시 익명 일반 목록에서 사라지고, unlisted→private 변경 시 token 접근도 거절한다.

### 복제와 평가 반영

**P4 게시·공유 RPC · 2026-10-04 (미적용/미검증):**

| 기능 | RPC / 서버 규칙 |
|---|---|
| 저장된 초안 미리보기 | `preview_tier_publication(id)` → draftVersion/state/body/fingerprint, owner-only·30회/분 |
| 본인 게시 상태 | `get_my_tier_publication_state(id)` → lifecycle version/visibility/current publication/moderation/token 유효 여부 |
| 게시 | `publish_tier_list(id,draftVersion,listVersion,fingerprint,visibility,spoiler,encryptedToken,confirm)` → 새 state, user→works→metadata/draft 잠금·10회/분 |
| 비공개 전환 | `withdraw_tier_publication(id,version,confirm)` → pointer 제거·token 철회·version+1, 초안/옛 snapshot 유지·20회/분 |
| 링크 회전 | `rotate_tier_share_token(id,version,encryptedToken,confirm)` → unlisted/visible owner만 새 token·version+1·10회/분 |
| owner 주소 복구 | `get_my_tier_share_token(id,version)` → owner만 현재 hash/ciphertext/nonce, 서버 AAD/tag/hash 검증 후 URL·30회/분 |
| 현재 게시본 | `get_tier_publication(id?,hash?,reveal,version?)` → current DTO만, public은 UUID·unlisted는 hash 필수, 펼치기는 현재 lifecycle version |
| 최신 공개 목록 | `list_public_tiers(page)` → 현재 게시 시각 최신순 12개, 본문/배치 없는 카드·spoiler title=null |
| 현재 게시본 복제 | `clone_tier_publication(id,hash?,version,confirm)` → 새 private ID, 숨김 작품 제외/위치 압축·현재 접근/버전·50표 상한·10회/분 |
| 신고 | `report_tier_publication(id,hash?,reason,detail)` → 현재 접근 가능한 타인 게시본, pending unique·5회/분 |
| 신고자/운영 목록 | `list_my_tier_reports(page)` / `list_tier_reports(page)` → 본인 또는 private 역할 게이트·20개/페이지 |
| 운영 현재 게시본 | `moderation_tier_snapshot(id)` → 현재 게시본/신고/감사만·private 초안/옛 게시본/token 제외 |
| 운영 조치 | `moderate_tier_publication(id,version,action,reason,report?,result)` → hide/restore/reject_report, 결과/감사/version 원자 처리·30회/분 |

암호문 자료는 `{hash,ciphertext,nonce}` 세 필드뿐이며 token은 32바이트 난수의 정규 base64url(43자), hash는 SHA-256 hex다. ciphertext는 43바이트 token과 16바이트 GCM tag, nonce는 12바이트를 hex로 보관한다. 공개/링크 payload는 title/description/tags/rows/placed work UUID만 보관한다. reader DTO는 행별 public WorkCard 또는 null 대체이며 숨김 UUID·미배치·비공개 메모·token·원격 이미지 URL을 포함하지 않는다. spoiler는 기본 표시이며 최초 body=null, 명시적 POST 확인 뒤 현재 권한/버전을 재검사한다. 스포일러/링크 공개의 제목·배치를 metadata/OG에 넣지 않는다. OG 텍스트 metadata는 모두 일반 안내이며 스포일러 없는 public 이미지에만 현재 일부 행 텍스트를 포함한다.

초안 version, lifecycle version, 단조 publication_counter는 별개다. 초안 저장은 lifecycle과 현재 게시본을 변경하지 않는다. 회전/철회/게시/운영/작품 병합은 lifecycle을 올려 오래된 작업을 거절한다. 삭제 RPC는 publication·token도 제거하며 현재 조회 경로는 모두 dynamic/no-store다. 현재 신고자 상세·결과는 private owner RPC만, 운영자 snapshot은 현재 public/unlisted 게시본만 제공한다. 보관한 옛 게시본의 owner UI·비회원 PNG 등은 후속이며 실행 검증은 없다. 기본 평가/반응/탐색·대표 지정과 철회 연동은 아래 후속 증분으로 작성했다.

**P4 대표 티어표 계약 · 2026-10-05 (작성·미적용/미검증):**

| 경로 | 계약 |
|---|---|
| 본인 대표 조회 | `get_my_featured_tier_state()` → 현재 계정의 `{id:null|uuid,version}`. 타 사용자 인자를 받지 않음 |
| 지정·교체·해제 | `set_featured_tier(id:null|uuid,tier_version:null|bigint,featured_version:bigint)` → 본인 public/visible/미삭제 표의 현재 lifecycle·대표 revision을 검사하고 `{id,version}` 반환. null/null은 해제, 20회/분 제한 |
| 공개 프로필 카드 | `get_public_featured_tier(username)` → 현재 접근 가능한 본인 대표의 현재 게시본 카드 또는 null. 스포일러 title/tags=null, 기존 유효 likeCount/recentLikeCount, body/초안/옛 게시본/token/대표 revision 없음 |

대표 포인터 변경/자동 해제만 대표 revision을 올린다. 같은 값의 재요청도 기대 revision은 검사하고 일치하면 idempotent다. public 게시본 업데이트는 대표를 유지하며 private/unlisted/hidden/삭제는 같은 transaction에서 해제한다. 복구/재공개만으로 되살리지 않는다. A→B→A 후 옛 해제/교체와 대상 lifecycle 변경은 CONFLICT다. 새 보호 열은 raw profiles SELECT로 읽지 않으며 `/u/*`는 private/no-store, 관련 action은 프로필 page를 무효화한다. 모든 실제 DB/권한/경합/캐시/화면 검수는 미실행이다.

**P4 PNG/OG 계약 · 2026-10-04 (작성·미적용/미검증):** POST `/api/tiers/[id]/export`의 strict JSON은 `{source: draft|publication,version,token:null|string,confirm:true,confirmSpoiler:boolean}`이며 2KiB 이하·서비스 Origin만 허용한다. 활성/이메일 확인/동의 회원만 이용하고 token은 POST body에서 hash로 바꾼다. `begin_tier_image_export(id,source,version,hash?,confirmSpoiler)`는 owner 초안 또는 현재 접근 가능한 게시본을 검사해 `{id,source,version,isSpoiler,body:{title,description,tags,rows:[row+items:[{title}|null]]},unplaced:[{title}|null]}`를 반환하며 공통 계정 bucket을 5회/고정 600초로 예약한다. source=publication은 lifecycle version, draft는 draft version이며 전자 unplaced=[]다. 스포일러 게시본은 confirmSpoiler=true를 요구한다. 계정/소유권/차단/author/운영/숨김 작품을 UI와 무관하게 RPC에서도 검사하며 raw work/asset/token/개인 메모를 projection하지 않는다.

한 번의 예약으로 최대 8장·PNG 합계 16MiB를 만들고 페이지가 하나면 PNG, 둘 이상이면 fixed ASCII PNG filenames의 ZIP을 반환한다. `X-ToonShelf-Pages`와 attachment filename을 제공한다. 성공 직전 `get_tier_image_source`로 다시 읽어 SHA-256 fingerprint가 바뀌거나 권한이 철회되면 409/404/권한 오류로 반환한다. rate 예약은 성공적으로 커밋된 뒤 렌더 실패/취소에도 환불하지 않는다. 요청/렌더 제한과 안전한 오류를 작성했으며 실제 실행 근거는 없다. 비회원 PNG와 신뢰된 token/IP 제한은 후속이다.

GET `/api/og/tiers/[id]`는 query/hash를 받지 않고 현재 public을 전후 조회한다. 스포일러는 일반 카드, 그 외 현재 일부 행의 텍스트 미리보기며 private/unlisted/숨김/철회는 404다. `/api/og/tiers`는 ID/token/사용자 내용과 무관한 일반 카드다. PNG/OG 모두 자체 텍스트 표지·로컬 OTF만 사용하고 no-store/no-referrer/noindex다. 이미 받은 이미지와 외부 플랫폼 재캐시는 회수하지 못하며 다음 요청의 현재 권한을 검사한다. OG edge 제한과 허가된 표지의 목적별 선택은 후속이다.

**P4 공개 티어표 좋아요 계약 · 2026-10-05 (작성·미적용/미검증):** `get_tier_like_state(id)`는 현재 접근 가능한 public 표만 `{id,version,likeCount,liked,canLike}`로 반환하며 불가 대상은 null이다. anon도 수를 읽지만 liked/canLike=false이고 유효한 실제 세션과 활성 계정만 본인 상태/변경 가능 여부를 받는다. 반응자 ID·제목/본문/token은 반환하지 않는다. `set_tier_like(id,version,liked)`는 활성 타인 회원/현재 public·차단/작성자 상태/lifecycle version을 잠금 뒤 확인하고 같은 DTO를 반환한다. boolean은 원하는 상태이며 중복 호출이 수를 늘리거나 상태를 뒤집지 않는다. 클라이언트 actor/count/token 입력은 거절한다. DB 40회/분 제한은 좋아요/취소/중복 요청 모두 같은 회원 bucket에 적용한다.

`get_tier_publication`의 제한 DTO와 `list_public_tiers`의 카드에 likeCount를 추가한다. unlisted 게시본의 count는 null이다. 작성자/조회자와 상호 차단된 반응자 또는 비활성/미확인/동의 변경 계정은 집계에서 제외되므로 조회자별 유효 수가 달라질 수 있다. 저장된 count 컬럼·가짜 수·반응자 목록은 없다. 목록은 기존 최신순을 유지한다. 차단 시 두 사용자가 상대 표에 한 반응만 transaction으로 삭제하고 해제는 복원하지 않는다. soft delete/탈퇴는 정리하고 비공개/링크 전환은 보관 후 공개 재게시 때 재검사한다. 인기/테마·다른 대상/알림·댓글/팔로우는 후속이다. OG에는 수를 넣지 않으며 수 변경만으로 이미지 내용 충돌을 발생시키지 않는다. 모든 실행 검수는 미실행이다.

**P4 기본 평가 연결 계약 · 2026-10-04 (작성·미적용/미검증):** 아래 RPC는 활성 소유자와 현재 세션만 사용하며 관리자도 타인 자료를 조회/적용할 수 없다.

| RPC | 계약 |
|---|---|
| `get_my_tier_evaluations(id,mode,page)` | import/apply 후보 24개·1–1000페이지, 현재 초안 version/title·hasMore와 사유. import는 본인 canonical 평가, apply는 저장된 배치. 비공개 상세는 제외 |
| `preview_tier_evaluations(id,mode,version,choices)` | strict `{workId,status:null|reading|completed|dropped}` 1–100개, expected draft version. 변경 목록/nextStatus/fingerprint·60회/분 |
| `commit_tier_evaluations(id,mode,version,choices,fingerprint,confirm)` | 같은 선택·64자 hash·confirm=true, 잠금 후 현재 snapshot 재검사, 원자 처리 후 `{version,changed}`·30회/분 |

UI는 한 페이지의 선택을 적용하며 이동 시 초기화한다. 상태 선택은 apply의 새 기록/planned에서만 필수이고 그 밖의 상태 입력은 거절한다. source 개인 tier/별점·두 공개 범위·서재 version와 현재 public 작품 version/제목·원래/대상 행·명시 코드·상태 선택이 snapshot에 포함된다. 임의 사용자 ID·별점·반영할 코드 입력은 허용하지 않는다. 불가/미배치/사용자 행/대응 코드 없음/이미 동일 값은 사유를 표시하고 선택 시 재확인을 요구한다. 가져오기는 선택한 기존 배치를 제거한 뒤 대응 행 끝에 UUID순으로 붙이고 다른 작품 순서와 연속 위치를 보존하며 새 추가 뒤 300 상한을 검사한다. apply는 draft/publication을 변경하지 않는다. import는 publication을 변경하지 않고 draft version만 올린다. 개인 평가·서재 갱신 원칙은 다음 문단과 같다. 모든 검사는 미실행이다.

다른 사용자 표 복제는 자신이 열람 가능한 **현재 게시본**만 복사한다. 새로운 표는 private이고 좋아요, 댓글, 원 작성자의 user ID, token은 복사하지 않는다. 복제 출처 표 ID는 선택 메타데이터로 보관할 수 있으나 원본 비공개 정보를 읽는 권한이 되지 않는다.

개인 기본 티어로 반영할 때 변경 목록을 보여주고 적용 작품마다 읽기 상태가 필요하다. 새 서재 항목이나 planned 항목은 사용자가 명시적으로 reading/completed/dropped 중 선택하게 한다. 이미 있는 별점은 유지하고 canonical_tier만 변경한다. 기존 공개 범위는 유지하며 새 평가는 기본 private다. 미배치/사용자 지정 행은 건너뛴다.

## 7. 좋아요, 댓글, 신고의 원자성

setReaction과 setFollow는 목표 boolean을 받아 재시도에 안전하게 한다. `현재 값을 반대로` 구현하면 네트워크 재시도가 원치 않는 취소를 만들 수 있다.

부모 공개 상태, 계정 상태, 차단 관계와 대상 동일성을 검사한 뒤 unique constraint 기반 insert/delete한다. 반응과 알림 이벤트 생성은 transaction으로 묶는다. 알림 실패 때문에 별도 비동기 중복 좋아요를 만들지 않는다.

같은 알림을 재발급하지 않도록 source event와 recipient로 dedupe한다. 좋아요 취소 후 다시 누르기를 반복하여 알림이 누적되지 않게 같은 사용자/대상/종류에 대해 24시간 단위 묶음을 적용한다. 수정/재게시만으로 새로운 팔로잉 피드 이벤트를 무한 생성하지 않는다.

신고는 증거 없는 자동 제재 점수로 사용하지 않는다. 운영자 조치 함수는 권한, 조치 사유, 대상 상태와 감사 이력을 묶어 처리한다. moderator는 admin 역할 부여나 이미지 사용 허가를 승인할 수 없다.

### 공개 티어 댓글 RPC · 2026-10-05 (작성·미적용/미검증)

- `list_tier_comments(tier,tier_version,parent=null,page=1)`은 current public 접근/기대 lifecycle을 검사해 같은 대상 roots/replies 20개+hasNext를 반환한다. page 1~1000, root 최신순·reply 작성순·ID tie다. `get_tier_comment(id,tier_version,version=null,reveal=false)`는 같은 현재 권한의 단일 댓글이며 reveal=true는 expected comment version을 필수로 한다. inaccessible은 null, stale version은 CONFLICT다. DTO는 id/tierId/parentId/version/시각/deleted/effective isSpoiler/body/제한 author/canEdit/canReport/canReply/현재 접근 가능한 replyCount뿐이며 초기 spoiler body=null이다.
- `create_tier_comment(id,tier,tier_version,parent,body,spoiler,confirm)`은 회원 현재 세션·이메일/동의/활성·public 부모·차단·한 단계/동일 대상·trim 후 1~1000 code point/4000 UTF-8 byte·동의를 검사한다. 성공 UUID는 client 요청 ID다. UUID를 동일 내용의 응답 유실 재시도에 유지하며 id conflict를 다른 내용으로 덮어쓰거나 별도 댓글로 바꾸지 않는다. 성공 후 입력을 비우고 새 자료를 불러온다.
- `get_my_tier_comment(id,tier_version,version)`은 현재 접근 가능한 본인 댓글의 stored spoiler/body만 명시 반환한다. `update_tier_comment(id,tier_version,version,body,spoiler,confirm)`은 같은 경계/소유권과 기대 댓글 버전을 검사한다. 수정은 명시 저장으로만 공개 본문을 바꾸며 자동 저장하지 않는다. `delete_tier_comment(id,version,confirm)`은 본인/현재 계정·기대 버전으로 body=NULL tombstone을 남긴다. 부모의 비공개/운영 숨김 후에도 자신의 본문 제거만 허용하고 토론 metadata/body를 반환하지 않는다. 삭제 root의 기존 replies는 유지하며 새 replies는 거절한다.
- `report_tier_comment(id,tier_version,version,reason,detail)`은 현재 보이는 미삭제·비본인 댓글과 10~2000자 사유를 검사하고 본인/댓글 pending unique로 중복 접수를 막는다. `list_tier_comment_reports(page,own)`은 own=true 회원 본인의 접수/결과 최신순 또는 own=false moderator/admin 대기 큐 작성순 20개다. 신고자 ID/타인의 신고 내용은 일반 댓글 DTO에 없다.
- `moderation_tier_comment_snapshot(id,version=null,reveal=false)`는 역할 기반 metadata/최근 신고·감사 각 50개이며 initial body=null이다. explicit reveal은 기대 version과 현재 public·미삭제 부모/댓글을 검사한다. 비공개·unlisted·삭제한 원문은 제공하지 않는다. `moderate_tier_comment(id,version,action,reason,report,result)`는 hide/restore/reject_report·2~1000자 비공개 사유/선택 신고의 2~500자 결과·기대 버전을 같은 transaction으로 처리한다. hide/restore는 현재 public 부모의 살아 있는 댓글만, reject는 pending 선택 신고만 허용한다. audit에는 원문을 복사하지 않는다.

효과적인 spoiler는 현재 tier publication OR root comment OR comment flag다. raw 댓글/신고/감사는 직접 SELECT/DML을 부여하지 않으며 strict action 입력은 actor/count/token/reparent 등 허용하지 않는 필드를 거절한다. 작성/수정/삭제 각각 30회/5분, 신고 5회/10분, 운영 30회/분이며 RPC는 5초 statement 제한을 갖는다. 차단은 저장 댓글을 보존하고 현재 조회/변경에서 검사한다. comment version과 tier lifecycle은 별개이며 댓글 변경은 초안/기본 평가/공개 표 version을 올리지 않는다. 같은 표에 공개 게시본을 갱신해도 토론을 복제하지 않는다. 스레드 원 댓글의 spoiler 변경/삭제/숨김·tier 공개 상태는 매 요청에서 다시 확인한다.

SQL 파일과 수기 TS 계약·테스트 파일만 작성했다. 실행 검증/DB 적용/생성 타입/실제 사용자 흐름은 없고 다중 세션 경합/캐시/성능 검수는 대기다. 최근 7일 좋아요순은 유지하고 아래 전체 댓글 가중 인기 공식·다른 대상 댓글/댓글 반응/알림은 후속이다.

## 8. 평점과 티어 통계

### 포함 대상

활성 계정의 visibility=public인 user_evaluations만 공개 집계한다. 작품도 현재 공개 가능해야 한다. 작성자가 탈퇴/정지/비공개 전환하면 다음 조회에서 제외한다. 커스텀 티어표의 배치는 집계하지 않는다.

rating_count는 rating_steps가 있는 사용자 수, tier_count는 canonical_tier가 있는 사용자 수다. 둘을 같은 분모라고 가정하지 않는다. 같은 작품의 여러 플랫폼을 join해 평가가 중복되지 않도록 먼저 평가를 작품별로 집계한다.

### 화면 평균

`평균 별점 = SUM(rating_steps / 2.0) / 별점 평가 수`.

평가가 없으면 null과 count=0을 반환한다. UI는 `평가 없음`을 표시한다. 평균은 두 자리까지 표시할 수 있으나 개인 입력은 0.5 단위만 허용한다.

### 순위용 보정

순위는 최소 공개 별점 5건 이상 작품을 대상으로 다음 값을 쓴다.

```text
R = 해당 작품의 공개 평균 별점
v = 해당 작품의 공개 별점 수
C = 사이트 전체 유효 공개 별점의 평균 (평가 행 기준)
m = 20 (초기 설계 상수)
weighted_score = (v * R + m * C) / (v + m)
```

표시 평균은 R이고 정렬만 weighted_score다. 동점이면 v 내림차순, work ID로 안정 정렬한다. 전체 평균을 구할 수 없는 빈 DB에서는 순위가 없다. 필터마다 C를 자의적으로 바꾸지 않고 같은 시점의 사이트 전체 기준을 사용한다.

예: C=3.8이면 5.0점/5명인 작품의 보정은 4.04, 4.6점/100명인 작품은 약 4.466667이다. 첫 작품의 표시 점수는 여전히 5.0이다. 이 방식은 프로젝트의 비교용 설계이며 품질에 대한 객관적 진실이 아니다.

### 상태와 경험 필터

완독자 평점은 public 평가와 public library entry의 status=completed가 동시에 있는 사용자만 포함한다. 서재 상태가 private인 사용자의 완독 여부를 추론하거나 분모에 넣지 않는다.

공개 독서 기록 30편 이상 필터는 public library_entries 중 planned를 제외한 작품이 30개 이상인 사용자만 대상으로 한다. 이름도 `공개 독서 기록 30편 이상 회원`으로 표시한다. 비공개 기록을 기준으로 공개 자격 배지를 만들지 않는다.

각 조건별 표본이 5건 미만이면 평균을 숨기고 `표본 부족`과 공개 가능한 건수만 표시한다. 사용자별 점수와 전체 순위/세부 표본의 차이를 안내한다.

### 티어 분포

S/A/B/C/D/F별 사용자 수를 tier_count로 나눈다. NULL은 분모에서 제외한다. 반올림으로 합계가 100%에서 어긋날 경우 실제 수를 함께 표시하거나 largest remainder 방식으로 합계만 보정한다. 원 데이터는 바꾸지 않는다.

## 9. 취향 비교

대상은 본인이 열람 가능한 자신의 평가와 상대의 public 평가다. 상대 계정은 활성이고 차단 관계가 없어야 한다. 공개 사용자 추천 목록의 후보는 discovery_opt_in=true여야 한다.

같은 작품에서 둘 다 canonical tier가 있으면 티어를 비교한다. 둘 다 티어가 있지 않지만 둘 다 별점이 있으면 별점을 비교한다. 한 사람은 티어만, 다른 사람은 별점만 있으면 그 작품은 점수 계산에서 제외한다. 한 작품을 두 신호로 중복 계산하지 않는다.

```text
티어 정규화: S=1.0, A=0.8, B=0.6, C=0.4, D=0.2, F=0.0
별점 정규화: (rating_steps - 1) / 9
n = 비교 가능한 공통 작품 수
similarity = 100 * (1 - mean(abs(my_value - other_value)))
confidence = n / (n + 10)
추천 후보 정렬용 보정값 = similarity * confidence
```

n<5이면 similarity를 null로 반환한다. n=5-9는 적은 표본, 10-29는 보통 표본, 30 이상은 많은 표본으로 설명하되 정확도의 통계적 보장으로 표현하지 않는다. 화면 점수는 정수로 반올림하고 0-100으로 제한한다.

예: 5개 작품의 정규화 차이가 0, 0.2, 0.2, 0.4, 0.2이면 점수는 80이다. 별점만 있는 0.5점과 5점의 비교 차이는 1이다.

함께 S인 작품과 차이가 큰 작품은 현재 읽기 권한을 다시 확인한 공개 작품만 보여준다. 비공개 작품 수를 역산하게 하는 원시 전체 평가 수는 상대에 대해 반환하지 않는다. 내 비교 결과는 private/no-store로만 제공한다.

## 10. 취향 분석과 추천

### 장르 비중

읽은 작품 수는 library entry에서 planned를 제외한다. 작품에 장르가 k개 있으면 각 장르에 1/k씩 분배한다. 장르가 없는 작품은 `미분류`에 1을 배정한다. 이 합을 전체 읽은 작품 수로 나눈다. 여러 장르를 중복으로 100%씩 집계해 전체 비중이 100%를 초과하지 않게 한다.

내 통계에는 내 비공개 기록을 포함할 수 있다. 공개 프로필 통계에는 공개 서재만 사용한다. 플랫폼 비중은 한 작품에 여러 플랫폼이 있으면 같은 분할 기준을 쓰며, 실제 어떤 플랫폼에서 읽었는지 공개적으로 추정하지 않는다.

### S 평가 독자의 관련 작품

기준 작품을 public S로 평가한 활성 사용자 집합을 만든다. 후보 작품도 public 티어가 있는 평가만 사용한다.

```text
n = 기준 작품 S 평가자 중 후보 작품에도 공개 티어를 남긴 사용자 수
s = 그중 후보 작품을 S로 평가한 사용자 수
co_s_ratio = s / n
ranking_score = co_s_ratio * n / (n + 10)
```

n>=5이고 s>=3인 후보만 노출하는 것을 초기 기준으로 한다. 기준 작품, 접근 불가 작품을 제외한다. 화면에 n과 s를 표시하며 전체 독자의 확률이라고 표현하지 않는다.

### 개인 추천

공통 평가가 있는 사용자 중 앞 절의 보정값이 높은 후보 최대 50명을 사용한다. 이웃 후보 탐색 자체도 먼저 최대 200명으로 제한하고 공개 평가 overlap을 인덱스 기반으로 찾는다. 모든 사용자 쌍의 전수 비교를 요청마다 하지 않는다.

이웃의 public 평가를 사용해 후보 작품별 가중 평균을 계산한다. 티어가 있으면 티어 정규화, 아니면 공개 별점 정규화를 쓴다. 가중치는 similarity/100 * confidence다. 최소 3명의 유효 이웃 평가가 있는 후보만 협업 추천으로 표시한다.

내 서재에 이미 저장한 작품, 숨김/성인/미검증 작품을 제외한다. 추천 이유는 `비슷한 공개 평가를 가진 7명이 높게 평가했어요`처럼 실제 계산 근거에 한정한다. 이 숫자는 평가자 수이지 나를 좋아할 확률이 아니다.

### 데이터 부족

평가가 적으면 선택 장르 기반 공개 작품을 먼저 보여주고 `장르 기반 추천`으로 표시한다. 인기 기반 보완은 표본을 충족한 보정 순위를 이용한다. 모든 데이터가 없으면 작품 검색과 기록 시작을 안내한다. 랜덤 숫자로 취향 일치도나 추천 이유를 생성하지 않는다.

## 11. 인기 목록

**공개 티어 댓글 가중 인기 증분 · 2026-10-07 (코드·DB 반영, 실행 검수 대기):** 기존 `toon_search_public_tiers`의 입력과 `sort=popular` URL을 유지하며 정렬값을 아래 전체 공식으로 바꾼다. 탐색 DTO는 `recentCommenterCount`와 `popularityScore`를 필수 계산값으로 추가하고 서버 파서는 안전한 정수·최근 좋아요 상한·점수 공식과의 일치를 검사한다. 대표 티어 조회의 기존 카드 DTO는 별도로 유지한다. 일반 최신순은 13개 후보를 먼저 제한한 뒤 같은 반응 수를 계산하며 인기순은 현재 볼 수 있는 후보의 점수를 계산해 점수 내림차순→게시 시각 내림차순→ID 오름차순으로 12개씩 제공한다.

댓글 참여자는 `[transaction now - 168시간, transaction now]`에 **생성된** 현재 유효 원 댓글·답글의 서로 다른 user_id다. 수정/복구만으로 생성 시각을 새로 만들지 않는다. 작성자 자신의 댓글, 삭제/익명화·운영 숨김·정지/미확인/동의 변경 계정, 작성자/조회자와 차단된 작성자는 제외한다. 기존 댓글 접근 helper를 사용해 숨김/차단/비활성 원 댓글 아래의 답글도 제외한다. 삭제된 원 댓글은 참여자를 제공하지 않는 tombstone이며 현재 접근 가능한 살아 있는 답글은 센다. 스포일러 원문·댓글 ID/작성자 목록은 집계 DTO에 없고 태그·페이지 경계는 기존과 같다. 최근 0도 실제 집계값이며 댓글 가중 점수는 티어 목록에만 구현했다. 리뷰/커뮤니티 인기와 snapshot·부하/권한/브라우저 검수는 후속이다.

**공개 티어 탐색 첫 증분 · 2026-10-05 (작성·미적용/미검증):** `search_public_tiers(p_sort='latest',p_tag=null,p_page=1)`는 최신 게시순/`popular` 최근 7일 좋아요순, 정확한 게시본 태그 한 개, 1~1000의 12개 페이지를 지원한다. UI의 명칭은 실제 계산하는 `최근 7일 좋아요순`이다. P5 첫 티어 댓글 도메인을 작성했지만 아래 댓글 가중 전체 공식은 다음 탐색 증분으로 남겨 둔다. `list_public_tiers(page)`는 기존 이름/인자를 보존하고 새 RPC의 최신순/태그 없음으로 위임한다. 태그는 1~20 Unicode code point, 대소문자/공백을 구분하는 literal JSON array containment다. 빈 form 태그는 필터 없음이며 SQL wildcard/부분 문자열/초안/옛 게시본/개인 태그 검색을 하지 않는다.

카드에는 기존 제한 메타데이터와 `likeCount`, `recentLikeCount`, `tags`를 반환한다. 현재 public/운영/작성자/차단 검사를 통과한 표만 후보이고 스포일러 title/tags는 null이다. 태그가 선택된 경우 스포일러 표는 결과·hasNext에서 제외해 숨겨진 태그를 추론하지 못하게 한다. 총수/최근 수는 같은 실제 유효 반응자 규칙을 쓰고 최근 구간은 transaction 시각 기준 `[now - 168시간, now]`다. 자기/정지/미확인/동의 변경·작성자 또는 조회자와 상호 차단 반응자는 제외한다. repeated desired true는 기존 생성 시각을 올리지 않는다. 최근 수 내림차순→게시 시각 내림차순→ID 오름차순이며 최신순은 게시 시각→ID다. 페이지 사이 반응/공개 상태가 바뀌면 위치/수도 바뀔 수 있으며 snapshot cursor/대규모 성능 검수는 후속이다. 0은 실제 집계 결과일 때만 반환하고 반응자 ID/본문/token/임의 popularity score·조회수는 없다.

공개 티어/리뷰/커뮤니티 글의 인기 목록은 최근 7일 내 생성된 유효 좋아요 수, 최근 7일 내 서로 다른 댓글 작성자 수를 기준으로 한다.

`popularity = recent_unique_likes + 2 * recent_unique_commenters`를 초기 정렬값으로 사용한다. 자기 반응과 정지 계정을 제외하고 동점은 공개 시각/ID로 정렬한다. 좋아요 총수와 최근 인기 점수는 별개다. 조회수를 측정하지 않았다면 조회수 기반 인기를 표시하지 않는다.

## 12. 속도 제한의 초기값

아래는 배포 후 조정 가능한 제품 보안 초기값이며 외부 공급자의 실제 제한을 설명하는 숫자가 아니다. Supabase Auth/SMTP 측 제한도 별도로 적용된다.

| 동작 | 초기 상한 |
|---|---|
| 회원가입/인증메일/복구메일 | IP 해시 기준 시간당 10회, 발송 재시도 간격 60초 |
| 비밀번호 로그인 | IP+이메일 해시 조합으로 10분당 실패 10회 |
| 댓글 작성 | 사용자당 5분 30회 |
| 리뷰/글 게시 | 사용자당 10분 10회 |
| 좋아요 | 사용자당 1분 120회 |
| 팔로우 변경 | 사용자당 10분 30회 (user_follow RPC) |
| 차단 변경 | 현재 설치된 RPC는 사용자당 1분 30회, 기존 정책의 10분 30회 통일은 후속 |
| 티어 초안 저장 | 사용자당 1분 120회, 동시에 한 저장 |
| 일반 검색 | IP/사용자당 1분 120회 |
| PNG export | 사용자 또는 공유 token/IP 조합당 10분 5회 |
| 전체 데이터 export | 사용자당 하루 3회 |
| 신고 | 사용자당 10분 5회 |

IP는 배포 플랫폼의 신뢰된 proxy chain에서만 읽고 공격자가 보낸 임의 header를 그대로 믿지 않는다. DB에는 salt/HMAC 처리된 짧은 보존 key를 저장하고 원시 IP나 이메일을 rate-limit 레코드에 남기지 않는다. 앱과 직접 DB 경로 모두에서 우회가 되지 않게 구현한다.

## 13. 데이터 병합 규칙

중복 작품 병합은 source/target 미리보기 후 transaction으로 수행한다. 일반 회원 자동 병합은 없다. 동일 사용자가 둘 다 저장했다면 최신 updated_at의 상태/평가를 기본 후보로 보여주고 관리자가 적용 정책을 확인한다. 비공개/공개 충돌은 더 제한적인 private를 기본으로 하며 공개가 확대되지 않아야 한다.

개인 메모는 출처를 구분해 손실 없이 합칠 수 있는 경우만 처리한다. 합친 메모가 길이 상한을 넘거나 같은 사용자의 현재 리뷰가 둘 다 존재하면 병합을 중단하고 충돌 건수만 안내한다. 사용자가 자신의 export/리뷰 편집/삭제 기능으로 내용을 보존하고 충돌을 정리한 후 다시 시도한다. 관리자에게 private 메모 원문을 보여주거나 오래된 리뷰를 자동 삭제하지 않는다. 같은 티어표에 source/target이 동시에 있으면 target 한 개만 남기고 소유자가 확인할 수 있는 변경 안내를 남긴다.

공식 링크와 작가/장르 관계를 중복 없이 통합한다. source는 merged 상태와 merged_into_id를 남기고 상세 slug는 target으로 리다이렉트한다. 이전 티어 게시본은 읽을 때 merged work ID를 정규화하되 최신 draft 정리는 버전 충돌 규칙을 유지한다.

작품 병합은 비공개 내용에 접근하는 민감한 관리 작업이다. 관리자 화면에 필요 없는 사용자 메모 원문을 보여주지 않으며 감사 로그에 내용을 복사하지 않는다.

**P3 작성 계약 · 2026-10-03 (실행 미검증):** `admin_merge_preview`는 metadata/이동 건수/충돌 건수/`canMerge`와 무작위 `previewToken`만 반환한다. 관리자·source/target 쌍에 묶인 토큰은 10분 유효하며 새 미리보기로 교체된다. 내부 snapshot에는 양쪽 서재/details/evaluation과 리뷰/초안/작품이 포함되고 그 SHA-256 fingerprint는 private에만 저장한다. `admin_merge_works`는 기존 ID/version/reason/confirm에 `p_preview_token`, `p_conflict_policy='latest_private'`를 추가한 단일 signature다. 잠금 이후 version/fingerprint/만료/소유자를 다시 비교하고 변경·경합·만료는 거절한다.

상태는 library updated_at, 평가는 evaluation updated_at의 최신 **한 행 전체**, 진행/선호 링크는 details updated_at 기준으로 선택하며 동률은 target이다. 빈 진행 값은 다른 행으로 보완하되 잘못된 날짜 조합은 충돌이다. 서재/평가 visibility는 각각 private 우선이며 평가 없는 행은 평가 충돌 후보가 아니다. 메모는 target→source 순서로 제목/UUID 출처를 붙이고 태그는 union한다. 합친 메모 5000자/태그 20개 초과, 선택된 planned 상태에 평가 존재, 현재 리뷰 두 건, 별칭/링크/작가 관계 20개/장르 12개 초과는 전체 중단한다. 현재 공개 불가능한 source에 개인 기록이나 현재 리뷰가 있으면 노출 확대를 막기 위해 중단한다. 관리자는 건수만 확인하고 소유자는 본인 기록/리뷰를 별도로 보관한 뒤 수정/삭제해 충돌을 정리한다. 서비스 export 기능은 P7 대기다.

덮어쓴 상태·평가·진행을 포함한 두 원래 서재 기록은 private owner 보관본에 저장하며 `/me/library/merges`에서 `get_my_work_merge_history(p_page)`로 20개씩 확인·복사한다. 보관본을 `delete_my_work_merge_history(p_id,p_confirm)`로 지워도 현재 서재/평가/리뷰는 유지한다. 일반 기록 편집/삭제만으로 이 별도 보관본이 바뀌지는 않는다고 안내한다. `get_my_work_merge_target`은 본인 원본 이력과 현재 본인 기록이 있을 때만 옛 ID의 이동 대상을 반환한다. 제목 표시와 리뷰 연결에는 현재 공개/미삭제 조건을 반영한다.

리뷰 ID/게시/스포일러/운영 상태/본문/신고/운영 참조를 보존하고 미삭제 source 리뷰의 draft payload를 그대로 유지한다. 서재는 양쪽 version 최대+1, source 리뷰/초안은 각각 version+1로 이전 편집을 무효화한다. 통계에는 살아남은 canonical evaluation 한 행만 반영한다. P4에서는 초안 원본 보관/version+1과 현재 게시본 보존을 추가했다. source/target 중복은 target 배치를 유지하고 원 snapshot은 그대로 보관한다. 조회 때 merged ID를 정규화하며 lifecycle version도 올린다. fingerprint·NOWAIT 소유자/metadata/초안 잠금에 현재 publication을 포함한다. 미구현 tier_list_items/posts guard와 P7 export/탈퇴 완결은 후속이다.
