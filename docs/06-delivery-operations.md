# 06. 개발 순서, 검수, 운영

## 1. 진행 원칙

P0부터 P7까지 전체가 최종 구현 범위다. 한 번의 Codex 작업에서 모든 기능을 무리하게 작성하기보다 각 단계의 코드/DB/보안/테스트를 함께 완료한다. 뒤 단계에 있다는 이유로 요청된 기능을 제품에서 삭제하지 않는다.

이 문서가 처음 제공되는 시점의 애플리케이션 상태는 **미구현**이다. 문서 점검과 실행 코드 테스트를 구분한다. 실제 실행하지 않은 검사는 완료 표시를 하지 않는다.

| 단계 | 현재 상태 | 완료 보고/근거 |
|---|---|---|
| P0 | 조건부: 코드 구성, 공통 본문 높이/푸터 반응형 CSS 수정, DB·화면 검수 대기 | 아래 16절 및 2026-10-08 공통 레이아웃 기록. 로컬 Docker 엔진 필요 |
| P1 | 진행: 아이디 즉시 가입·로그인·공유 Supabase toon_ 코드/DB 설치, 실행 미검증 | 아래 2026-10-07 기록. MCP 설치 성공·실제 Auth/권한 검수 대기 |
| P2 | 진행: 카탈로그 코드 작성, 모든 실행 검사 미실행 | 아래 16절. P1 연결과 DB·관리자·Storage 설정 후 검수 필요 |
| P3 | 진행: 서재·평가·리뷰·신고/차단/조치·공개 서재 필터·평점순 탐색·개인 기록 보존 병합 코드 작성, 실행 미검증 | 아래 16절. DB/Auth 연결·migration 적용 후 실제 저장/권한 검수 필요 |
| P4 | 진행: 초안 편집·게시·공유·복제·회원 PNG/분할 ZIP·OG·기본 평가 가져오기/반영·좋아요·댓글 가중 최근 7일 인기/태그 탐색·대표 티어표·공개 댓글·작성자 프로필 팔로우 코드 작성, 실행 미검증 | 아래 2026-10-07 기록. 공유 DB 설치·인기/팔로우 migration MCP 반영, 실제 Auth/권한/화면 검수 대기. 비회원 PNG/edge 제한은 후속 |
| P5 | 진행: 티어 토론·반응/팔로우/피드/알림, 커뮤니티 및 리뷰 좋아요·댓글/답글·정렬·신고/운영·알림과 커뮤니티 작품 병합 보존 코드·DB 반영 | 아래 2026-10-10 SQL 적용 기록. 커뮤니티/리뷰/병합 SQL 4개 MCP 적용 성공·이력 확인, 모든 실행 검수 대기 |
| P6 | 진행: DISC-01/03/05 취향 비교·공동 S 작품 추천 화면/RPC·계산/노출 경계 코드·DB 반영 | 아래 2026-10-10 SQL 적용 기록. 비교/추천 SQL 2개 MCP 적용 성공·이력 확인, 모든 실행 검수 대기, 개인 추천/순위·분석 잔여 |
| P7 | 미착수 | 없음 |

Codex는 완료 시 `상태: 완료/진행/외부설정대기`, 구현 요구사항 ID, 변경 파일, migration, 테스트 명령/결과, 미검증 항목을 해당 표와 마지막 작업 기록에 남긴다.

## 2. P0: 기반 구축

문서가 이미 있는 루트의 파일을 확인한다. `create-next-app`이 비어 있지 않은 디렉터리를 거절한다고 문서를 삭제하지 않는다. 임시 별도 디렉터리에 생성한 설정을 검토하여 필요한 파일만 병합하거나 현재 폴더에 수동 초기화한다. 기존 코드/AGENTS/README는 보존한다.

Next.js, React, TypeScript, Tailwind, lint, Vitest, Playwright를 설정한다. npm만 사용한다. Supabase CLI 로컬 프로젝트와 DB migration 폴더, 테스트 메일함, 개발 설정 검증을 준비한다. 프레임워크 생성기가 AGENTS.md를 만들면 이 프로젝트 규칙을 덮어쓰지 말고 필요한 최신 프레임워크 지침만 통합한다.

디자인 토큰, 공통 레이아웃, 접근성 UI, 로딩/오류/빈 상태를 작성한다. typed env 검증과 server-only 경계를 만든다. 합성 데이터는 테스트 환경에만 넣는다.

**완료 기준:** clean install, dev, build, lint, typecheck, 단위 테스트가 실행된다. 로컬 DB 시작/초기화/타입 생성 방법을 실제로 확인한다. 개발/스테이징/운영 환경을 혼동하지 않도록 설정을 분리한다. Docker 등을 사용할 수 없으면 DB 검증을 미실행으로 남기고 P0를 조건부 상태로 보고한다.

## 3. P1: 인증과 계정 기반

profiles/user_settings/user_access/consent/reauth 기반 migration과 RLS를 작성한다. 이메일 가입/인증/로그인/복구/로그아웃, 온보딩, 프로필/알림/공개 기본값 설정, 아바타 업로드를 구현한다. Google/Kakao adapter와 callback, 공급자 비활성 상태를 구현한다.

정지/삭제 계정의 쓰기를 차단하고 서버 입력 검증과 DB 정책을 연결한다. 비밀번호/이메일 변경에는 재인증을 적용한다. 계정 삭제/export의 계약과 위험 확인 UI는 이 단계에서 준비하되 worker 완료는 P7에서 검증한다.

**완료 기준:** 테스트 메일함으로 가입부터 인증/로그인/복구/온보딩을 끝까지 실행한다. 사용자 A가 B의 설정을 수정하거나 관리자 역할을 얻을 수 없다. 실제 공급자 콘솔이 없는 OAuth는 설정 대기로 표시하며 E2E 통과로 간주하지 않는다.

## 4. P2: 작품 카탈로그와 관리자 등록

플랫폼, 장르, 작가, 작품, 연결 테이블, 정보 출처, 표지 권리, 제보를 구현한다. 관리자 수동 등록과 정보 수정, 중복 확인, 안전한 병합 경로를 제공한다. 탐색/필터/상세/공식 링크/SEO를 실제 DB로 연결한다.

자체 텍스트 커버를 기본으로 구현하고 허가된 이미지의 표시/내보내기 분기, 철회 처리를 연결한다. 로컬 seed는 60개의 명확한 `[테스트] 작품`과 합성 작가, 기존 장르 분류를 사용한다. 합성 작품은 draft/is_test로 공개 조회에서 제외하고 가짜 공식 링크를 만들지 않는다. 실제 플랫폼명은 분류 텍스트일 뿐 제휴 배지가 아니다.

**완료 기준:** 같은 작품의 여러 플랫폼 링크가 별도 중복 작품으로 생성되지 않는다. unknown/성인/숨김 작품은 API 직접 접근에서도 제외된다. 검증되지 않은 이미지가 없어도 모든 카드/상세가 완성된 UI로 나온다. 검색 결과를 실제 쿼리로 검증한다.

## 5. P3: 서재, 평가, 리뷰

library_entries, private details, evaluations, reviews, private 편집 초안을 구현한다. 상태/별점/기본 티어/태그/메모/회차, 공개 범위, 서재 필터/일괄 수정, 다른 사람 작품 저장을 연결한다. 리뷰 게시와 스포일러, 기본 신고 경로를 구현한다.

공개 프로필에서 공개 기록만 집계한다. 내 화면은 자신의 비공개 기록을 포함하되 별도의 DTO/쿼리를 사용한다. 리뷰 수정 초안이 공개 본문에 자동 반영되지 않는지 확인한다.

**완료 기준:** DB 직접 접근에서도 타인 private details와 비공개 평가를 볼 수 없다. planned에는 평가할 수 없다. 별점/티어 변경이 새로고침 후 유지되고 공개 통계의 분모가 정확하다. 한 작품당 사용자 현재 평가/리뷰가 중복되지 않는다.

## 6. P4: 티어리스트 전체 흐름

여러 티어표, 작품 검색/추가, 행 편집, 드래그/모바일/키보드 이동, 미배치함, undo/redo, 자동/수동 저장, optimistic concurrency를 구현한다. 게시본 분리, public/unlisted/private, token 회전/철회, URL 복사, OG, PNG 분할 export를 구현한다.

자신의 기본 티어 가져오기와 확인 후 기본 평가 반영을 구현한다. 기본 티어를 두 번 집계하지 않는다. 허가된 표지라도 export 권한이 없으면 텍스트 카드로 내보낸다.

**완료 기준:** 편집→저장→게시→다른 브라우저 열람→복제→PNG export→공개 철회가 실제 DB에서 통과한다. 같은 표를 두 탭에서 동시에 수정해도 마지막 요청이 조용히 덮어쓰지 않는다. 링크 공유 토큰을 모르는 사용자에게 unlisted 게시본이 DB/API로 노출되지 않는다.

## 7. P5: 소셜과 커뮤니티

팔로우, 차단, 공개 피드, 커뮤니티 글/작품 연결, 댓글/한 단계 답글, 좋아요, 알림을 구현한다. 리뷰와 공개 티어의 토론도 연결한다. 목표 상태 기반 좋아요/팔로우로 재시도 중복을 막는다.

원본의 공개 권한을 실시간으로 확인하고, 스포일러나 private 본문을 알림/피드/OG로 복사하지 않는다. 차단이 DB 직접 쓰기에도 반영되는지 검증한다.

**완료 기준:** A가 B를 팔로우한 뒤 B의 공개 게시만 피드에 나타난다. 비공개 초안 저장이나 링크 공개 티어는 나타나지 않는다. 차단 후 상호작용은 거절되고 자신에게 알림이 생기지 않는다. 다른 사용자의 read_at/recipient를 바꿀 수 없다.

## 8. P6: 통계, 비교, 추천

별점 평균, 보정 순위, 티어 분포, 완독/공개 독서 30편 조건, 장르/플랫폼 비중, 취향 비교, S 공동 평가 추천, 유사 사용자 추천을 구현한다. 05 문서 수식을 코드와 테스트에서 공유한다.

개인 결과에는 no-store를 적용한다. 다른 사용자의 비공개 평가는 추천에 사용하지 않는다. 데이터가 부족하면 표본 부족이나 장르 기반 보완임을 표시한다. 계산한 적 없는 값은 UI에 넣지 않는다.

**완료 기준:** 고정 fixture로 계산 결과를 확인한다. 두 사용자의 공통 비교 신호가 5개 미만이면 점수가 null이다. 공개 여부나 계정 상태를 바꾸면 결과에서 제외된다. 알고리즘 설명과 실제 입력/분모가 일치한다.

## 9. P7: 운영과 공개 출시 검수

신고 처리와 권한별 관리자 화면, 감사 로그, 운영 작업 원장/worker, 실제 export, 계정 삭제, 만료 자산/파일 정리, 백업 복원 절차를 완성한다. OAuth/SMTP/운영 도메인/권리/운영자 정보 등 외부 설정을 확인한다.

모바일, 접근성, 권한, 캐시 격리, 대량 편집과 이미지 export 부하를 검수한다. 배포 환경에서 clean migration과 기존 버전에서의 업그레이드를 테스트한다. 운영 DB reset이나 테스트 seed 유입을 금지한다.

**완료 기준:** 아래 필수 테스트와 공개 출시 체크리스트를 통과하고 검증 근거를 기록한다. 외부 설정/권리/법률 검토가 미완료면 배포 가능 코드와 일반 공개 출시 가능 상태를 구분한다.

## 10. Codex가 생성해야 할 npm 명령

| 명령 | 기대 동작 |
|---|---|
| `npm run dev` | 로컬 앱 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint CLI 실행, 오래된 next lint에 의존하지 않음 |
| `npm run typecheck` | TypeScript 오류 검사 |
| `npm test` | 단위/컴포넌트 테스트, watch가 아닌 CI 모드 |
| `npm run test:db` | 실제 로컬 Supabase RLS/trigger/RPC 통합 검사 |
| `npm run test:e2e` | Playwright 사용자 흐름 |
| `npm run test:a11y` | 자동 접근성 검사와 보고 |
| `npm run db:start` / `db:stop` | 로컬 Supabase 시작/중지 |
| `npm run db:reset` | 로컬 전용 reset, 원격 환경이면 거절 |
| `npm run db:types` | 로컬 migration 기준 TS 타입 생성 |
| `npm run check` | lint/typecheck/unit/build의 명시된 합성 검사 |

DB/E2E 테스트가 check에 포함되는지 script와 설명에 명시한다. check가 통과해도 별도 DB/E2E를 실행하지 않았다면 전체 테스트 통과라고 보고하지 않는다. `--if-present`로 누락된 필수 script를 성공 처리하지 않는다.

## 11. 필수 테스트 시나리오

### A. 인증

A01 이메일 가입/인증/온보딩/로그인/로그아웃. A02 인증 만료/재사용/재발송 제한. A03 복구 메일→확인→새 비밀번호→기존 비밀번호 실패. A04 외부 returnTo, 인코딩 우회, // 경로, redirect loop 거절. A05 Google/Kakao 성공/취소/누락 email/기존 계정 시나리오. A06 인증 전/온보딩 전 쓰기 차단. A07 세션 갱신 후 cookie가 최종 응답에 남음. A08 JWT iat만으로 재인증 통과 불가.

인증 공급자 mock은 UI 단위 테스트에만 쓴다. 운영 OAuth를 mock 결과만으로 검증했다고 표시하지 않는다.

### B. DB와 직접 접근

B01 anon/A/B/admin 세션을 구분한 SELECT/INSERT/UPDATE/DELETE. B02 A가 B의 private details를 직접 SELECT할 수 없음. B03 A가 user ID를 B로 바꿔 저장 불가. B04 일반 사용자 role/moderation/report 처리상태 조작 불가. B05 public view와 RPC가 RLS/private fields를 우회하지 않음. B06 notifications recipient/body 위조 불가. B07 새 table에 RLS/권한 누락이 없음. B08 Storage에서 타인 경로 읽기/쓰기/삭제 불가. B09 suspended/deleting 사용자의 유효 JWT로도 쓰기 불가. B10 direct REST로 앱 rate limit 우회 불가.

RLS 테스트에 admin/service-role client만 사용하지 않는다. 그 client는 RLS를 우회할 수 있으므로 일반 사용자 보안을 입증하지 못한다.

### C. 서재와 콘텐츠

C01 같은 작품 동시 추가도 한 행. C02 planned 평가 금지. C03 상태/평가 저장 중 실패 시 부분 변경 없음. C04 서재 public/평가 private, 서재 private/평가 public 각각 정확. C05 공개 프로필/OG에 private note/회차/태그 없음. C06 리뷰/글 수정 autosave는 공개 본문을 바꾸지 않음. C07 원문 스포일러가 초기 HTML/메타데이터/알림에 없음. C08 댓글 깊이 2 이상/다른 스레드 parent 거절. C09 같은 리뷰 동시 작성 unique 충돌 처리. C10 다른 사용자 서재 저장 시 평가나 메모 미복사.

### D. 티어

D01 드래그/키보드/모바일 메뉴로 동일한 배치 결과. D02 row 삭제 시 작품 미배치 이동. D03 중복 work/잘못된 row/과도한 payload 거절. D04 두 탭 저장 충돌 시 CONFLICT. D05 늦은 저장 응답이 최신 UI를 덮지 않음. D06 게시 전/후 초안 수정 분리. D07 unlisted token 없이 table/REST/RPC/OG에서 내용 비노출. D08 token 재발급 후 이전 token 거절. D09 public→private 이후 목록/상세/OG/export 차단. D10 예전 publication 직접 접근 거절. D11 300작품의 PNG 분할 export에서 제목/행/순서 누락 없음. D12 custom 행을 canonical으로 추정하지 않음. D13 여러 표를 만들고 게시해도 전체 작품 평가 수 증가 없음. D14 로그아웃/다른 계정에서 이전 로컬 초안 복구 불가.

### E. 소셜과 추천

E01 중복 좋아요/팔로우 요청이 idempotent. E02 자기 좋아요/자기 팔로우 금지. E03 차단 즉시 피드/토론/알림 노출 정책 반영. E04 비공개 전환된 콘텐츠의 과거 알림은 원문 없이 안내. E05 추천에 타인 private 평가 불포함. E06 공통 4개는 점수 null. E07 5개 차이 0/0.2/0.2/0.4/0.2의 similarity=80. E08 C=3.8일 때 평점5/5명 보정=4.04. E09 여러 플랫폼/작가 join으로 rating_count 증가 없음. E10 완독/경험 필터가 공개 서재만 사용. E11 다중 장르 비중 합계 100%. E12 빈 DB의 평점/추천/인기 수치가 가짜 값으로 채워지지 않음.

### F. 권리와 운영

F01 허가 없는 표지는 텍스트 cover. F02 display 허가만 있는 자산은 OG/PNG에서 대체. F03 허가 만료/철회 후 새 요청 차단과 캐시 상한 검증. F04 원격 이미지 URL을 통해 localhost/내부 metadata 주소 요청 불가. F05 HTML/SVG/위조 MIME 업로드 거절. F06 계정 삭제 중 worker 재실행해도 중복 오류나 재공개 없음. F07 Storage 소유 객체 정리 후 Auth 삭제. F08 user export에 타인 비공개/공급자 token/신고자 정보 없음. F09 export 파일 만료와 타인 job 접근 차단. F10 운영 빌드에서 demo flag/테스트 seed/비밀 키 유출 검사. F11 운영 DB 대상으로 reset script 실행 거절. F12 권한 없는 관리자 화면 요청과 직접 관리 RPC 거절.

### G. 화면과 배포

G01 360/768/1280px 주요 화면. G02 키보드로 로그인/리뷰/티어 편집/게시 가능. G03 포커스, 모달, aria-live, 대비. G04 로딩/빈 상태/오프라인/서버 오류. G05 로그인 A→로그아웃→로그인 B에서 A 데이터 잔류 없음. G06 public/private cache 혼합 없음. G07 sitemap/noindex/canonical/스포일러 OG. G08 실제 배포 도메인 callback과 SMTP 전달. G09 한글 OG/PNG 깨짐 없음. G10 새 migration 적용 후 smoke test와 이전 데이터 유지.

## 12. 성능 기준

다음은 측정 환경을 남겨 검수할 **목표**이지 이미 달성한 수치가 아니다. 1만 작품/10만 공개 평가의 합성 부하 데이터로 검색과 집계를 점검하고, 티어 편집은 최대 300작품으로 시험한다. 부하 seed는 production 프로젝트에 넣지 않는다.

모바일 LCP 2.5초 이하, CLS 0.1 이하를 목표로 측정한다. 검색/서재 조회는 스테이징 기준 p95 800ms 이하, 간단한 쓰기는 p95 1초 이하를 초기 목표로 삼는다. 네트워크/DB 지역/콜드스타트/측정 도구/반복 수를 함께 기록한다.

성능 때문에 개인 정보를 전역 캐시에 넣지 않는다. N+1 쿼리, 무제한 SELECT, 추천 전수 비교를 먼저 제거한다. 서버/DB를 가능하면 가까운 지역으로 배치하되 실제 가용 지역과 요금제는 배포 시 확인한다.

## 13. 실제 배포 체크리스트

- [ ] 개발/스테이징/운영 Supabase 프로젝트와 앱 환경이 구분되어 있다.
- [ ] migration을 스테이징에서 검증했고 운영 반영 시 데이터 보존 계획이 있다.
- [ ] Auth Site URL/Redirect URLs와 Google/Kakao의 공급자 callback이 맞다.
- [ ] 실제 공급자 인증과 계정 복구를 운영용 테스트 계정으로 검증했다.
- [ ] 운영용 custom SMTP, 발신 주소, SPF/DKIM 등 공급자 설정을 확인했다.
- [ ] Supabase 기본 SMTP를 일반 사용자 대상 서비스의 정상 발송 수단으로 가정하지 않는다. [S16]
- [ ] 비밀 키와 SHARE_TOKEN_ENCRYPTION_KEY가 배포 비밀로 등록되어 있다.
- [ ] 모든 공개 테이블, view, RPC, Storage의 권한을 anon/A/B로 검증했다.
- [ ] 성인 작품/unknown 등급은 서버와 DB에서 비활성화되어 있다.
- [ ] 원시 표지 크롤링/핫링크/공식 소개문 복사가 없다.
- [ ] 허가 이미지의 표출/상업 이용/OG/export 범위와 철회 절차를 기록했다.
- [ ] 합성 데이터가 운영 DB와 공개 통계에 섞이지 않는다.
- [ ] 운영자 이름/실제 연락 경로/서비스명/수집 항목/위탁과 국외 처리 등 실제 상황에 맞는 법적 고지를 확정했다.
- [ ] 약관/개인정보/권리 신고 페이지에 TODO나 가짜 연락처가 남아 있지 않다.
- [ ] 가입 연령, 개인정보, UGC 운영, 권리 처리에 대한 별도 출시 검토를 마쳤다.
- [ ] 신고 접수와 처리, 공개 철회, 데이터 export, 계정 삭제를 끝까지 검증했다.
- [ ] Cron 호출 인증, job 재시도/만료/실패 알림을 검증했다.
- [ ] 로그인/개인화 응답과 공유 token이 로그나 CDN cache로 노출되지 않는다.
- [ ] 보안 헤더와 의존성 보안 상태를 확인했다.
- [ ] 실제 배포에서 모바일/키보드/PNG/한글 폰트/SEO를 검수했다.
- [ ] DB와 Storage 복원 절차, 지원 요금제와 실제 백업 범위를 확인했다.

운영 법적 고지와 권리 처리는 이 문서만으로 적법성이 확정되지 않는다. Codex가 임의의 법률 문구나 보존 기간을 확정하여 출시 완료로 표시하지 않게 한다. 미확정 사항이 있으면 제한된 개발/스테이징 상태로 남긴다.

## 14. 운영 기준

로그는 request ID, 경로 템플릿, 처리 시간, 안전한 오류 코드, 비식별 job ID 정도로 제한한다. 이메일, token, 비밀번호, 리뷰/메모 전체, 공유 URL 원문을 기본 로그에 넣지 않는다.

DB 백업과 Storage 파일의 백업/복구는 별개로 확인한다. 단순히 Supabase를 사용한다는 이유로 모든 파일이 자동 복구된다고 주장하지 않는다. 운영 전에 실제 스테이징 복구 훈련을 한 번 수행하고 결과를 기록한다.

신고 처리, 숨김/복구, 작품 병합, 표지 허가/철회, 계정 정지는 사유와 수행자를 감사 기록에 남긴다. 비공개 원문 전체를 감사 로그에 복제하지 않는다.

장애 대응은 읽기/쓰기/Auth/Storage/메일/worker를 구분한다. 외부 서비스 장애일 때 저장 성공을 가짜로 반환하지 않는다. 자동 저장 실패는 편집 내용을 보존하고 재시도를 안내한다. Worker 실패는 failed 상태와 안전한 오류 코드로 운영자에게 남긴다.

## 15. 공식 참고 자료

아래 문서는 2026-10-01 웹에서 확인했다. 버전별 세부 API와 공급자 설정은 구현 시 다시 확인한다. 이 자료는 기술 근거이며, 프로젝트의 수치와 도메인 정책은 별도 설계다. URL은 복사 가능한 형태로 표기한다.

| ID | 공식 자료 | 참조 위치 |
|---|---|---|
| S01 | Next.js 설치/버전/프로젝트 초기화 | `https://nextjs.org/docs/app/getting-started/installation` |
| S02 | Supabase Next.js SSR client, Proxy, 검증/캐시 | `https://supabase.com/docs/guides/auth/server-side/nextjs` |
| S03 | Supabase 비밀번호 기반 인증 | `https://supabase.com/docs/guides/auth/passwords` |
| S04 | Supabase Row Level Security | `https://supabase.com/docs/guides/database/postgres/row-level-security` |
| S05 | Next.js 서버 데이터와 Server Actions 보안 | `https://nextjs.org/docs/app/guides/data-security` |
| S06 | Supabase Google 로그인 | `https://supabase.com/docs/guides/auth/social-login/auth-google` |
| S07 | Supabase Kakao 로그인 | `https://supabase.com/docs/guides/auth/social-login/auth-kakao` |
| S08 | Supabase Storage 접근 제어 | `https://supabase.com/docs/guides/storage/security/access-control` |
| S09 | Supabase 사용자 데이터와 삭제 | `https://supabase.com/docs/guides/auth/managing-user-data` |
| S10 | Supabase 사용자 세션 | `https://supabase.com/docs/guides/auth/sessions` |
| S11 | Supabase API 키 | `https://supabase.com/docs/guides/getting-started/api-keys` |
| S12 | Node.js 지원 버전과 LTS | `https://nodejs.org/en/about/previous-releases` |
| S13 | PostgreSQL pg_trgm 검색 | `https://www.postgresql.org/docs/current/pgtrgm.html` |
| S14 | Supabase Cron | `https://supabase.com/docs/guides/cron` |
| S15 | Codex AGENTS.md 지침 | `https://developers.openai.com/codex/guides/agents-md` |
| S16 | Supabase custom SMTP와 기본 SMTP 제약 | `https://supabase.com/docs/guides/auth/auth-smtp` |
| S17 | dnd-kit 현재 공식 문서 | `https://dndkit.com/` |

Codex는 루트 AGENTS.md의 기본 규칙을 먼저 읽고 필요한 상세 문서로 이동하도록 구성했다. 이는 공식 프로젝트 지침 방식에 맞춘 구조이며 전체 상세 명세를 AGENTS.md 하나에 반복하지 않는다. [S15]

## 16. 마지막 작업 기록

### 2026-10-02 · P0 기반 구축 (조건부)

사용자가 문서를 검토해 `/Users/ddoni/dev/toonshelf`에 프로젝트를 시작하고 **P0만** 구성하도록 선택했다. 원본 문서의 예시 프롬프트를 P1~P7 또는 Git 동작의 실행 허가로 취급하지 않았다. 원본 다운로드 폴더는 수정하지 않았다.

**요구사항:** 완결된 AUTH/CAT/LIB 등의 제품 요구사항 ID는 없음. OPS-05(반응형·접근성), OPS-06(환경·권한 경계), OPS-07(noindex), OPS-08(검수 기반)의 일부 기반만 구성했으며 추적표는 미완료로 유지한다. F11 로컬 DB 명령 보호의 단위 검증과 G01/G03의 일부 P0 화면 검수를 수행했다.

**변경:** Next App Router/React/TypeScript strict/npm/Tailwind, 디자인 토큰과 홈·공통 레이아웃, 준비 중 페이지, 테마, 로딩/오류/404/빈 상태, Supabase browser/server/Proxy, typed env 검증과 server-only 경계, Vitest/Testing Library/Playwright/axe 설정, local DB 보호 스크립트. `supabase init` 및 `migration new foundation`으로 생성한 설정과 `20261001151027_foundation.sql`에 enum/private 스키마/기본 권한을 작성했다. production 데이터나 합성 작품·이용자를 만들지 않았다.

**실제 검사 (Node 24.21.0):**

| 검사 | 결과 |
|---|---|
| npm ci 및 전체 peer tree 검사 | 최종 /Users/ddoni/dev/toonshelf에서 clean install 성공, npm ls peer 오류 없음 |
| npm run lint | 오류/경고 0 |
| npm run typecheck | 통과 |
| npm test | 4개 파일, 22개 테스트 통과 |
| npm run check | 최종 폴더에서 lint/typecheck/22 tests/build 모두 exit 0 (Node 24.21.0) |
| npm run test:e2e | 360/768/1280px의 12개 테스트 통과 |
| npm run test:a11y | 각 뷰포트 라이트·다크의 6개 테스트 통과; 홈/준비 중 화면 WCAG AA 자동 위반 없음 |
| npx react-doctor@latest --verbose --scope changed | Git 미초기화로 full scan, 45파일, 100/100, 진단 없음 |
| npm audit | 알려진 취약점 0건 |
| npm run db:start / db:reset / db:types / test:db | Docker 미설치로 안전하게 종료(실패), DB 작업 미실행 |
| npm run env:check | Supabase 미설정을 알리고 exit 1. 연결 성공으로 처리하지 않음 |

**검증한 흐름:** 홈→작품 찾기→준비 중 안내, 테마 전환과 새로고침 유지, 시스템 테마, 키보드 본문 바로가기, 404, robots/noindex, 세 뷰포트 가로 넘침 없음. 환경변수·원격 DB 차단·오류 접근성·텍스트 escape를 단위 테스트했다. SSR 쿠키 및 응답 헤더 보존은 mock 기반 어댑터 테스트이며 실제 계정 인증 검증이 아니다.

**발견·해결:** 최신 TypeScript 7 및 ESLint 10이 Next lint 플러그인의 peer 범위와 불일치하여 TS 6.0.3 / ESLint 9.39.5로 고정했다. ESLint 9 지원 종료 경고는 Next 플러그인 호환 업데이트 시 함께 해소할 후속 항목이다. 연속 쿠키 갱신에서 Expires/Pragma가 유실되는 사례를 실패 테스트로 재현한 뒤 보존하도록 수정했다. Turbopack의 CSS worker가 이 도구 실행 환경의 내부 포트 바인딩 EPERM으로 실패하여 공식 Webpack 모드로 검증했다.

**실제 브라우저:** 최종 폴더의 개발 서버 HTTP 200, ego-browser에서 홈 내용·900px 가로 넘침 없음·라이트/다크 전환을 확인했다. ego-browser의 PNG 캡처는 CDP 시간 초과로 실패해 픽셀 기반 수동 스크린샷 검수는 하지 못했다. 자동 Playwright/axe 검수 결과와 구분한다.

**실행 상태:** 최종 폴더에서 npm run dev -- --hostname 127.0.0.1 --port 3187로 개발 서버 실행을 확인했다. 원본 설계 문서는 보존·갱신했고 Git 초기화/브랜치/커밋/원격 생성은 수행하지 않았다.

**외부 환경 대기:** Docker 호환 런타임 설치·시작. 이후 local migration 적용/reset/타입 생성/pgTAP 실행이 필요하다. Supabase 원격 프로젝트 연결, 실제 로그인·OAuth·SMTP·Storage·배포는 수행하지 않았다. 자격증명은 요청하거나 생성하지 않았다.

**다음 작업:** Docker 시작 → db:start → 로컬 URL/key 설정 → env:check → db:reset → test:db → db:types로 P0 잔여 검수를 완료한다. 그 후 사용자가 요청하면 P1 사용자 테이블/RLS/실제 인증/온보딩을 구현한다.

### 2026-10-02 · 초기 Git 구성 및 커밋 전 확인

사용자가 Git 초기화와 `main`/`develop`/`chore/p0-bootstrap` 브랜치 구성, 커밋, `https://github.com/ddoniddoni/toonshelf.git`로의 push를 명시적으로 요청했다. 원격 저장소에 기존 refs가 없는 것을 읽기 전용으로 확인했다. 초기 기준은 파일 없는 커밋이며 `main`과 `develop`은 그 기준을 사용한다. 기존 P0 파일은 `chore/p0-bootstrap`에 커밋하는 대상이다. PR 생성·merge·릴리스는 이번 요청 범위에 포함하지 않는다.

테스트는 앞으로 사용자가 실행을 요청할 때만 실행하도록 `AGENTS.md`에 기록했다. 이번 커밋 전에는 단위·통합·E2E·접근성·DB·회귀 테스트 및 `npm run check`를 실행하지 않았다. 앞선 P0 검수 결과는 당시 기록이며 이번 재실행 결과가 아니다.

**커밋 전 확인 (Node.js 26.4.0 / npm 11.17.0):** `npm run lint`, `npm run typecheck`, `npm run build`, `npm ls --depth=0` 모두 exit 0. 빌드에서 11개 정적 페이지를 생성했다. 실제 브라우저 사용자 흐름은 이번에 재확인하지 않았다. 비밀 키 패턴 검색에서 발견된 테스트 문자열은 가짜 fixture임을 확인했으며 환경변수 예제의 비밀 값은 비어 있다. `.env.local`, 의존성, 빌드 결과, 테스트 결과는 커밋 대상에서 제외한다.

**기능·요구사항·외부 대기:** 앱 코드와 migration에 새 기능을 추가하지 않았다. 요구사항 추적표와 P0의 조건부 상태를 유지한다. 실제 로컬 DB migration/타입 생성/pgTAP, 로그인·OAuth·SMTP·Storage·배포는 여전히 미검증이며 후속 실행은 사용자 요청에 따른다.

### 2026-10-02 · P1 인증과 계정 기반 (진행·외부 설정 대기)

사용자의 다음 개발 요청에 따라 P1 코드를 작성했다. P2~P7 구현, 새 브랜치 생성, stage/commit/push/PR/merge는 수행하지 않았다. 테스트는 사용자가 실행을 요청할 때만 실행한다는 규칙을 유지했다.

**요구사항:** AUTH-01~07, AUTH-10의 코드와 migration을 작성했다. AUTH-08/09는 P7 계약을 유지하고 계정 화면에 데이터 정리 안내와 비활성 탈퇴 버튼을 표시한다. 실제 DB/Auth 사용자 흐름이 미검증이므로 아래 추적표는 완료로 체크하지 않는다.

**변경:**

- `src/lib/auth/`에 서버 검증, 확인된 사용자·실제 세션 검사, 계정 상태/동의 게이트, 이메일 가입·인증·재발송·복구, 로그인·로그아웃, OAuth PKCE callback, 온보딩, 프로필/설정, 재인증 및 아바타 처리를 작성했다. 비밀번호·이메일 변경에는 목적·사용자·현재 세션에 묶인 10분 일회용 증명이 필요하며 일반 로그인이나 URL의 recovery 표시로 발급하지 않는다.
- `src/app/auth/`, `/onboarding`, `/settings/*`, `/u/[username]`과 관련 폼·계정 UI를 추가했다. 이메일 GET 링크는 토큰을 소비하지 않고 명시적 POST 확인으로 진행한다. 설정이 없으면 연결 준비 안내를 표시하며 가짜 로그인·저장을 제공하지 않는다. `/me/library`의 작품 기록은 P3 준비 상태다.
- `supabase/migrations/20261001162407_accounts_auth.sql`에 profiles, genres, user_settings와 private 접근/동의/재인증/요청 제한 테이블, 최소 계정 생성 trigger, RLS·명시적 권한·RPC, 서버 전용 아바타 업로드 정책을 작성했다. 장르 분류만 넣었으며 실제 이용자·작품·평점은 만들지 않았다. 사용자 수정 가능 메타데이터에서 역할·상태를 가져오지 않는다.
- `supabase/templates/`와 `supabase/config.toml`에 로컬 이메일 템플릿·callback 허용 목록을 작성했다. `sharp@0.35.5`를 직접 의존성으로 고정하고 이미지 디코딩 후 WebP 재인코딩을 적용했다. `.env.*.example`, Next 요청 로그·인증 캐시 설정, README와 기존 설계 문서를 갱신했다.
- `src/types/database.contract.ts`는 migration에 맞춰 작성한 임시 계약이다. 실제 DB에서 생성한 타입이 아니며, DB 연결 후 생성 결과와 대조하고 SDK generic을 생성 타입으로 전환해야 한다.

**실제 검사 (Node.js 26.4.0 / npm 11.17.0):**

| 검사 | 결과 |
|---|---|
| npm run lint | 최종 변경에서 exit 0, 오류/경고 없음 |
| npm run typecheck | 최종 변경에서 exit 0, Next route type 생성 및 strict 타입 검사 통과 |
| npm run build | 최종 변경에서 exit 0, Webpack 프로덕션 빌드 및 11개 정적 페이지 생성; 인증·계정·프로필 경로는 동적 렌더링 |
| npm ls --depth=0 | exit 0, 직접 의존성 트리 확인 |
| npm install sharp@0.35.5 --save-exact | 완료, 설치 시 audit에서 알려진 취약점 0건 |
| React Doctor 전체 소스 스캔 | 85개 파일, 62/100, exit 1. `signOut`의 서버 인증 진단 1건 남음. `getUser()` 검증 후 세션 없는 요청에서 해당 브라우저의 인증 쿠키만 지우는 분기를 정적 분석이 인증 없는 action으로 분류함. DB 쓰기·재인증 증명 발급이 없음을 코드로 검토했으며 규칙을 억제하지 않았음 |
| git diff --check | 공백 오류 없음 |
| 단위·통합·E2E·접근성·DB·회귀 테스트, npm run check | 사용자 요청이 없어 모두 미실행 |
| 실제 migration 적용, RLS/권한 advisor, DB 타입 생성 | Docker/DB 연결이 없어 미실행 |

**작성한 테스트:** `tests/unit/auth-validation.test.ts`(리다이렉트·입력·동의), `tests/integration/auth-actions.test.ts`(인증 게이트·일반 로그인과 복구 증명 분리·안전한 오류 응답), `supabase/tests/01_accounts_auth.test.sql`(anon/A/B·상태·동의·세션·재인증 목적/재사용·Storage 권한). 파일을 작성했을 뿐 실행 결과는 없다. action mock은 실제 인증 증거가 아니다.

**실제로 확인한 사용자 흐름:** 이번 P1에서는 브라우저 수동 검수와 실제 가입→메일 확인→온보딩→저장 흐름을 실행하지 않았다. lint/typecheck/build 성공을 사용자 흐름 또는 RLS 통과로 간주하지 않는다.

**외부 설정·미검증:** Docker와 psql이 없고 `.env.local`/Supabase 연결 정보가 없어 migration을 적용하지 못했다. 로컬·스테이징 DB의 실제 함수 권한/RLS/Storage, 라이브 생성 타입, 이메일 이중 확인·secure password change, OAuth 공급자 로그인, SMTP, 모바일/접근성 화면 검수는 대기 상태다. Google/Kakao는 기본 비활성이며 앱 가입 플래그와 별도로 Supabase의 실제 가입 허용 설정도 관리해야 한다. 약관·개인정보 페이지는 내부 개발용 preview이므로 공개 가입 전 운영 정책과 동의 버전을 확정해야 한다. 기존 SQL의 preview 버전과 서버 상수도 함께 바꿔야 한다. 인증 URL/요청 본문이 프록시·배포 로그에 남지 않도록 외부 로그 설정도 필요하다.

**다음 작업:** Docker 시작 → 로컬 `db:start` → 로컬 URL/key·서버 전용 키 설정 → `env:check` → 데이터 보존 범위를 확인한 뒤 로컬 migration 적용 → `db:types` 생성·계약 대조 순서로 연결한다. Site URL/호스트/포트, `callback?flow=*`, 이메일 템플릿을 맞추고 실제 공급자·SMTP를 설정한다. 테스트 및 사용자 흐름 검수는 사용자가 실행을 요청한 뒤에 진행하고, 실제 근거가 확보될 때 P1을 완료 처리한다. 비밀 키는 채팅으로 받지 않는다.

### 2026-10-02 · P2 카탈로그·관리자 등록 (코드 작성·검사 미실행)

사용자는 P1의 Supabase·메일·OAuth 연결을 다음 공동 작업으로 미루고 다음 기능을 개발하도록 요청했다. 이번 범위는 P2다. P1 연결, 관리자 승격, DB 시작/적용/reset, 브랜치/stage/commit/push/PR는 수행하지 않았다. 앞선 검사 범위에 대한 사용자 정정에 따라 **단위·통합·DB·E2E·접근성 테스트뿐 아니라 lint/typecheck/build/React Doctor/advisors/env 검사와 브라우저 검수도 실행하지 않았다.** 소스·문서 읽기와 코드/테스트 파일 작성만 진행했다.

**요구사항:** CAT-01~08과 OPS-02/03/04의 카탈로그 기반 코드를 작성했다. 평점순/평가·리뷰는 P3, 실제 제보 알림 채널은 P5, 개인 기록을 포함한 전체 병합/운영 검수는 후속 단계에서 연결해야 한다. 실제 검색·권한·저장·업로드·병합 및 컴파일을 확인하지 않았으므로 추적표를 완료로 표시하지 않는다.

**변경 기능·파일:**

- `supabase/migrations/20261001174303_catalogue.sql`: 플랫폼/작가/작품/관계/제보, private 출처·표지 권리·감사 기록, 인덱스, RLS/grant/RPC, private Storage 정책을 작성했다. CLI migration new로 파일만 생성했으며 DB에는 적용하지 않았다. 플랫폼 분류와 허용 host만 넣었고 실제 작품/사용자를 만들지 않았다.
- `src/lib/catalogue/`: 입력 검증·공개 DTO, 제목/별칭/작가 검색, filter/cursor, 현재 DB 역할 검사, 관리 action, 목적별 표지 허가 및 이미지 처리 코드를 작성했다. 일반 데이터/RPC는 사용자 SDK를 사용하고 재인코딩 파일 Storage I/O만 서버 전용 client로 수행한다.
- `/explore`, `/works/[slug]`: 검색·350ms 자동완성·다중 필터·최근/제목 정렬·결과/빈 상태·다음 페이지, 직접 쓴 소개·작가 역할·공식 링크·canonical, 텍스트 기본 표지를 작성했다. 미설정 상태는 준비 안내이며 평점/이용자 수를 만들지 않는다.
- `/submissions/new`·`/submissions`, `/admin/*`: 회원 제보/본인 결과, 관리자 등록·수정·숨김·정확한 중복 후보·병합 미리보기/확인·제보 검수·권리 등록/철회·관리 이력을 작성했다. 관리자 정보는 사용자 수정 가능한 메타데이터에서 가져오지 않는다.
- `/api/works/search`, `/api/covers/[assetId]`: 제한된 공개 결과와 현재 권리/공개 조건을 재확인하는 이미지 proxy를 작성했다. 원격 URL 다운로드·플랫폼 크롤링·무단 표지 복사를 구현하지 않았다. 표지 proxy는 no-store이며 표시/OG/PNG 허가를 구분한다.
- `supabase/seed.sql`: 로컬 전용 합성 작품 60개·작가 15개를 작성했다. 모두 draft/is_test라 공개 경로에서 제외되고 가짜 공식 링크·표지·사용자·평가가 없다. 실행하지 않았다.
- `database.contract.ts`는 P2도 포함하는 손으로 작성한 계약이며 live 생성 타입이 아니다. 공통 폼 readOnly, 관리자 메뉴, 반응형 CSS와 기존 문서를 해당 기능에 맞춰 갱신했다.

**검사 결과:** 이번 변경에 실행한 테스트·lint·typecheck·build·Doctor/advisor·env 검사·브라우저 검수는 **없음**. SQL 문법/실제 DB 권한·Storage 객체 metadata, TypeScript/Next 컴파일, UI/접근성/모바일을 통과했다고 주장하지 않는다. P1 이전 작업의 성공 기록을 이번 P2 검사 결과로 재사용하지 않는다.

**작성한 테스트:** `tests/unit/catalogue-validation.test.ts`(URL/입력/등급/출처/filter/cursor), `tests/integration/catalogue-actions.test.ts`(관리자/회원 게이트·소유권/상태 위조·병합 확인·안전한 오류), `supabase/tests/02_catalogue.test.sql`(anon/A/B/admin·작품/관계 숨김·검색·권리 분리/만료/철회·제보·병합·정지 계정). 기존 `tests/e2e/foundation.spec.ts`의 탐색 준비 상태 기대값을 갱신했다. 전부 미실행이다.

**실제로 확인한 사용자 흐름:** 없음. 파일을 작성했으나 실행하지 않았다.

**남은 연결·검수:** 사용자와 P1 Supabase/Auth를 연결하고 migration 적용·실제 생성 타입 대조·최초 관리자 지정·licensed-covers 설정을 진행해야 한다. 코드의 RLS/RPC/Storage/동시 수정/병합/검색 성능/허가 철회와 UI를 그 후 요청한 검사 범위에서 확인한다. 비회원 IP별 edge 속도 제한은 아직 설정/구현되지 않았고 로그인 검색에는 DB 사용자별 제한만 작성했다. 최초 공개 운영 전 익명 경로 제한·정책·이미지 상업적 사용 범위·실제 정보 출처를 확인해야 한다.

**다음 단계:** 공동 연동 작업과 P1·P2 확인을 남긴 상태다. P3 개인 서재/평가/리뷰 개발을 요청하면 이어가며, 개인 테이블 추가 시 P2 병합 보호를 유지하고 05 문서의 개인정보 보존 handler를 구현해야 한다. 검사와 Git 동작은 각각 명시 요청 후 실행한다.

### 2026-10-02 · P3 개인 서재·평가 (첫 기능 범위, 코드 작성·미검증)

사용자의 다음 기능 개발 요청으로 P3 중 개인 서재와 평가를 작성했다. 리뷰/스포일러/신고는 다음 기능 범위이며 P3 전체 완료로 표시하지 않는다. 실제 Supabase·메일·OAuth 연결은 이전 결정대로 보류했다. 새 브랜치 생성·stage·commit·push·merge·PR는 요청하지 않아 수행하지 않았다. 기존 `next-env.d.ts` 로컬 변경은 보존했다.

**관련 요구사항:** LIB-01~06, RATE-01~04의 코드와 migration, SOC-01의 공개 서재/평가/통계를 작성했다. LIB-07은 공개 프로필에서 작품을 가져오는 경로만 작성했고 리뷰/티어의 가져오기는 해당 단계에서 연결한다. SOC-01의 리뷰/티어 탭, P3 리뷰 전체와 공개 서재 필터, P2 평점순 탐색, 개인정보 보존 병합 handler는 남아 있다. 실제 검수가 없어 추적표 체크는 유지한다.

**변경:**

- `20261001184908_library_evaluations.sql`: library_entries/version, library_private_details, user_evaluations의 FK/제약/trigger/RLS/최소 SELECT 권한을 작성했다. 상태와 개인 진행/평가를 transaction으로 저장하고 planned 평가를 차단한다. 서재·평가는 독립적으로 공개하며 회차/날짜/메모/태그/선호 플랫폼과 내부 저장 시각/version은 공개 DTO에 포함하지 않는다.
- `src/lib/library/`: Unicode 입력 검증, 현재 세션/active 계정 게이트, 안전한 오류, 본인/공개 DTO, 개별 저장·idempotent 작품 복사·일괄 변경·전체 비공개·통계를 작성했다. owner ID는 입력받지 않는다. 본인 변경은 현재 계정 lock과 expectedVersion을 사용하고 일괄 변경은 최대 100개를 원자적으로 처리한다.
- `/me/library`, `/me/library/[workId]`, `/works/[slug]`, `/u/[username]`, 공개 범위 설정에 화면을 연결했다. 검색·상태/플랫폼/장르/별점/기본 티어/개인 태그 필터, 추가/수정/제목/내 별점 정렬, 카드/목록, 24개씩 페이지, 선택 일괄 변경, 공개 기록 저장, 전체 비공개와 평가 삭제 확인을 작성했다. 선택 UI는 현재 페이지 최대 24개다. 미설정 상태는 실제 연결 준비 안내다.
- 평균/별점 수/기본 티어 수를 실제 공개 evaluation으로 계산하며 분모를 분리한다. 본인 통계는 자신의 private 기록을 포함하고 공개 통계는 공개 상태/평가만 각각 집계한다. 장르별 비중은 작품별 장르 수로 나누며 숨겨진/성인/unknown 작품과 비활성 계정은 공개 통계에서 제외한다. 숨겨진 작품의 개인 기록은 작품 메타데이터를 제거한 본인 전용 DTO로 확인·삭제/비공개 전환이 가능하다.
- P2 관리 병합은 개인 테이블을 감지하는 기존 guard를 유지한다. 개인 메모나 리뷰를 조용히 삭제하지 않으며 보존 handler를 구현하기 전까지 병합을 거절한다. 기존 P2 SQL 테스트 기대값도 이 보호에 맞춰 갱신했다.

**작성한 테스트:** `tests/unit/library-validation.test.ts`(planned/별점/날짜/Unicode/태그/필터/선택 version), `tests/integration/library-actions.test.ts`(활성 계정·owner 위조·삭제 확인·copy 범위·안전한 오류), `supabase/tests/03_library_evaluations.test.sql`(anon/A/B 접근·공개 평가와 private 상태 분리·메모/시각 유출 차단·버전 충돌·일괄 rollback·cascade·전체 비공개·정지 계정). 롤백 전용 합성 fixture만 파일에 작성했으며 서비스 데이터로 실행하지 않았다.

**실행한 검사·결과:** 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**. 실제 사용자 흐름 확인도 **없음**. Supabase CLI help를 읽고 migration new로 빈 파일을 생성한 뒤 코드를 작성한 것만 수행했다. CLI의 최초 help는 sandbox telemetry 접근 제한으로 실패했고 허용된 재시도로 help/파일 생성만 진행했다. DB 시작/연결/적용/reset/타입 생성/검사 명령은 실행하지 않았다. Next 설치 문서와 Supabase 공식 RLS/functions/changelog를 읽었으며 의존성 추가·업데이트는 하지 않았다. 컴파일/SQL/권한/동시성/화면이 통과했다고 주장하지 않는다.

**외부 대기·다음 단계:** 공동 Supabase/Auth 연결과 P1~P3 migration 적용, 실제 생성 타입 대조가 필요하다. 그 뒤 사용자 요청에 따라 상태→평가→공개→새로고침→삭제, A/B 권한·planned/경쟁 저장·일괄 rollback·공개 집계의 실제 검수를 수행해야 한다. 다음 개발은 P3 리뷰의 private 편집 초안/게시본 분리·스포일러 명시적 펼치기·기본 신고/차단·관리자 조치다. 안전한 개인 도메인 병합 및 공개 서재 필터/평점순 탐색은 후속 범위로 남긴다.

### 2026-10-02 · P3 리뷰·스포일러·기본 안전 기능 (코드 작성·미검증)

사용자의 다음 개발 요청으로 P3 리뷰와 공개 리뷰에 필요한 기본 신고·차단·운영 조치를 작성했다. 실제 Supabase·메일·OAuth 공동 연결은 계속 보류했다. 브랜치 생성·stage·commit·push·merge·PR는 수행하지 않았고 기존 개인 서재/평가 코드와 `next-env.d.ts` 로컬 변경을 보존했다. P3 전체 완료가 아니며 아래 추적표 체크를 유지한다.

**관련 요구사항:** REV-01/02, REV-03 중 첫 게시 최신순·상세·공유 URL, LIB-07의 리뷰에서 작품 가져오기, SOC-01의 공개 리뷰 목록을 작성했다. SOC-06과 OPS-01/02/04의 리뷰 대상 최소 기능을 앞당겨 작성했다. REV-03 좋아요순·REV-04는 P5, 전체 신고 대상·계정 조치·내보내기/탈퇴·보존 규칙은 P7까지 이어간다.

**변경 기능:**

- `20261002032637_reviews_moderation.sql`: current review unique, 별도 편집 초안과 게시본/version, block helper, owner-only RLS·명시적 grant, 공개/본인/운영 DTO RPC와 rate limit, review 신고·private 운영 감사 이벤트를 작성했다. 본문 raw 공개 SELECT와 일반 DML을 허용하지 않고 공개 상태/활성 작성자/작품/차단을 매 요청에 검사한다. CLI `migration new`는 파일만 생성했으며 migration은 적용하지 않았다.
- `src/lib/reviews/`와 리뷰 컴포넌트: Unicode/JSON/역할/소유권/버전·확인 검증, 수동 초안 저장과 저장된 초안 게시, 공개 취소/삭제, plain text·안전한 HTTP(S) 링크, 스포일러 명시적 읽기 전용 펼치기, 신고·차단·운영 조치와 안전한 오류를 작성했다. 비공개 진행 회차·메모를 공개 payload에 포함하지 않는다. 삭제는 원문/초안만 지우고 서재/평가를 유지한다.
- `/reviews/[id]`, `/works/[slug]/reviews`, `/u/[username]/reviews`, `/me/reviews`·`/me/reviews/[id]/edit`, `/me/reports`, `/settings/blocks`, `/admin/reports`·`/admin/reviews/[id]`를 작성하고 작품/프로필/계정 메뉴에 연결했다. 공개 목록은 첫 게시 최신순 12개, 본인 신고는 20개다. spoiler 초기 body/excerpt는 null이고 메타데이터는 일반 안내만 사용한다. 숨김/초안/삭제/차단은 공개 경로에서 반환하지 않는다.
- 운영 화면은 private DB의 moderator/admin만 접근하고 편집 초안을 제공하지 않는다. hide/restore/reject_report·결과·사유·감사를 원자적으로 작성한다. 작성자는 운영 숨김을 직접 해제할 수 없다. 차단 helper는 공개 프로필·서재·평가·집계에도 연결하며 비회원에는 개인 차단 관계가 없음을 안내한다. P5 팔로우 정리는 관계 테이블 생성 시 추가해야 한다.
- 기존 README·UX·구조·DB·API·진행 문서와 수동 SDK 계약을 갱신했다. 새로운 라이브 생성 타입이나 의존성은 추가하지 않았다.

**작성한 테스트:** `tests/unit/review-validation.test.ts`(초안/게시 길이·Unicode 공백·스포일러/회차·역할/owner 위조·신고/조치·URL), `tests/integration/review-actions.test.ts`(현재 계정/운영 권한·저장된 초안만 게시·확인·권한 변경 후 펼치기·안전한 오류), `supabase/tests/04_reviews_moderation.test.sql`(anon/A/B/운영자·owner-only raw 조회·초안/게시본 분리·개인 기록 미복사·스포일러 초기 payload·Unicode 공백만 있는 직접 RPC 게시 거절·충돌·신고 중복/본인 결과·숨김/복구·차단 공개 필터·공개 취소/삭제·정지 계정). 전부 파일만 작성했으며 DB fixture는 rollback 전용 합성 데이터다.

**실행한 검사·결과:** 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**. 실제로 확인한 사용자 흐름도 **없음**. 소스·설치된 Next 안내·Supabase 공식 functions/RLS/changelog와 PostgreSQL [Unicode 리터럴](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS-UESCAPE)·[문자열 함수](https://www.postgresql.org/docs/current/functions-string.html) 문서 읽기, 파일 생성/작성만 수행했다. DB 연결/시작/적용/reset/타입 생성/관리자 승격은 하지 않았다. SQL·TypeScript·RLS·화면의 통과를 주장하지 않는다.

**외부 대기·잔여 범위·다음 단계:** 공동 Supabase/Auth 연결과 P1~P3 migration 적용·실제 생성 타입 대조·운영자 역할 설정 후 사용자 요청 범위에서 작성→저장→게시→스포일러 펼치기→신고→숨김/복구와 A/B 권한·동시성·차단 집계를 검수해야 한다. 개인 도메인을 보존하는 작품 병합 handler, 공개 서재 필터, 평점순 탐색은 남아 있고 현재 병합은 기존 guard로 거절한다. 신규 review FK/신고 기록도 P7의 보존·비식별화·참조 정리와 hard-delete 작업자에 포함해야 한다. 다음 개발은 이 P3 잔여 범위를 이어가고 이후 P4 티어 편집기로 진행한다. 검사와 Git 동작은 각각 명시 요청 후 수행한다.

### 2026-10-02 · Stitch 디자인 적용 (화면 코드 작성·미검증)

이 절은 첫 적용 당시의 기록이다. 이후 사용자가 시안과 차이를 지적해 아래 재대조·수정 기록으로 화면 구조와 폰트 제공 상태를 갱신했다.

사용자의 디자인 우선 작업 요청에 따라 연결된 Stitch 프로젝트 `12805909731394937510`의 표시된 홈·탐색·작품 상세·내 서재·티어 편집기 HTML/이미지를 읽고 기존 앱 화면에 반영했다. `frontend-design`과 React 성능 지침을 참고했으며 앱 검수 지침 대신 사용자의 검사 실행 제한을 따랐다. 브랜치 생성·stage·commit·push·merge·PR는 이번 구현 요청에 포함되지 않아 수행하지 않았고 기존 `next-env.d.ts` 변경은 보존했다.

**관련 요구사항:** CAT-01/02/03/04/07, LIB-04, RATE-04, REV-03, OPS-05의 기존 화면 표현을 갱신했다. TIER-03/04는 빈 배치 미리 보기만 작성했으며 실제 편집 기능은 미구현이다. DB·권한·화면 실행 근거가 없으므로 아래 완료 체크는 바꾸지 않았다.

**변경 기능·파일:**

- 공통 `globals.css`·헤더·내비게이션·레이아웃: 초록색 TS 로고/CTA, 검색, 1240px 너비, 작은 모서리, 플랫폼/상태/티어 배지, 테마·반응형 규칙과 푸터를 작성했다. 웹 폰트·새 패키지를 추가하지 않았다.
- `/`: 개념 텍스트 배너, 실제 요일 필터 링크, 공개 최근 등록 작품 6개, 첫 작품의 공개 리뷰와 준비 중 티어 안내를 작성했다. 가짜 표지·작품·평점·회원·리뷰를 가져오지 않았다.
- `/explore`와 작품 카드: 검색 아이콘, 수평 체크 필터, 작은 표지 그리드와 상태/플랫폼 배지를 작성했다. 기존 검색·필터·cursor 동작을 재사용했고 평점순은 계속 준비 상태다.
- `/me/library`와 서재 컴포넌트: 본인 프로필·통계, 기본 카드 보기와 오른쪽 기록 편집 패널을 작성했다. 서버에서 검증한 `edit` UUID는 현재 페이지의 본인 기록만 선택한다. version 기반 기존 저장 action을 재사용하며 저장 후 기존 개별 기록 화면으로 이동한다. 숨긴 작품의 공개 메타데이터는 제공하지 않는다.
- `/works/[slug]`와 `TierDistribution`: 실제 공개 평가 요약·분모, 소개/공식 플랫폼/기록/리뷰 본문과 오른쪽 기본 티어 분포를 작성했다. 스포일러 본문 표시 경로와 private 데이터 경계를 유지했다.
- `/tiers`: 준비 안내·비활성 저장/PNG 버튼·작품 대기 영역·빈 S~F 행만 작성했다. 작품 추가·배치·자동 저장·게시·공유는 구현하지 않았고 P4 완료로 표시하지 않는다.
- README·UX·구조·진행 문서·AGENTS의 최근 작업 범위를 갱신했다. 기존 E2E의 홈 링크 기대 문구를 변경했으며 신규 테스트·migration·DB 계약·의존성은 추가하지 않았다.

**실행한 검사·결과:** 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 앱 검수는 **모두 미실행**. 실제로 확인한 사용자 흐름도 **없음**. Stitch 연결 조회와 참조 HTML/이미지 읽기, 소스/문서 읽기·작성만 수행했다. 참조 이미지 확인은 앱 실행/시안 일치 검수가 아니며 컴파일·저장·모바일·대비·접근성이 통과했다고 주장하지 않는다.

**외부 대기·다음 단계:** Supabase/Auth 공동 연동·P1~P3 migration 적용·생성 타입 대조는 이전 결정대로 대기한다. 화면 검수는 별도 요청 후 진행하며 실제 데이터가 있어야 서재 패널·상세·리뷰 흐름을 확인할 수 있다. 개발 잔여 범위는 P3의 개인정보 보존 병합·공개 서재 필터·평점순 탐색과 P4 실제 편집/저장/게시/공유다. Git 반영은 다음 커밋·push 요청 시 작업 브랜치 커밋/push → develop merge/push 기본 순서를 따른다.

### 2026-10-02 · Stitch 원본 재대조·화면 수정 (소스 작성·미검증)

사용자가 지정한 [Stitch 프로젝트](https://stitch.withgoogle.com/projects/12805909731394937510)의 현재 표시된 5개 화면 목록과 참조 HTML·이미지를 다시 읽었다. 첫 적용은 색상 중심으로 맞췄지만 본문/제목 크기, 2:3 표지, 홈 섹션 순서, 서재 카드 열 수, 상세 기록 입력 위치, 티어 행 크기가 원본과 달랐다. `systematic-debugging`·`frontend-design` 지침을 참고해 이 차이를 소스에서 수정했다. 숨긴 이전 디자인을 기준으로 삼지 않았다. 실제 앱을 실행해 일치 여부를 확인한 것은 아니다.

**관련 요구사항:** CAT-01/02/03/04/07, LIB-04, RATE-04, REV-03, OPS-05의 기존 표현을 수정했다. TIER-03/04는 디자인 미리 보기뿐이며 실제 편집·저장·게시·공유는 미구현이다. `/rankings`는 준비 안내만 추가했고 P6 순위·개인화 추천을 구현한 것으로 취급하지 않는다. 완료 체크는 변경하지 않았다.

**원본과 수정 소스 대조:**

| 영역 | 참조 HTML에서 확인한 기준 | 수정한 소스 |
|---|---|---|
| 공통 | 헤더 56px, 최대 너비 1240px, 12px 여백, 본문 14px·메타데이터 11px·배지 10px | `stitch.css`를 기존 CSS 뒤에 분리 적용, 작은 테마 메뉴·실제 계정 아바타, 6개 데스크톱 메뉴·푸터 |
| 홈 | 배너 높이 340px·2:1, 제목 26px, 작품 6열 → 티어 3열 → 리뷰 2열 | 과도한 제목 크기·개념 표지 묶음·추가 안내 영역 제거, 오른쪽 이미지/설명 영역과 고정 요일 메뉴 작성 |
| 탐색 | 전체 너비 흰 필터, 768px 검색, 수평 4행, 3:4 표지·테두리 없는 6열 | 기존 검증 GET 필터·정렬·페이지 경로를 유지하며 구조와 카드 배지·작가·장르 크기 수정 |
| 내 서재 | 왼쪽 프로필/통계/상태 탭/카드와 오른쪽 기록 패널 8:4, 넓은 화면 카드 6열 | 실제 본인 통계 4칸, 기본 첫 기록 선택, 작은 도구 모음·카드·상태/별점 푸터·기록 패널 |
| 작품 상세 | 192px 표지·26px 제목·통계 4칸, 전체 너비 기록 입력 후 본문/사이드바 8:4 | 기록 입력 위치 이동, 실제 티어 분포와 같은 첫 장르 최근 등록 작품 최대 4개 표시 |
| 티어 | 작품 영역 320px, 행 이름 112px, S~C 96px/D 88px/F 72px, 하단 미배치함 | 원본 S~F 색·행 간격·행 도구·하단 영역 작성, 미구현 조작은 비활성 |

화면별 Stitch ID는 [02 문서](02-ux.md)의 표에 기록했다. 홈 리뷰는 기존 RPC 계약에 따라 첫 작품의 공개 리뷰만 조회하며 전체 최신 리뷰나 인기 순위로 표시하지 않는다. 티어 안내 카드는 기능 안내로 표시하고 예시 작품·회원·평점·이용자 수·리뷰를 운영 자료처럼 만들지 않는다. 서재 `edit=UUID`는 현재 페이지의 본인 기록만 선택하고 `edit=none`은 선택 해제다. 숨긴 작품 메타데이터와 개인 회차·메모는 기존 권한 경계를 유지하며 패널 저장은 기존 version action과 개별 기록 화면으로의 이동을 사용한다. 자동 저장을 제공한다고 표시하지 않는다.

**폰트·이미지:** 공식 [Inter 4.1 배포](https://github.com/rsms/inter/releases/tag/v4.1)와 [Pretendard 1.3.9 배포](https://github.com/orioncactus/pretendard/tree/v1.3.9)의 variable WOFF2와 각 SIL OFL 라이선스를 `public/fonts`에 저장했다. 원본 파일을 변형하지 않고 `@font-face`로 자체 제공한다. 새 의존성·migration·DB 계약은 추가하지 않았다. 시안 홈 배너 일러스트의 다운로드 요청은 자동 승인 검토에서 예시 웹툰 이미지 사용 허가가 불명확하다는 이유로 **거절**됐고 다운로드하지 않았다. 배너 일러스트를 화면 표시용 로컬 자산으로 사용하는 별도 승인 대기이며 현재는 허가된 카탈로그 표지 또는 직접 만든 T 문자로 표시한다. 예시 작품 표지·PNG/OG 재배포는 승인 범위에 포함하지 않는다.

**문서·테스트 소스:** README·UX·구조·진행 문서와 AGENTS의 최근 작업 내용을 갱신했다. 기존 E2E의 홈 링크 문구와 테마 메뉴를 먼저 여는 선택자를 수정했지만 테스트는 실행하지 않았다.

**실행한 검사·실제 사용자 흐름:** 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 앱 검수는 **모두 미실행**이며 실제로 확인한 사용자 흐름은 **없음**이다. 수행한 작업은 Stitch 연결 조회, 참조 HTML/이미지와 설치 문서·앱 소스 읽기, 코드/문서 작성, 공식 폰트/라이선스 다운로드다. 컴파일·저장·테마·모바일·접근성·시안과 실제 렌더링 일치를 확인했다고 주장하지 않는다. Git은 status/diff 읽기만 수행했고 브랜치 생성·stage·commit·push·merge·PR는 수행하지 않았다. 기존 `next-env.d.ts` 변경은 보존했다.

**대기·다음 단계:** 배너 일러스트 표시 승인은 별도로 받고, 실행 검수는 사용자 요청 범위에서만 진행한다. Supabase/Auth 공동 연동·migration 적용·생성 타입 대조는 이전 결정대로 대기한다. P3의 개인 기록 보존 병합·공개 서재 필터·평점순 탐색과 P4 실제 편집/저장/게시/공유는 남아 있다. 다음 Git 반영 요청에는 작업 브랜치 commit/push → develop merge/push 순서를 적용한다.

### 2026-10-03 · P3 공개 서재 검색·필터 (작성·실행 미검증)

**상태:** 진행/외부설정대기. 다음 기능 개발 요청에 따라 P3 잔여 범위 중 공개 서재 필터를 작성했다. 관련 요구사항은 LIB-04, SOC-01, LIB-07의 기존 공개 작품 가져오기 경로다. 실제 동작/권한 검수가 없으므로 추적표는 완료로 바꾸지 않았다.

**변경 기능·파일:**

- `/u/[username]/library`와 `PublicLibraryFilterForm`: 공개 작품 제목/별칭/작가 검색, 상태·플랫폼·장르·정확한 반점 별점·기본 티어 조건, 제목/공개 별점/공개 티어 정렬, 조건 초기화·빈 결과·잘못된 조건 안내·조건을 유지하는 24개 페이지 이동을 작성했다. GET 적용은 첫 페이지로 돌아간다.
- 공개 프로필과 `PublicLibraryItems`: 새 검색 경로를 연결하고 기존 공개 카드와 내 서재 저장 action을 재사용한다. 타인 평가/기록 복사나 private owner DTO는 추가하지 않았다.
- `library/model.ts`·`data.ts`·수동 `database.contract.ts`: public 필터 스키마/URL/응답 타입과 별도 RPC 계약을 추가했다. 기존 get_public_library 호출과 UUID순 프로필 페이지 계약은 유지한다. query scalar 중복·개인 태그/메모/회차 필터·개인 생성/수정일 정렬·소유자 위조·허용하지 않은 필드는 거절한다.
- Supabase CLI `migration new public_library_search`로 생성한 `20261002162554_public_library_search.sql`에 새 `search_public_library`를 작성했다. 파일 생성만 수행했고 DB 적용은 하지 않았다. 공개 상태를 투영하고 공개 평가만 join한 뒤 필터·총수·정렬을 계산하며 소유자도 이 public 경계를 사용한다. 차단/계정/작품 공개 조건은 기존 helper를 재사용한다. 개인 details/활동 시각은 읽지 않고 공개 컬럼으로만 정렬하며 `EXISTS`로 분류 조건을 적용해 작품을 중복 집계하지 않는다. 기존 owner/관계 PK와 인덱스를 재사용하며 성능은 미검증이다.
- `stitch.css`: 기존 작은 검색 도구 모음·카드·폰트·간격으로 새 화면을 구성했다. 기존 5개 시안 배치와 준비 상태를 유지한다.

**작성한 테스트:** unit에 private query/정렬 거절, scalar 중복·평가·Unicode 경계, 조건을 보존하는 URL 인코딩을 추가했다. `supabase/tests/05_public_library_search.test.sql`에는 rollback 전용 anon/A/B 합성 fixture로 독립 공개 상태/평가·private 값에 따른 결과 수/순서 비노출·본인 public 투영·LIKE 문자·복합 분류·페이지 중복/상한·차단/정지/숨김 작품 사례를 작성했다. 테스트 파일만 작성했고 실행하지 않았다.

**실행한 작업·검사 결과:** 소스/설계/설치된 Next Promise page 안내와 공식 [Supabase functions](https://supabase.com/docs/guides/database/functions)·[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)·[changelog](https://supabase.com/changelog)를 읽고 파일을 작성했다. CLI help는 최초 sandbox 밖 telemetry 파일 접근으로 실패한 뒤 승인된 재실행에서 안내를 읽었고 빈 migration 파일 생성은 성공했다. 이 명령들은 DB 적용/검사가 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**이며 실제로 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/운영자 지정은 수행하지 않았다. Git은 status/diff 조회만 허용 범위에서 수행하고 branch 생성·stage·commit·push·merge·PR는 하지 않았다.

**외부 대기·다음 단계:** 공동 Supabase/Auth 연결과 새 migration 적용·실제 DB 타입 대조 후 사용자 요청 범위에서 공개 프로필→검색/필터→페이지 이동→내 서재 저장과 A/B·차단·독립 공개 조건을 검수해야 한다. P3 개인 기록을 보존하는 작품 병합과 평점순 카탈로그, 이후 P4 실제 티어 편집/저장/게시/공유는 남아 있다. 시안 배너 일러스트 승인은 별도 대기다.

### 2026-10-03 · P3 카탈로그 공개 평균 평점순 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. 다음 기능 개발 요청에 따라 CAT-03 평점순 카탈로그와 RATE-03의 단일 public 별점 집계 코드를 작성했다. 공개 서재의 개인 평가 정렬과 독립된 작품별 평균이며 P3 전체 완료가 아니다. 실제 동작/권한 검사 없이 요구사항 추적표를 완료로 바꾸지 않았다.

**작성한 변경:**
- `/explore`에서 평점순을 선택하고 모든 필터/다음 페이지 URL을 유지하도록 연결했다. 카드에 공개 평균(소수 둘째 자리)·별점 평가 수 또는 `평가 없음`을 표시한다. 평균 내림차순·동률 평가 수 내림차순·작품 ID 순서이며 평가 없는 작품도 뒤에 포함한다. 기존 Stitch 필터/카드 배치에 작은 요약/공개 평가 안내만 추가했다. form key는 URL 조건 변경 때 uncontrolled 입력을 갱신한다.
- `catalogue/model.ts`/`cursor.ts`/`data.ts`: 별도 public 별점 요약 스키마, rating sort와 v2 cursor를 작성했다. 입력/limit/cursor를 SDK 생성 전에 검사하고 한 번의 사용자 세션 RPC로 카드/요약/page를 받는다. cursor는 반올림한 평균 대신 정수 합계·건수·조회자 자신 ID를 사용하고 기존 latest/title v1을 유지한다. 공개 기준이 바뀌면 초기화 안내를 제공한다. 기본 카드/개인 서재/상세 DTO는 기존 계약을 유지했다.
- Supabase CLI `migration new catalogue_rating_sort`로 만든 `20261003053412_catalogue_rating_sort.sql`에서 기존 `search_catalogue` 본문을 교체한다. signature는 유지하며 public/활성/차단/작품 가시성 조건을 적용한 별점만 먼저 집계해 분모 중복을 막는다. 개인 상태·메모·태그·진행/수정 시각은 읽지 않는다. 서재가 private이고 평가가 public인 별점은 포함하고 자기 private 평가·tier-only·정지/미온보딩/동의 누락 평가는 제외한다. 기존 인덱스를 재사용하고 latest/title은 page/lookahead만, rating은 일치하는 작품 전체의 평가를 집계한다.
- 직접 RPC도 cursor type/키/2KiB/정수 합계·건수/현재 auth.uid/기준 작품의 현재 공개 집계를 검사한다. 변경/숨김 기준 작품은 페이지 재시작을 요구한다. 읽기는 현재 공개 상태이며 전체 결과 snapshot은 아니어서 다른 작품의 평가가 바뀌면 위치가 달라질 수 있다. 기존 빈 search_path/제한된 EXECUTE/statement timeout/로그인 검색 요청 제한을 유지하고 table/RLS/DML grant는 변경하지 않았다.
- `database.contract.ts`의 수동 sort 계약과 README/02~05 문서의 UI·집계·cursor·권한 설명을 갱신했다. 새 의존성·합성 운영 데이터·이미지 다운로드는 추가하지 않았다. P6의 최소 5건/weighted_score/완독자·경험별 표본은 별도 후속 계약이다.

**작성한 테스트:** unit에 rating URL 보존/정렬 변경/두 cursor 버전/Unicode 제목/정수·빈 분모·safe integer/요약 경계를 작성했다. `tests/integration/catalogue-search.test.ts`에는 mock DAL의 SDK 호출 전 거절·단일 RPC·정확한 next cursor·안전한 재시작/오류를 작성했다. `supabase/tests/06_catalogue_rating_sort.test.sql`은 rollback 전용 anon/본인/차단/정지 합성 fixture로 독립 공개 경계·관계 중복 분모·LIKE/공식 링크 조건·동점·반복 소수·평가 없는 page 경계·private 변경에 따른 응답 불변·공개 변경/숨김/로그인 cursor 재시작·다음 요청 비공개 전환을 작성했다. 파일만 작성했고 실행하지 않았다.

**실행한 작업·검사 결과:** 소스/설계/설치된 Next Promise page 안내와 공식 [Supabase functions](https://supabase.com/docs/guides/database/functions)·[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)·[changelog](https://supabase.com/changelog)를 읽었다. changelog markdown은 web의 content-type 미지원 후 문서 파일로 받아 읽었고 관련 minor Postgres/Data API 변경 안내를 읽었다. 고정 package/lockfile 버전을 유지했다. CLI help 읽기와 빈 migration 파일 생성만 성공했다. 이는 DB 연결/검사가 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**이며 실제로 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/운영자 지정은 하지 않았다. Git은 status/diff 읽기만 수행하고 branch 생성·stage·commit·push·merge·PR는 수행하지 않았다.

**외부 대기·다음 단계:** 공동 Supabase/Auth 연결과 새 migration 적용·실제 DB 생성 타입 대조 후 사용자 요청 범위에서 탐색→평점순→조건 적용→페이지 이동과 공개/비공개/차단/정지/동시 평가 변경·검색 성능을 검수해야 한다. 다음 개발은 P3의 개인 기록을 보존하는 작품 병합이며 그 뒤 P4 실제 티어 편집/저장/게시/공유를 진행한다. P1~P3 실행 검증과 시안 배너 일러스트 승인 대기는 유지한다.

### 2026-10-03 · P3 개인 기록 보존 작품 병합 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. CAT-08, LIB-01/03/05/06, RATE-03, REV-01, OPS-04의 병합 보존 경로를 작성했다. P3 완료 체크는 실제 검수까지 유지한다. 실제 Supabase·메일·OAuth 공동 연결은 보류했다.

**작성한 변경:**
- `/admin/works/merge`: 도메인 이동/중복 건수와 메모·태그·날짜·planned 평가·리뷰 중복·작품 관계·원본 비공개 조건 충돌 건수를 표시한다. 개인 내용/회원 ID는 표시하지 않는다. 보존 정책과 동일 웹툰 확인/사유를 요구하며 충돌 시 폼을 숨긴다. 미리보기는 관리자·작품 쌍의 10분 토큰이며 source/target version과 내부 SHA-256 snapshot으로 개인 수정도 감지한다.
- `20261003091940_personal_record_safe_merge.sql`: 최신 상태/평가/진행 선택, 각 visibility private 우선, 메모 출처/태그 union, 원래 기록 owner 보관본, source-only version 갱신과 링크 ID 보존을 transaction으로 작성했다. 원문/초안/내부 digest를 감사 로그나 관리자 RPC에 반환하지 않는다. 두 현재 리뷰는 거절하고 나머지 리뷰의 ID/본문/게시/스포일러/운영 상태·신고/운영 참조·편집 초안을 유지하며 버전을 올린다. NOWAIT/try-advisory 경합은 rollback/재확인으로 처리한다. P4 티어/P5 글 도메인은 아직 거절한다.
- `/me/library/merges`: 본인 병합 안내·원래 두 기록 확인/복사·확인 후 보관본 삭제·현재 기록/리뷰 연결을 추가했다. 현재 기록 변경과 보관본은 별개라고 안내한다. 옛 내 기록 URL은 본인 이력과 현재 본인 기록이 있을 때만 이동한다. private 두 테이블에 RLS/권한 제거, owner RPC에 현재 UID/세션·활성/동의 게이트를 적용했다. work_id 기반 비공개 기록/공식 링크 인덱스와 수동 RPC 계약, 성공 후 관련 페이지 revalidation을 작성했다.

**작성한 테스트:** `tests/unit/merge-preview.test.ts`, `tests/integration/merge-history.test.ts`와 기존 catalogue 액션 테스트에 정책/확인/토큰, 개인정보 없는 DTO/오류, owner 게이트/보관본 삭제/redirect/revalidation을 작성했다. `supabase/tests/07_personal_record_safe_merge.test.sql`은 rollback fixture로 권한 위조, 원문/초안/digest 비노출, 미리보기 변경/만료, 메모·태그·날짜·planned·중복 리뷰·숨김 원본 충돌, 원본 보관/개인 공개 범위/평가 중복 분모, 리뷰/초안 버전·신고/운영 참조 보존, owner 조회/타인 삭제 거절, 미래 도메인 차단을 작성했다. 기존 P2 SQL 기대값을 새 token signature에 맞췄다. 파일만 작성했으며 실행하지 않았다. 실제 여러 세션의 lock 경합/동시 수정 검수는 별도로 남아 있다.

**실행/결과:** 소스·설계·설치된 Next Server Actions/revalidatePath, Supabase functions/changelog와 PostgreSQL 잠금/SHA-256 공식 안내를 읽었다. 고정 의존성을 유지했다. CLI `migration new --help` 읽기와 빈 migration 파일 생성만 수행했으며 DB 연결/검사가 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 검수는 **모두 미실행**, 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/운영자 지정도 하지 않았다.

**Git:** 새 작업 브랜치 준비에 대한 상시 허가에 따라 최신 origin/develop을 fetch하고 같은 기준 HEAD에서 `feature/personal-record-safe-merge`를 만들었다. 기존 AGENTS.md의 미커밋 Git 규칙 변경은 보존했다. stage·commit·push·통합 merge·PR는 하지 않았다.

**외부 대기·다음 단계:** 공동 Supabase/Auth 연결, migration 적용·실제 생성 타입 대조·관리자 지정 후 요청된 검사로 미리보기→충돌 해결→병합→본인 원본/리뷰 확인·타인 접근 거절·동시 편집·성능을 확인해야 한다. P1~P3 검증과 시안 배너 승인 대기는 유지한다. 다음 개발은 P4 실제 티어 편집·자동 저장·게시·공유이며, 테이블 추가 시 이번 미래 도메인 guard와 티어 보존 handler를 함께 확장해야 한다. P7에서 병합 보관본의 export/탈퇴 정리를 포함한다.

### 2026-10-03 · P4 비공개 티어 초안 편집·저장 첫 증분 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-01, TIER-02 일부(서재/카탈로그 검색), TIER-03~06, CAT-08 보존 경로를 작성했다. P4 전체 완료로 표시하지 않는다. 실제 Supabase·메일·OAuth 공동 연결은 계속 대기다.

**작성한 변경:**
- `/tiers` 진입, `/tiers/new`, `/me/tiers`, `/tiers/[id]/edit`: 생성·본인 초안 복사·확인 후 삭제, 작품 검색·페이지·추가/제거, 드래그/모바일 행 메뉴/순서 버튼/Alt+방향키 이동, 2–10행 이름·색상·순서·canonical 코드·추가/삭제, 미배치함·중복 방지, 50상태 undo/redo를 작성했다. 행 삭제는 작품을 미배치로 옮긴다. Stitch 320px 선택 영역/112px 이름/하단 보관함과 자체 글꼴을 유지한다.
- 800ms 단일 요청 자동 저장과 최신 편집 후속 요청, 수동 저장·연결 실패 재시도·서버 시각, 유효성 오류 자동 복구, 충돌 시 최신 불러오기/새 티어표 저장을 작성했다. 늦은 응답은 새 편집을 덮지 않고 서버 버전을 이어받는다. 닫기/링크/폼 이탈과 Navigation API 지원 브라우저의 traverse 경고를 연결했으며 브라우저별 뒤로가기 동작은 미검증이다. 영구 로컬 백업은 사용하지 않고 저장 실패한 편집이 화면을 닫으면 사라진다고 안내한다.
- `20261003130130_tier_draft_editor.sql`: private-only metadata/draft·RLS·직접 권한 제거·현재 owner RPC·50표/300작품/2–10행/256KiB·code point·참조·중복·canonical·연속 위치 검증, 전체 저장/version/time, 기존 unavailable placeholder/복사와 신규 숨김 주입 거절을 작성했다. canonical 평가/공개 통계는 수정하지 않는다. 수동 SDK RPC 계약을 갱신했다.
- P3 merge의 fingerprint·NOWAIT 사용자/초안 잠금·도메인 건수에 tier를 추가했다. 기존 target 배치 유지/중복 정리/원래 draft 전체 owner archive/version+1을 기존 개인 기록 병합과 같은 transaction으로 처리한다. 관리자에게 원문·초안/digest를 제공하지 않는다. 편집기 최근 이력과 `/me/tiers/[id]/merges` 20건 페이지에서 소유자 원본을 확인한다. 기존 P3 공통 handler는 private으로 제한하고 public wrapper가 티어 잠금을 맡는다. 미구현 게시본/게시글 guard는 유지한다.

**작성한 테스트:** `tests/unit/tier-drafts.test.ts`, `tier-save-queue.test.ts`, `tests/integration/tier-actions.test.ts`에 Unicode/상한/중복/참조/행 삭제·순서/50 undo·redo/800ms 직렬·늦은 응답/버전·오프라인·충돌·폐기/owner 액션·안전한 DTO/오류를 작성했다. `supabase/tests/08_tier_draft_editor.test.sql`은 rollback fixture로 직접 접근·owner/admin 격리·version·숨김 보존/주입·본인 복사·50표 상한·계정 게이트·tier 변경 미리보기 만료/병합 target 유지·원본·기본 평가 불변·삭제를 작성했다. 기존 미래 도메인 guard 테스트는 아직 미구현 publication으로 옮기고 admin DTO 테스트를 갱신했다. **파일만 작성했으며 실행하지 않았다.** 실제 동시 세션 lock/다중 탭·300작품 성능·전체 사용자 흐름은 별도 검수가 필요하다.

**실행/결과:** 소스·설계·설치된 Next Server Action/page 안내, Supabase 함수/공식 changelog와 PostgreSQL JSON 안내를 읽었다. 의존성/lockfile을 유지했다. CLI `migration new --help` 읽기와 migration 파일 생성만 수행했으며 DB 연결/검사가 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**, 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/운영자 지정도 하지 않았다.

**Git:** 최신 origin/develop fetch/fast-forward 기준 갱신 후 `feature/tier-draft-editor`에서 작성했다. 사용자 개발 요청의 상시 승인 범위이며 stage·commit·push·통합 merge·PR는 수행하지 않았다.

**외부 대기·다음 단계:** 공동 DB/Auth 연결·migration 적용·실제 생성 타입 대조 후 요청된 검사로 생성→검색/배치→저장/복사/삭제, 두 탭 충돌/새 표 보존·숨김/계정 전환·병합 원본/권한을 확인해야 한다. 다음 P4 증분은 게시본 분리/public·unlisted·철회·URL/OG/PNG·공개 게시본 복제와 기본 평가 가져오기/명시적 반영이다. P1~P3 실행 검증·시안 배너 승인 대기와 P5~P7 범위를 유지하고 P7 export/탈퇴에는 티어 원본도 포함한다.

### 2026-10-04 · P4 티어표 게시·공유 증분 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-07/12, TIER-08의 URL·기기 공유, TIER-10의 최신 공개 목록, CAT-08 게시본 보존과 SOC-06/OPS-01/02/04/06/07의 관련 경계 코드를 작성했다. OG 이미지·PNG·기본 평가 가져오기/반영·인기/테마/소셜 반응·대표 티어·과거 게시본 owner UI는 이번 증분에 포함하지 않았으며 최종 범위에서 생략하지 않는다. 요구사항 추적표는 실행 미검증으로 체크하지 않는다.

**작성한 기능:** `/tiers/[id]/publish`에서 저장된 초안의 미배치 제외 미리보기·기대 초안/lifecycle 버전·현재 작품 DTO fingerprint·공개 범위/스포일러/게시 확인을 처리한다. 게시 후 초안 autosave는 별도다. `/tiers/[id]`와 `/share/t/[token]`은 현재 게시본만 제공하며 공개/링크 공개·작성자 상태·차단·운영/철회·버전을 재검사한다. spoiler title/description/rows는 초기 HTML·목록·metadata에서 제외하고 명시적 펼치기에서 가져온다. 텍스트 표지와 기존 Stitch 행 색상/112px 이름 칸·모바일 72px 칸을 사용한다. `/tiers`는 원본 기본 보드를 유지하고 실제 최신 공개 목록 12개 페이지를 추가한다.

주소 확인/복사/기기 공유, CSPRNG 32바이트 token·SHA-256 hash·AAD에 list ID/형식 버전을 포함한 AES-256-GCM private 보관·owner 현재 버전 복구를 작성했다. 링크 공개 게시/업데이트·회전 때 이전 token을 철회하고 비공개 전환·삭제·운영 숨김에도 접근을 막는다. 키 누락·형식 오류 시 unlisted 발급/복구는 중단하며 plaintext 대체나 비밀 client 변수를 사용하지 않는다. 공개 게시와 비공개 철회는 공유 키가 없어도 가능하다. 공유 경로의 Next 로그 제외·no-store/no-referrer/noindex와 일반 metadata를 작성했으며 OG 이미지를 구현했다고 보고하지 않는다.

현재 접근 가능한 게시본을 새 private 초안으로 복사하며 unavailable·미배치·원 작성자의 개인 기록/토큰은 가져오지 않는다. 평가/공개 통계는 수정하지 않는다. 신고자 `/me/tier-reports`, 운영자 `/admin/tier-reports`→`/admin/tiers/[id]`와 기존 차단 경로를 연결했다. 신고는 현재 타인 게시본/유효 token·pending 중복·서버/DB 입력·rate를 검사하며 운영자는 현재 게시본·최근 신고/감사만 받는다. 숨김/복구/신고 결과/감사는 private 역할·기대 version 아래 원자적으로 처리하며 복구만으로 이전 링크를 살리지 않는다. 비공개 초안/옛 게시본/토큰은 운영 DTO에 없다.

**Migration/계약:** CLI가 생성한 `20261003145059_tier_publication_sharing.sql`에 immutable publication·현재 포인터/FK·단조 counter/lifecycle version, private token/report/audit·RLS/직접 권한 제거·제한된 owner/public/운영 RPC를 작성했다. P3 병합 fingerprint·도메인 건수·NOWAIT owner/metadata/draft 잠금에 현재 publication을 포함하고 lifecycle을 갱신한다. publication 원본은 보존하고 매 조회/복제에서 merged ID를 해석해 target 배치를 유지한다. 공개 불가능한 source가 현재 게시본에 있으면 병합을 거절한다. 미구현 tier_list_items/posts guard를 유지하고 이전 pgTAP sentinel을 posts로 이동했다. 수동 SDK 계약만 갱신했으며 생성 타입은 아직 없다.

**작성한 테스트:** `tests/unit/tier-share-token.test.ts`는 entropy/nonce 독립·암호문만 보관·AAD/tag/nonce/hash 변조·키 누락/형식·token 정규화를, `tests/integration/tier-publication-actions.test.ts`는 owner/입력 주입·저장된 version/fingerprint·암호문 전달·CONFIG_REQUIRED·안전한 충돌·주소 복구·명시적 펼치기를 mock으로 다룬다. `supabase/tests/09_tier_publication_sharing.test.sql`에는 rollback fixture로 직접 권한·초안/게시본 분리·스포일러·placeholder·unlisted UUID/목록 차단·다른 owner 격리·복제/평가 불변·신고/운영 역할·링크 회전/철회·차단·publication 변경 미리보기 만료·병합 snapshot 보존/버전·삭제를 작성했다. **모두 파일 작성만 했고 실행하지 않았다.** 실제 동시 세션·300작품·DB/브라우저 통합 결과는 없다.

**실행/검사 결과:** 소스·설계·설치된 Next 문서와 Supabase 함수/API/changelog·Node 24 crypto 공식 문서를 읽고 Git 상태/diff를 조회했다. Supabase CLI `migration new --help`와 빈 migration 파일 생성만 실행했다. 이는 DB 연결·검사·적용이 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동 검수는 **모두 미실행**이고 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/운영자·키 지정은 수행하지 않았다. 의존성과 lockfile은 유지했다.

**Git:** origin/develop을 fetch했고 이전 feature HEAD와 develop/origin/develop의 기준 commit이 동일함을 확인했다. 이전 미커밋 초안 코드를 그대로 보존하며 standing branch 준비 승인에 따라 최신 develop 기준 `feature/tier-publication-sharing`로 옮겼다. 사전 커밋은 필요하지 않아 앞서 요청한 진행 방식 답변 없이도 개발을 계속할 수 있었다. stage·commit·push·통합 merge·PR는 하지 않았다.

**외부 대기·다음 단계:** 실제 Supabase/Auth·메일·OAuth 공동 연결, migration/생성 타입 적용·역할 지정, 서버 전용 32바이트 base64 SHARE_TOKEN_ENCRYPTION_KEY 등록과 배포 프록시/CDN token URL 로그 redaction은 공동 설정/검수 대기다. 이후 사용자 요청 시 저장→게시→다른 세션 열람/복제→링크 회전/비공개 철회·권한/경합·스포일러·차단/운영·병합을 검수해야 한다. 다음 P4 개발은 OG 이미지·권리 구분 PNG 분할·기본 평가 가져오기/명시적 반영이며 인기/테마·소셜·대표 티어와 P7 보관본 export/탈퇴 정리도 남아 있다. 기존 P1~P3 미검증·시안 배너 승인 대기는 유지한다.

### 2026-10-04 · P4 티어 PNG 분할·OG 이미지 증분 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-08 OG, TIER-09 회원 이미지 저장, OPS-03/04/07의 이미지 경계를 작성했다. P4 전체 완료나 실제 공유/저장 통과로 표시하지 않는다. 비회원 PNG는 이번 증분에서 로그인 안내를 표시하며 전체 요구사항은 후속 token/IP 제한 구현까지 남는다.

**작성한 변경:** `feature/tier-image-export`에서 저장된 본인 초안·현재 접근 가능한 게시본의 POST PNG 저장, 7작품/줄·7줄/페이지·최대 8장 분할 ZIP, 파일 저장·지원 기기 파일 공유를 작성했다. 초안만 미배치함을 포함하며 편집 중/저장 실패는 비활성화한다. 스포일러 게시본은 별도 확인을 요구한다. `begin_tier_image_export`는 현재 회원/소유권 또는 public·유효 token·차단/author·운영 상태/버전 아래 텍스트 DTO를 만들고 사용자별 고정 10분 구간 5번 DB 예약을 커밋한다. 한 ZIP은 한 요청이며 실패/취소도 예약을 유지한다. 렌더 뒤 `get_tier_image_source`로 다시 읽어 내용/현재 가시성 fingerprint가 바뀌면 반환을 거절한다. 서버 입력 2KiB, 최대 PNG 합계 16MiB·8장, 렌더/요청 timeout, POST Origin/JSON·strict 입력·query token 거절과 안전한 오류를 작성했다.

공개 OG는 token 인자를 받지 않는 현재 public reader를 두 번 읽는다. 스포일러는 내용 없는 공통 카드, 스포일러 없는 public만 제목·최대 3행의 일부 텍스트 미리보기다. unlisted metadata에는 내용·ID·token URL 없이 공통 `/api/og/tiers`만 넣는다. 모든 이미지 응답과 metadata는 no-store/no-referrer/noindex다. PNG/OG에 remote 표지/아바타/asset URL을 사용하지 않고 자체 텍스트·Stitch 행/초록색 토큰을 Sharp/Pango로 그린다. Pretendard 1.3.9 공식 OTF/SIL OFL 파일과 Next font tracing 설정을 추가했으며 CDN/폰트 fallback 서비스에 사용자 텍스트를 보내지 않는다. 긴 설명/제목 일부는 말줄임 처리하고 행/작품 순서와 unavailable placeholder를 보존한다. 공통 일반 OG bytes만 서버 메모리에 재사용하고 사용자 이미지·ZIP은 디스크/Storage/shared cache에 보관하지 않는다. 저장/수신한 파일과 외부 공유 플랫폼의 재캐시는 회수할 수 없으며 철회는 이후 응답을 막는다.

**Migration/테스트 파일:** `20261003171347_tier_image_export.sql`은 private 텍스트 projection helper와 회원 전용 읽기/예약 RPC, PUBLIC/anon 권한 제거·빈 search_path·현재 세션·회원별 제한을 작성했다. 새 테이블/서비스 키/의존성/lockfile 변경은 없다. `tests/unit/tier-images.test.ts`, `tests/integration/tier-image-data.test.ts`, `tier-image-routes.test.ts`는 페이지 경계·markup/control·CRC/ZIP 제한·입력/Origin/계정·hash만 전달·철회 재확인·스포일러/metadata 비노출을 작성했다. `supabase/tests/10_tier_image_export.test.sql`은 rollback fixture로 owner/admin 격리·초안/게시본 분리·미배치·현재 숨김·차단/author/session·token철회·버전·공유 제한 bucket을 작성했다. **파일 작성만 했고 실행하지 않았다.** 실제 Sharp/Pango/ZIP/한글·모바일·동시 철회/권한 테스트 결과는 없다.

**실행/검사 결과:** 소스/문서/Git 상태·diff와 설치된 Next Route Handler/ImageResponse/Metadata/output 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·공식 changelog의 PG 15.19/17.11 변경, [Sharp 텍스트](https://sharp.pixelplumbing.com/api-constructor/)·composite 및 공식 Pretendard 배포/라이선스를 읽었다. CLI 도움말 읽기/빈 migration 파일 생성과 허가된 공식 폰트 가져오기만 실행했으며 DB/앱 실행 검증이 아니다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 검수는 **모두 미실행**, 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/역할·키 등록도 하지 않았다.

**Git/다음 단계:** 최신 origin/develop fetch/fast-forward 기준 갱신과 새 기능 브랜치 생성/전환은 개발 요청의 기본 승인을 따랐다. stage·commit·push·통합 merge·PR는 하지 않았다. 실제 DB/Auth 공동 연결과 migration·생성 타입·배포 폰트 tracing·PNG/ZIP/한글/모바일·외부 OG 갱신 검수가 대기다. 비회원 PNG의 신뢰된 token/IP/HMAC 제한과 OG/전체 익명 경로의 edge 제한·인프라 token 로그 redaction은 후속이다. 다음 P4 기능은 기본 평가 가져오기/명시적 반영이며 인기/테마·소셜·대표 티어·이미지 권리별 승인 표지 선택, P5~P7과 기존 실행 검증도 남아 있다.

### 2026-10-04 · P4 내 기본 티어 가져오기·명시적 반영 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-11과 RATE-02, LIB-01/03, TIER-05의 개인 평가·저장 경계를 작성했다. P4 완료나 실제 DB/사용자 흐름 통과로 표시하지 않는다.

**변경:** 저장 완료된 편집기→owner `/tiers/[id]/evaluations`→방향/24개 후보 선택→서버 변경 미리보기→확인 동의→적용 코드를 작성했다. canonical 코드가 없는 행을 이름/색상으로 추정하지 않고 unavailable/미배치/사용자 행/대응 행 없음/이미 동일 값의 제외 사유를 표시한다. 가져오기는 대응 행 끝으로 이동/추가하고 다른 배치 순서를 보존한다. apply는 기존 별점·상태·두 공개 범위·메모/진행/태그를 유지하고 canonical만 변경하며 새/planned 기록의 읽기 상태는 직접 선택한다. 새 서재·평가는 private다. 기존 게시본은 양쪽 작업에서 유지하고 import의 초안 version과 apply의 서재 version을 각각 갱신한다.

**파일/migration:** `evaluation-model/data/actions`, `evaluation-panel`, owner page, 편집기 링크·Stitch CSS·수기 DB 계약을 작성했다. CLI가 생성한 `20261003182649_tier_canonical_evaluations.sql`은 owner/RLS 기존 경계·직접 권한 제거·DB 검증·원자 적용/300상한·회원 rate를 사용한다. owner/선택/초안 version·별점/공개 범위·읽기 상태·서재/작품 version fingerprint를 일관된 잠금 순서 뒤 재계산해 stale preview를 거절한다. 개인 상세·token은 projection에 없고 서비스 키·localStorage·새 의존성·lockfile 변경은 없다.

**테스트 파일:** `tests/unit/tier-evaluations.test.ts`는 동의/hash/상태·중복/상한/임의 ownership·코드 주입/사용자 행·private DTO 제거를 작성했다. `tests/integration/tier-evaluation-actions.test.ts`는 mock 계정 gate/엄격 입력·RPC 인자/방향별 캐시 갱신/안전한 오류를 작성했다. `supabase/tests/11_tier_canonical_evaluations.test.sql`은 rollback fixture로 별점/공개 범위/메모 보존·새/planned 상태/비공개·부분 실패 방지·성인/미배치/사용자 행·두 방향/게시본 유지·stale 개인 기록/초안·타인 관리자·정지/세션 철회 경계를 작성했다. **파일 작성만 했고 실행하지 않았다.**

**실행/검사 결과:** 소스/문서/Git status·diff와 설치된 Next Server Actions/page/revalidatePath 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·공식 changelog의 PG 15.19/17.11 변경, [Postgres 잠금](https://www.postgresql.org/docs/17/explicit-locking.html)을 읽었다. 공식 changelog 읽기·CLI 도움말/빈 migration 파일 생성은 DB 실행 검증이 아니다. 사용자 지시로 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저 검수를 모두 미실행으로 남긴다. 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/키·역할 등록도 하지 않았다.

**Git/다음 단계:** 최신 develop fetch/fast-forward 후 새 `feature/tier-canonical-evaluations`에서 작업했으며 stage·commit·push·통합 merge·PR는 하지 않았다. 실제 Supabase/Auth 공동 연결과 migration/생성 타입 적용·가져오기/변경 동의→원자 반영→공개 통계/두 탭/권한 검수는 별도 요청 대기다. P4 인기/테마·소셜 반응/대표 티어·비회원 PNG/edge 제한·허가 표지 목적별 선택, P5~P7과 기존 P1~P4 실행 검수는 남아 있다.

**Git 반영 요청 · 2026-10-04:** 사용자가 이번 증분까지 기본 Git Flow(작업 브랜치 Conventional Commit→작업 브랜치 push→최신 develop merge→develop push→develop에서 종료)를 요청했다. 검사 실행 요청은 없으므로 기존 미실행 상태를 유지한다. 실제 Git 반영 결과는 명령 출력과 최종 보고에서 확인한다.

### 2026-10-05 · P4 공개 티어 좋아요 첫 증분 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-10의 좋아요 부분과 SOC-04의 공개 티어 반응, SOC-06 차단 및 OPS-04 회원 제한 경계를 작성했다. 인기/테마·댓글·대표 티어를 포함한 TIER-10 전체와 P4/P5 전체 완료로 표시하지 않는다.

**화면/서버 변경:** `/tiers` 목록에 실제 좋아요 수, 현재 public 상세에 좋아요·취소·현재 상태 재조회·로그인 안내를 작성했다. 자기 표·비공개·링크 공개에는 반응할 수 없다. 입력은 `id/version/liked`만 받고 현재 회원 세션으로 접근하며 목표 boolean으로 재시도 중복을 막는다. 버튼은 서버 응답 뒤에만 수/눌림을 바꾸고 처리 중 중복 요청을 막는다. 응답 유실이나 접근/버전 변경은 기존 상태를 비우고 현재 상태를 다시 읽도록 했다. 스포일러 원문·좋아요 회원 ID는 DTO에 없으며 목록은 카드별 추가 RPC 없이 기존 projection에서 수를 받는다. OG 재확인 fingerprint는 좋아요 수를 제외하고 가시성·게시 version·스포일러/본문 변경을 계속 비교한다.

**Migration/권한:** CLI가 생성한 `20261004144839_tier_likes.sql`에 첫 대상인 티어표 FK만 있는 `reactions`와 사용자/티어 unique partial index, RLS·직접 SELECT/DML 권한 제거, 현재 공개 접근/계정·차단·세션·버전/회원 rate(40회/분) 검사를 작성했다. 리뷰/글/댓글 반응 FK와 대상 하나만 허용하는 제약·RPC는 해당 도메인 후속 migration에서 확장한다. 두 사용자 사이 advisory 잠금을 좋아요와 차단 RPC가 공유하고, 차단 시 서로가 작성한 표의 상호 반응을 삭제하며 해제해도 복원하지 않는다. 제3자 표 반응은 보존하되 현재 조회자와 차단된 반응자는 그 조회자의 집계에서 제외한다. 수는 활성·현재 동의 회원의 실제 유효 행만 집계하며 익명/회원의 차단 관계에 따라 달라질 수 있다. private/unlisted 전환은 반응을 보존하지만 상태/수를 숨기고, soft delete와 회원/표의 FK hard delete는 정리한다. 서비스 키·새 의존성·lockfile 변경은 없다. 수기 DB 계약은 실제 생성 타입 검증이 아니다.

**테스트 파일:** `tests/unit/tier-likes.test.ts`, `tier-like-button.test.tsx`, `tests/integration/tier-like-actions.test.ts`에 엄격 입력·최소 DTO·계정 gate·목표 상태·서버 확인 전 수 보존·응답 유실/재조회·안전한 오류·자기/익명 읽기 전용을 작성했다. 기존 `tier-image-routes.test.ts`에는 수만 바뀐 OG 요청과 게시 version 변경을 구분하는 mock 사례를 추가했다. `supabase/tests/12_tier_likes.test.sql`은 rollback fixture로 직접 권한·중복·취소·자기 반응·public/private/unlisted·스포일러·조회자별 차단 집계·양방향 차단 정리·계정/세션·숨김/삭제·회원 제한을 작성했다. **모두 파일 작성만 했고 실행하지 않았다.** 단일 세션 SQL 파일은 동시 좋아요/차단의 잠금 동작을 입증하지 않으며 다중 세션 검수는 대기다.

**실행/검사 결과:** 소스/문서/Git status·diff와 설치된 Next Server Actions/Route Handler 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·공식 changelog의 PG 15.19/17.11 변경, [Postgres partial index](https://www.postgresql.org/docs/17/indexes-partial.html)·[잠금](https://www.postgresql.org/docs/17/explicit-locking.html)을 읽었다. 공식 changelog 읽기·CLI 도움말/빈 migration 파일 생성은 DB 실행 검증이 아니다. 사용자 지시로 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저 검수를 **모두 미실행**으로 남긴다. 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/키·역할 등록도 하지 않았다.

**Git/다음 단계:** 최신 origin/develop fetch/fast-forward 기준 갱신 뒤 새 `feature/tier-likes`에서 작업했다. stage·commit·push·통합 merge·PR는 하지 않았다. 실제 Supabase/Auth 공동 연결과 migration/생성 타입 적용·좋아요/취소/차단/권한·다중 세션·집계 성능 검수는 별도 요청 대기다. 다음은 공개 티어 인기순·테마 필터이며 댓글·팔로우·알림·대표 티어와 다른 도메인 반응은 후속이다. 비회원 PNG/token·IP 제한·OG edge 제한·허가 표지 목적별 선택, P5~P7 및 기존 P1~P4 실행 검수도 남아 있다.

**Git 반영 요청 · 2026-10-05:** 사용자가 공개 티어 좋아요 증분까지 기본 Git Flow(작업 브랜치 Conventional Commit→작업 브랜치 push→최신 develop merge→develop push→develop에서 종료)를 요청했다. 검사 실행 요청은 없으므로 모든 실행 검증의 미실행 상태를 유지한다. 실제 Git 반영 결과는 명령 출력과 최종 보고에서 확인한다.

### 2026-10-05 · P4 최근 7일 좋아요순·게시본 태그 탐색 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-10의 최신/최근 좋아요 정렬·테마 필터와 기존 SOC-04/06 반응/차단 집계 경계를 작성했다. 전체 `recent_unique_likes + 2 × recent_unique_commenters` 인기 점수·댓글·작성자 팔로우와 P4 전체 완료로 표시하지 않는다.

**작성한 변경:** `/tiers`에 최신 게시순/최근 7일 좋아요순·정확한 태그 입력·조건 초기화, 카드의 전체/최근 수 구분·실제 태그 링크, 조건을 유지하는 이전/다음·빈 페이지의 첫 페이지 복귀를 작성했다. form/태그 변경은 page=1이고 정렬/tag/page는 strict 서버 schema로 검증한다. 중복 인자·지원하지 않는 조건·reveal/token/actor/count 주입은 거절한다. 태그는 1~20 Unicode code point, 저장된 대소문자/공백까지 정확히 비교한다. private/unlisted/숨김/삭제·비활성/차단된 작성자는 후보에서 제외하며 스포일러 제목/태그는 null, 태그 필터에서는 해당 표를 제외한다. 현재 게시본만 검색하고 초안/과거 게시본/개인 태그를 사용하지 않는다. 기존 Stitch 배치/토큰과 GET 폼·dynamic/private/no-store를 유지하며 서비스 키·공유 캐시·새 의존성/lockfile 변경은 없다.

**Migration/계약:** CLI가 생성한 `20261004162937_tier_discovery.sql`은 고유 이름 `search_public_tiers(sort,tag,page)`와 기존 `list_public_tiers(page)` 최신순 호환 위임, private 총수/최근 수 공통 helper·기존 상세 집계 위임을 작성했다. 최근 구간은 transaction 시각 기준 168시간이며 미래 시각은 제외하고 idempotent true는 생성 시각을 올리지 않는다. 최근 수→게시 시각 내림차순→ID 오름차순, 최신순은 게시 시각→ID다. 출력 12개와 다음 페이지 판정 13개, 페이지 1~1000의 bounded offset이다. 최신순은 페이지 후보를 먼저 제한해 집계하고 인기순은 현재 접근 가능한 후보를 집계 후 정렬한다. 태그 JSON containment GIN partial index와 반응 시간 index·private helper/원문 직접 권한 제거·정밀 RPC grant를 작성했다. 수기 TS 계약과 index 파일은 실제 DB/타입/성능 검증이 아니다. 반응/가시성 변경 중 페이지 이동은 위치가 바뀔 수 있으며 snapshot cursor와 익명 edge 제한은 후속이다.

**테스트 파일:** `tests/unit/tier-discovery.test.ts`에 strict 인자·Unicode·literal 태그/URL 왕복·페이지 조건 유지·최소 DTO/스포일러 metadata/누락된 수 거절을 작성했다. `tests/integration/tier-discovery-data.test.ts`와 `tests/unit/tier-discovery-feed.test.tsx`는 세션 RPC의 검증된 인자·미설정·안전한 오류·목록/폼/태그/페이지 링크·전체/최근 수 구분·스포일러 일반 카드/빈 상태를 mock으로 작성했다. `supabase/tests/13_tier_discovery.test.sql`은 rollback fixture로 최근 168시간 경계/옛·미래 반응·중복 true/취소 후 새 반응·자기/정지 제외·동률/12개 페이지·literal/스포일러/초안/옛 게시본 태그·공개/운영/차단/동의/삭제·legacy 위임·권한을 작성했다. **파일만 작성했고 모두 실행하지 않았다.** 실제 DB·다중 세션·query plan·대량 집계·브라우저/접근성 검수 근거는 없다.

**실행/검사 결과:** Git status/diff·소스/문서/설치된 버전 메타데이터와 Next page/searchParams 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·[공식 changelog](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [Postgres JSON containment/index](https://www.postgresql.org/docs/17/datatype-json.html)·[CTE materialization](https://www.postgresql.org/docs/17/queries-with.html)을 읽었다. 공식 changelog 가져오기·CLI 도움말/빈 migration 생성만 수행했으며 DB 실행 검증이 아니다. 사용자 지시로 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저 검수를 **모두 미실행**으로 남긴다. 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/키·역할 등록도 하지 않았다.

**Git/다음 단계:** 최신 origin/develop fetch/fast-forward 후 새 `feature/tier-discovery`에서 개발했다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 하지 않았다. 실제 Supabase/Auth 공동 연결·migration/생성 타입과 요청된 최근순/태그/권한/페이지/성능 검수는 대기다. 다음은 대표 티어표 지정·현재 공개 프로필 표시이며 댓글 가중 인기·댓글/팔로우/알림·다른 대상 반응, 비회원 PNG/token·IP/OG edge 제한·허가 표지 목적별 선택과 P5~P7 및 기존 실행 검수도 남아 있다.

**Git 반영 요청 · 2026-10-05:** 사용자가 공개 티어 탐색 증분까지 기본 Git Flow(작업 브랜치 Conventional Commit→작업 브랜치 push→최신 develop merge→develop push→develop에서 종료)를 요청했다. 검사 실행 요청은 없으므로 모든 실행 검증의 미실행 상태를 유지한다. 실제 Git 반영 결과는 명령 출력과 최종 보고에서 확인한다.

### 2026-10-05 · P4 대표 티어표 지정·공개 프로필 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. SOC-01의 대표 표와 TIER-07/12의 공개 철회, 기존 SOC-06/OPS-01 경계를 작성했다. P4/P5나 SOC-01 전체 완료로 체크하지 않는다.

**변경:** 게시·공유 화면에서 본인의 현재 전체 공개 표를 대표 지정/교체/해제하고 내 티어표 목록에서 현재 대표 관리/해제한다. 공개 프로필은 현재 게시본의 제한된 카드만 읽으며 스포일러 제목/태그는 일반 안내, 없는/현재 접근 불가능한 표는 빈 상태다. 현재 작성자 활성/동의/차단·가시성·운영 상태를 DB에서 재확인한다. 처리는 서버 응답 이후에만 성공으로 표시하며 중복 제출·버전 충돌/응답 유실 시 새 서버 상태 재조회 경로를 작성했다. `/u/*` private/no-store와 관련 게시/철회/운영/삭제 action의 프로필 cache 무효화를 추가했다. 서비스 키·가짜 자료·새 의존성은 없다.

**Migration/권한:** CLI가 생성한 `20261004171418_featured_tier_profile.sql`에 nullable featured FK/JS safe integer 대표 revision·index·owner 조회/변경·현재 public 카드 RPC를 작성했다. 기존 profile 열만 직접 SELECT 가능하고 새 포인터/revision은 RPC 전용이다. setter는 회원 세션/계정과 소유권·현재 public·대상 lifecycle·대표 revision·20회/분을 검사한다. tier→profile 잠금 순서와 변경 시에만 revision 증가로 두 화면/ABA를 처리한다. private/unlisted/숨김/soft delete trigger는 같은 transaction에서 대표를 해제하고 hard delete FK SET NULL도 revision을 올린다. 재공개/운영 복구는 지정을 복원하지 않는다. 현재 공개 게시본 업데이트는 대표를 유지한다. DTO에는 본문/초안/옛 게시본/token/개인 기록/대표 revision을 넣지 않는다.

**테스트 파일:** `tier-featured.test.ts`, `tier-featured-ui.test.tsx`, `tier-featured-actions.test.ts`에 strict 입력·separate revision·계정 gate·최소 DTO·미설정/오류·중복 요청/서버 확인/충돌·공개 조건/스포일러 카드를 작성했다. `supabase/tests/14_featured_tier_profile.test.sql`은 rollback fixture로 직접 권한·본인/다른 소유자·idempotence/교체/ABA·현재 게시본·스포일러·차단/비활성·실제 철회/unlisted 게시/운영 hide/restore/삭제 RPC·FK hard delete·실제 세션 철회 경계를 작성했다. **모두 파일만 작성했고 실행하지 않았다.** 단일 세션 fixture는 select/철회/운영/삭제 경합이나 다중 탭의 실제 잠금 동작을 입증하지 않는다.

**실행/외부 상태:** Git status/diff·소스/문서·설치 버전 메타데이터와 Next use-server/page 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·[열 권한](https://supabase.com/docs/guides/database/postgres/column-level-security)·공식 changelog, [PG FK](https://www.postgresql.org/docs/17/ddl-constraints.html)·[trigger](https://www.postgresql.org/docs/17/sql-createtrigger.html)를 읽었다. changelog 가져오기와 CLI 도움말/빈 migration 생성은 DB 실행 검증이 아니다. 사용자 지시대로 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저 검수를 **전부 미실행**으로 남긴다. 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성/역할·키 등록도 하지 않았다. 실제 Supabase/Auth·migration·생성 타입·권한/경합/성능/캐시/화면 검수는 공동 작업·별도 요청 대기다.

**Git/다음 단계:** 탐색 feature `b1b20dc`와 develop merge `170e1e0` push 후 최신 develop fetch/fast-forward에서 새 `feature/featured-tier`를 생성했다. 개발 보고 시점에는 stage·commit·push·통합 merge·PR를 수행하지 않았다. 다음은 공개 티어표 댓글·답글과 신고/차단 연동이다. 댓글 가중 인기·팔로우/피드/알림·다른 도메인 반응, P4 비회원 PNG/edge 제한·허가 표지 목적별 선택 및 P5~P7·기존 실행 검수도 남아 있다.

**Git 반영 요청 · 2026-10-05:** 사용자가 대표 티어표 증분까지 기본 Git Flow(작업 브랜치 Conventional Commit→작업 브랜치 push→최신 develop merge→develop push→develop에서 종료)를 요청했다. 검사 실행 요청은 없으므로 모든 실행 검증의 미실행 상태를 유지한다. 실제 Git 반영 결과는 명령 출력과 최종 보고에서 확인한다.

### 2026-10-05 · P4/P5 공개 티어 댓글·한 단계 답글/신고·운영 (작성·실행 미검증)

**상태/요구사항:** 진행/외부설정대기. TIER-10 댓글, SOC-06 접촉 제한, OPS-01/04 신고·조치/회원 제한의 첫 tier 댓글 도메인 코드를 작성했다. P5를 첫 댓글 도메인 진행으로 갱신하며 P4/P5 및 관련 전체 요구사항은 완료로 체크하지 않는다. 최근 7일 좋아요순은 유지하고 댓글 가중 전체 인기 점수는 다음 증분이다.

**변경 파일/동작:** `src/lib/comments/{model,data,actions,errors}.ts`, 수기 DB 계약과 `src/components/comments/*`에 strict 입력/제한 DTO·세션 RPC·평문·최초 spoiler 제외·명시 펼치기·본인 editor/수정/삭제·신고/차단 UI를 작성했다. 공개 상세 `publication-detail.tsx`에 first 20 roots/작성/전체 페이지 링크, `/tiers/[id]/comments`에 parent/page 검증·한 단계 답글/현재 실제 replyCount·20개 페이지를 연결했다. 댓글 최신순/답글 작성순·ID 동률이며 pagination은 parent를 유지한다. `/me/comment-reports`, `/admin/comment-reports`, `/admin/comments/[id]`와 기존 티어 신고 화면의 진입 링크·댓글 fieldset 스타일을 작성했다. private/unlisted 표에는 토론을 제공하지 않으며 로그인/이메일·활성/현재 동의가 필요한 작성 안내를 연결했다. 응답 유실 시 입력과 UUID를 유지해 동일 내용만 재시도하며 ACK 후 입력/목록을 갱신한다. 새 의존성·가짜 운영 수/서비스 키·공유 캐시는 없다.

**Migration/권한:** CLI 생성 `20261005052840_tier_comments.sql`에 첫 tier FK comments·same-target parent composite FK/한 단계·immutable id/tier/parent/ownership trigger·본문/삭제 CHECK·독립 safe version·root/reply/author index·RLS/원시 ACL 제거를 작성했다. private pending 신고 unique/큐·owner/target index와 body 없는 운영 감사, public read와 회원/역할별 제한 RPC grant를 작성했다. current access→정렬 actor/상대 pair mutex→tier SHARE→root SHARE→comment UPDATE로 차단/공개/편집을 직렬화하고 tier 잠금 뒤 접근을 재확인한다. 생성 request UUID/동일 내용 재시도·별도 tier lifecycle/comment version·작성/수정/삭제 각각 30회/5분·신고 5회/10분·운영 30회/분·5초 statement 제한을 작성했다. 실시간 DB 잠금/성능 동작은 미검증이다.

**공개/삭제/운영 경계:** 효과적인 spoiler는 현재 tier OR root OR comment이며 initial public/운영 DTO에 spoiler 원문이 없다. 일반 reveal/owner editor/쓰기/신고는 현재 공개·계정/차단·소유권·버전을 검사한다. 원 댓글 hide/접근 불가는 스레드를 함께 제외한다. 삭제는 body와 공개 author를 제거하되 기존 답글 문맥을 유지하고 새 replies는 거절한다. 차단은 댓글을 보존한다. 본인 삭제만 부모가 private/hidden으로 바뀌어도 가능하며 body/부모 metadata를 반환하지 않는다. profile FK SET NULL도 본문을 지우고 version을 올린다. 운영 최초 body=null, explicit reveal은 tier/comment SHARE·역할·기대 version과 현재 public 부모를 확인한다. private/unlisted/deleted 원문을 운영자에게도 반환하지 않는다. hide/restore/선택 pending 신고 처리·기각/사유/결과·감사는 한 transaction이며 복구는 삭제 본문을 되살리지 않는다. 리뷰/글 대상 FK/num_nonnulls 확장은 각 도메인 후속이다. hard tier delete는 남은 신고 FK 보존으로 제한되므로 P7 탈퇴/정리 worker의 최소 신고 보관·참조 정리 순서를 완성해야 한다.

**테스트 파일:** `tests/unit/tier-comments.test.ts`에 Unicode/strict actor/token/동의/버전·spoiler/tombstone·depth/page/동일 target·운영 마스킹/결과 계약을 작성했다. `tests/integration/tier-comment-actions.test.ts`에 account/role gate·request ID/별도 버전 RPC·safe errors/실패 시 미무효화·owner editor/anon reveal·masked DAL·own vs role queue를 mock으로 작성했다. `tests/unit/tier-comment-ui.test.tsx`는 입력/스포일러 선택 보존·동일 nonce 재시도·중복 pending/ACK·수정 충돌 뒤 입력 보존·spoiler gate/버전 변경 재마스킹·이스케이프·tombstone reply 링크를 작성했다. `supabase/tests/15_tier_comments.test.sql`은 rollback fixture로 ACL/공개 유형·UUID retry/depth/same target/reparent·spoiler 상속/버전·self report/중복/역할·hide/restore/감사·owner edit/delete/tombstone·차단/withdraw/본인 삭제·FK 익명화/본문 제거·실제 세션 철회를 작성했다. **파일만 작성했고 모든 테스트는 실행하지 않았다.** 단일 세션 fixture는 차단 vs 댓글/공개 철회 vs reveal/edit/root 삭제 vs reply/역할·계정 전환의 실제 다중 세션 잠금이나 브라우저 상태를 증명하지 않는다.

**실행/외부 상태:** Git status/diff와 소스/문서·설치 버전 metadata, 로컬 Next Server Actions 안내, [Supabase 함수](https://supabase.com/docs/guides/database/functions)·공식 changelog, [PG explicit locks](https://www.postgresql.org/docs/17/explicit-locking.html)·[FK constraints](https://www.postgresql.org/docs/17/ddl-constraints.html)를 읽었다. changelog 가져오기와 CLI 도움말/빈 migration 파일 생성만 수행했으며 DB 실행 검증이 아니다. 사용자 지시로 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저 수동/자동 검수를 **모두 미실행**으로 남긴다. 실제 확인한 사용자 흐름은 **없음**이다. DB 시작/reset/연결/SQL 실행/migration 적용/타입 생성·역할/키 등록도 수행하지 않았다. 실제 Supabase/Auth·메일·OAuth 공동 연결·순차 migration·생성 타입·권한/경합/캐시/성능/화면 검수는 공동 작업·별도 요청 대기다.

**입력 보존 보완:** [React 공식 form 안내](https://react.dev/reference/react-dom/components/form)와 설치 React DOM 소스에서 함수 action의 uncontrolled form reset 경로를 읽었다. 실패 결과도 함수가 정상 반환하므로 작성의 spoiler/confirm과 수정/신고/운영 사유·선택값을 controlled state로 유지하도록 작성했다. 오류/응답 유실 후 본문·선택값 유지 사례를 테스트 파일에 추가했지만 실제 재현/실행 검증은 하지 않았다.

**Git/다음 단계:** 대표 티어표 feature `ef68275`와 develop merge `86d8eed`가 push된 최신 develop을 fetch/fast-forward 후 새 `feature/tier-comments`에서 개발했다. 개발 보고 시점에는 이번 증분 stage·commit·push·통합 merge·PR를 하지 않았다. 다음은 공개 티어 탐색의 최근 서로 다른 댓글 작성자 수와 댓글 가중 인기 공식이다. 팔로우/피드/알림·커뮤니티·리뷰/글 댓글·댓글 좋아요/다른 반응, P4 비회원 PNG/edge 제한·허가 표지 목적별 선택, P6/P7과 기존 실행 검수는 후속이다.

**Git 반영 요청 · 2026-10-06:** 사용자가 공개 티어 댓글·답글 증분까지 기본 Git Flow(작업 브랜치 Conventional Commit→작업 브랜치 push→최신 develop merge→develop push→develop에서 종료)를 요청했다. 검사 실행 요청은 없으므로 테스트/자동 검사/브라우저/DB 실행 검증의 미실행 상태를 유지한다. 실제 Git 반영 결과는 명령 출력과 최종 보고에서 확인한다.

## 17. 요구사항 추적표

아래 표는 기능 누락 점검용이다. 체크는 해당 기능의 실제 구현과 테스트가 확인된 경우에만 표시한다. 각 단계의 완료는 이후 단계 회귀 검수도 필요하다.

| 완료 | ID | 기능 | 최종 책임 단계 |
|---|---|---|---|
| [ ] | AUTH-01 | 이메일/비밀번호 회원가입 | P1 |
| [ ] | AUTH-02 | 이메일 인증과 재발송 | P1 |
| [ ] | AUTH-03 | 로그인/로그아웃과 세션 유지 | P1 |
| [ ] | AUTH-04 | 비밀번호 찾기와 재설정 | P1 |
| [ ] | AUTH-05 | Google과 Kakao OAuth | P1 |
| [ ] | AUTH-06 | 온보딩 | P1 |
| [ ] | AUTH-07 | 프로필/계정 설정 | P1 |
| [ ] | AUTH-08 | 계정 탈퇴 | P7 |
| [ ] | AUTH-09 | 내 데이터 내보내기 | P7 |
| [ ] | AUTH-10 | 동의와 접근 통제 | P1 |
| [ ] | CAT-01 | 플랫폼 통합 카탈로그 | P2 |
| [ ] | CAT-02 | 작품 검색 | P2 |
| [ ] | CAT-03 | 필터/정렬 | P2 |
| [ ] | CAT-04 | 작품 상세 | P2 |
| [ ] | CAT-05 | 관리자 수동 등록 | P2 |
| [ ] | CAT-06 | 작품 추가/정보 수정 제보 | P2 |
| [ ] | CAT-07 | 표지와 권리 관리 | P2 |
| [ ] | CAT-08 | 데이터 품질 | P2 |
| [ ] | LIB-01 | 서재 추가/삭제 | P3 |
| [ ] | LIB-02 | 읽기 상태 | P3 |
| [ ] | LIB-03 | 개인 진행 기록 | P3 |
| [ ] | LIB-04 | 서재 검색/필터/정렬 | P3 |
| [ ] | LIB-05 | 개인 태그 | P3 |
| [ ] | LIB-06 | 공개 범위 | P3 |
| [ ] | LIB-07 | 다른 사람의 작품 저장 | P3 |
| [ ] | RATE-01 | 별점 | P3 |
| [ ] | RATE-02 | 개인 기본 티어 | P3 |
| [ ] | RATE-03 | 평가 일관성 | P3 |
| [ ] | RATE-04 | 독서 통계 | P3 |
| [ ] | REV-01 | 작품 리뷰 작성/수정/삭제 | P3 |
| [ ] | REV-02 | 스포일러 | P3 |
| [ ] | REV-03 | 리뷰 정렬/상세 | P3 |
| [ ] | REV-04 | 반응과 토론 | P5 |
| [ ] | COM-01 | 커뮤니티 글 | P5 |
| [ ] | COM-02 | 글에 작품 연결 | P5 |
| [ ] | COM-03 | 글 탐색 | P5 |
| [ ] | COM-04 | 글 관리 | P5 |
| [ ] | TIER-01 | 여러 티어표 | P4 |
| [ ] | TIER-02 | 작품 추가 | P4 |
| [ ] | TIER-03 | 편집 | P4 |
| [ ] | TIER-04 | 행 구성 | P4 |
| [ ] | TIER-05 | 저장 | P4 |
| [ ] | TIER-06 | 편집 보조 | P4 |
| [ ] | TIER-07 | 공개 | P4 |
| [ ] | TIER-08 | 공유 | P4 |
| [ ] | TIER-09 | 이미지 저장 | P4 |
| [ ] | TIER-10 | 탐색과 반응 | P4 |
| [ ] | TIER-11 | 개인 평가 연결 | P4 |
| [ ] | TIER-12 | 공개 철회 | P4 |
| [ ] | SOC-01 | 공개 프로필 | P3 |
| [ ] | SOC-02 | 팔로우/해제 | P5 |
| [ ] | SOC-03 | 팔로잉 피드 | P5 |
| [ ] | SOC-04 | 좋아요 | P5 |
| [ ] | SOC-05 | 알림 | P5 |
| [ ] | SOC-06 | 사용자 차단 | P5 |
| [ ] | DISC-01 | 취향 비교 | P6 |
| [ ] | DISC-02 | 취향 분석 | P6 |
| [ ] | DISC-03 | 작품 추천 | P6 |
| [ ] | DISC-04 | 순위 | P6 |
| [ ] | DISC-05 | 신뢰성 | P6 |
| [ ] | OPS-01 | 신고와 조치 | P7 |
| [ ] | OPS-02 | 운영자 화면 | P7 |
| [ ] | OPS-03 | 권리 철회 | P2 |
| [ ] | OPS-04 | 부정 이용 제한 | P7 |
| [ ] | OPS-05 | 접근성/반응형 | P7 |
| [ ] | OPS-06 | 개인정보와 보안 | P7 |
| [ ] | OPS-07 | SEO | P2 |
| [ ] | OPS-08 | 관측과 운영 | P7 |

### 2026-10-07 · 아이디 인증·공유 Supabase 객체 분리 (코드·DB 설치, 실행 검수 대기)

**요구사항:** AUTH-01/03/06/07/10. AUTH-02/04의 연락 이메일·비로그인 복구와 OAuth/SMTP 공동 설정은 후속이며 P1 전체 완료로 체크하지 않는다.

**변경:** 최신 develop fetch/fast-forward 후 `feature/username-auth-shared-supabase`에서 이메일 입력/인증 없는 아이디·비밀번호 가입/로그인, 필수 동의, 자동 로그인·실패 시 로그인 화면 복구, 프로필/기본 비공개 설정을 작성했다. Supabase SSR 사용자 세션과 getUser/getClaims/실제 session_id·회원 상태·동의 게이트를 사용한다. 서버 전용 admin createUser(email_confirm:true)와 server-owned app_metadata를 조건부 Auth insert/update trigger가 확인해 앱 회원/설정/동의를 같은 transaction 안에 만든다. 다른 앱 Auth 사용자 전체 backfill/자동 toon 회원 생성은 없다. 아이디 계정은 내부 식별자를 연락 이메일로 표시/메일 발송하지 않고 현재 비밀번호를 동일 사용자로 다시 검증해 변경한다. 메일 없는 비로그인 복구는 준비 상태이며 OAuth는 verified identity의 본인 pending enroll을 사용한다.

SDK/수기 DB 계약/SQL와 관련 fixture의 테이블·RPC·enum·index는 toon_, 내부 schema는 toon_private, bucket은 toon_avatars/toon_licensed_covers, cookie는 toon-sb-…로 분리했다. 공용 public CREATE/default privileges는 변경하지 않는다. 제공된 키는 ignored .env.local(0600)에 보관하고 개발 가입 플래그를 열었다. .env.example은 빈 예시이며 modern publishable/secret과 legacy anon/service_role 이름을 지원한다. 의존성과 lockfile은 변경하지 않았다.

**실제 대상·사전 조회:** 사용자 선택은 `zwzncrdlqnthxgdvsqxq`이며 reload 후 MCP get_project_url이 해당 주소를 반환했다. 기존 여행 앱 public 테이블 6개·migration 12개·trip-covers private bucket과 Storage 정책/ACL/extension 위치, Auth insert 트리거·profiles 컬럼/정책을 읽었다. toon_ 객체/type/function과 toon_private schema는 없어 새 설치가 가능했다. 기존 private.create_profile_for_auth_user()/auth_user_creates_profile은 모든 새 공유 Auth 사용자에 기본 여행 프로필 행을 만든다. 이 기존 동작은 유지하며 ToonShelf 회원/동의/역할은 별도 앱 데이터로 검사한다. 외부 Auth hook/공급자/메일 설정은 조회하지 않았다. 이전 mwepkrdlvdreoojrqegr 고객센터 프로젝트는 read-only 조회만 했고 해당 전용 수정 후보는 제거했으며 적용하지 않았다.

**DB 작업 결과:** 17개 supabase/migrations SQL source의 바깥 begin/commit을 한 트랜잭션으로 묶어 MCP apply_migration(name=toon_shared_project_username_auth)으로 실행했다. 최초 시도는 카탈로그 creators_read의 creators.id 미변환 참조로 42P01 오류가 났다. 재개를 위한 table inventory에는 기존 여행 테이블만 남아 있었다. 해당 참조를 toon_creators.id로 수정한 뒤 재적용은 success:true를 반환했다. ToonShelf 테이블/RLS/RPC·조건부 Auth 트리거, toon_avatars/ toon_licensed_covers bucket과 제한 정책, 카탈로그용 pg_trgm을 설치했다. 기본 장르 12개와 플랫폼 7개는 실제 분류이며 합성 사용자/작품 seed나 실제 Auth 사용자 생성은 하지 않았다. 기존 여행 테이블/데이터/정책/함수와 공용 Auth 설정도 변경하지 않았다.

**Migration 이력 경계:** 원격 MCP 설치 이력은 toon_shared_project_username_auth 한 건으로, 로컬 17개 파일의 timestamp version과 일치하는 CLI 배포 이력이 아니다. 원래 여행 앱 migration 이력은 이 repo에 포함되지 않는다. 이 공유 프로젝트에 linked CLI push/reset/전체 seed를 실행하지 않는다. 적용된 설치 source의 후속 스키마 변경은 새 migration으로 작성하고 MCP로 ToonShelf 변경만 적용한다.

**작성한 검사 파일:** username action의 동의/가입 플래그/제한/중복/자동 로그인 실패/외부 이메일 거절/메일 차단/현재 비밀번호·동일 사용자, env legacy 공개 키 경계, SSR cookie, SQL 16번의 다른 앱/사용자 metadata 미등록·Auth 생성 순서·동의/기본 privacy/일반 역할/정지 보존/제한/본인 enroll을 작성했다. 카탈로그 SQL fixture에 공개 작품 작가 열람과 숨김 작품 작가 제외도 추가했다. 파일 작성만 했으며 실행하지 않았다.

**실행 검증·Git:** 사용자 요청이 없어 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·브라우저 수동/자동·DB 권한 검수·실제 타입 생성 전부 미실행이다. 실제 가입→로그인→저장/로그아웃이나 비밀번호 변경 흐름을 확인했다고 보고하지 않는다. MCP 설치 성공은 권한/사용자 흐름 테스트 통과를 뜻하지 않는다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 하지 않았다. 2026-10-07 사용자가 기본 Git Flow(작업 브랜치 commit/push→최신 develop merge/push→develop 종료)를 요청했다. 검사 실행 허가는 포함되지 않았으며 실제 반영 결과는 Git 이력으로 확인한다.

**외부 대기·다음 단계:** 사용자 검사 요청 시 실제 가입·로그인·로그아웃·현재 비밀번호 변경과 A/B/anon 권한, cookie 갱신, 기존 여행 앱과의 공유 Auth 영향, 타입 생성과 필요한 자동 검사를 진행한다. 외부 Auth hook/공급자·운영 키/도메인/CAPTCHA·IP 제한 설정은 별도 확인이 남아 있다. P7 탈퇴/export는 공유 Auth 삭제가 다른 앱 데이터/세션에도 영향을 줄 수 있음을 고려해야 하며 앱 회원 삭제와 Auth 사용자 삭제를 구분해 설계한다. 연락 이메일/비로그인 복구·P1 검수와 P3~P7 잔여 기능은 후속이다.

### 2026-10-07 · 상단 요일별 웹툰 메뉴 정리 (코드 작성, 실행 검수 대기)

**관련 요구사항:** CAT-03. 요일별 작품 탐색은 홈의 요일 선택과 작품 탐색의 기존 필터로 제공한다.

**변경:** 홈의 `/#weekdays` 영역으로만 이동하던 데스크톱 상단 `요일별 웹툰` 메뉴를 제거했다. 홈의 요일 선택과 `/explore?day=0`~`6` 링크, 작품 탐색 필터와 모바일 메뉴는 유지했다. 탐색 구조 문서를 현재 메뉴 구성에 맞췄다.

**검사·실제 사용자 흐름:** 메뉴 배열과 홈 링크·탐색 소스를 읽고 변경 diff를 검토했다. 사용자 지시에 따라 테스트·lint·typecheck·build·React Doctor 및 브라우저 실행 검수는 모두 미실행이며 실제 화면·사용자 흐름을 확인한 상태는 아니다. DB·외부 설정 변경은 없다.

**Git·다음 단계:** 인증 변경은 feature `5a774c2`와 develop merge `11d13d2`로 push하고 develop에서 종료했다. 이번 수정은 최신 origin/develop fetch/fast-forward 후 새 `fix/remove-weekday-menu`에서 작성했다. 개발 보고 시점에는 이번 작업의 commit·push·통합 merge·PR를 수행하지 않았다. 2026-10-07 사용자가 메뉴 수정과 티어 인기순에 기본 Git Flow를 요청했다. 두 작업은 각각의 작업 브랜치에 분리 커밋·push 후 최신 develop에 merge·push하고 develop에서 종료하며 실제 결과는 Git 이력으로 확인한다. 실행 검수는 사용자 요청 시 진행하며 P1 검수와 기존 후속 범위는 계속 대기다.

### 2026-10-07 · 공개 티어 댓글 가중 인기순 (코드·추가 DB 반영, 실행 검수 대기)

**상태·요구사항:** 진행/실행검수대기. TIER-10의 인기 정렬과 SOC-06 차단·OPS-04 자기/비활성 반응 제외 경계를 작성했다. 팔로우 및 전체 P4/P5 완료로 체크하지 않는다.

**변경:** `sort=popular`를 최근 168시간 유효 좋아요 수 + 서로 다른 댓글 참여자 수 × 2로 정렬한다. 같은 사용자의 원 댓글·답글은 한 명이고 생성 시각만 기간 판단에 사용한다. 자기·삭제·숨김·익명화·정지/미확인/동의 변경, 작성자/조회자 차단과 숨김/차단 원 댓글 아래 답글을 제외한다. 삭제된 원 댓글의 살아 있는 공개 답글은 기존 토론 규칙대로 유지한다. 동점은 게시 시각 내림차순→ID 오름차순이며 최신순·literal 태그·12개 페이지와 스포일러 메타데이터 경계는 그대로다.

UI 정렬명을 `최근 7일 인기순`으로 바꾸고 최근 좋아요·댓글 참여자 수·인기 점수와 계산 기준을 표시한다. 탐색 전용 DTO가 안전한 정수·최근 좋아요 상한·실제 점수 공식의 일치를 요구한다. 대표 티어 조회는 기존 카드 계약을 유지해 새 탐색 수치를 요구하지 않는다. API 입력/기존 최신 목록 RPC·의존성·lockfile·공용 권한/default privileges는 변경하지 않았다.

**DB·MCP 작업:** 설치된 CLI 2.119.0의 help를 읽고 `migration new tier_comment_popularity`로 `20261007070457_tier_comment_popularity.sql`을 생성했다. MCP 대상 URL이 `zwzncrdlqnthxgdvsqxq`임을 확인하고 댓글/반응/티어 컬럼·index·기존 함수 정의/ACL을 read-only로 읽었다. 기존 17개 baseline을 수정/재실행하지 않고 이번 새 migration만 `apply_migration(name=toon_tier_comment_popularity)`으로 추가 적용했으며 도구가 success:true를 반환했다. Toon 댓글 부분 index와 private 집계/카드 helper, 기존 공개 검색 RPC만 변경했다. 사용자·작품/댓글 fixture 생성이나 기존 여행 앱 객체/설정 변경은 하지 않았다. MCP/CLI migration version 경계와 shared linked CLI push/reset/전체 seed 금지는 유지한다.

**작성한 검사 파일·실행 결과:** SQL 17번에 중복 원 댓글/답글·자기·삭제·숨김·미확인/정지/동의·부모 토론·현재 차단·정확한 168시간 경계·수정/미래 시각·동점/페이지/태그·스포일러/원문·반응자 비노출 fixture를 작성했다. 단위/DAL/UI 파일에는 필수 계산값/잘못된 점수 거절·실제 0·조건 보존과 대표 티어 계약 분리를 작성했다. 소스/diff·공식 Supabase 변경 기록/함수 문서를 읽었으며 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·부하 검수는 전부 미실행이다. MCP migration 적용 성공을 계산/권한/사용자 흐름 테스트 통과라고 보고하지 않는다. 실제 확인한 사용자 흐름은 없다.

**Git·다음 단계:** `fix/remove-weekday-menu`의 미커밋 메뉴/문서 변경을 보존하며 최신 origin/develop fetch/fast-forward 후 새 `feature/tier-comment-popularity`에서 작성했다. 개발 보고 시점에는 stage·commit·push·통합 merge·PR를 하지 않았다. 2026-10-07 사용자가 메뉴 수정과 티어 인기순에 기본 Git Flow를 요청했으며 각 작업 브랜치의 분리 커밋/push→최신 develop merge/push→develop 종료를 따른다. 실제 반영 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 추가 DB 반영을 막는 외부 설정은 없으며 실행 검수는 별도 요청 대기다. 다음 개발은 팔로우/해제·공개 팔로워/팔로잉 목록(SOC-02)과 차단 시 관계 정리이고, 이후 팔로잉 피드·알림이다. 리뷰/커뮤니티 인기, 비회원 PNG/edge 제한과 기존 P1~P7 잔여 범위도 후속이다.

### 2026-10-07 · 팔로우·공개 팔로워/팔로잉 목록 (코드·추가 DB 반영, 실행 검수 대기)

**상태·요구사항:** 진행/실행검수대기. SOC-02 팔로우/해제·공개 관계 목록, SOC-06 차단의 관계 정리, OPS-04 팔로우 제한과 TIER-10 작성자 프로필에서의 팔로우 경로를 작성했다. 실제 검수가 없어 요구사항 체크와 P4/P5 전체 완료 표시는 유지한다.

**변경:** 프로필에 팔로우·해제/현재 인원수/목록 링크와 공개 관계 안내, `/u/[username]/followers`·`following`에 최근 관계순 20명 페이지를 추가했다. 목록·수는 양쪽 활성/인증/동의·관계 당사자 및 조회자의 현재 차단 조건을 먼저 적용한다. 같은 시각은 상대 UUID로 고정한다. 공개 이름/아이디/아바타만 반환하며 이메일/역할/개인 활동/관계 시각은 노출하지 않는다. 본인/미완료/비회원은 변경 버튼 대신 안내, pending은 버튼 잠금, 서버 확인 뒤 상태/수를 갱신한다. 응답 유실/잘못된 DTO/권한 변경은 재조회 전 변경을 막으며 다른 서버 조회 결과도 반영한다. private/공유 티어·댓글 스포일러 경계는 유지했다.

**DB·공유 프로젝트:** 설치된 CLI 2.119.0의 migration new help를 읽고 `20261007092113_user_follows.sql`을 생성했다. 기본 sandbox의 CLI telemetry 홈 쓰기는 거절돼 해당 도움말/빈 파일 생성만 승인된 실행 범위로 수행했다. MCP get_project_url이 `zwzncrdlqnthxgdvsqxq`임을 두 번 확인하고 관련 Toon 컬럼·기존 함수 정의를 read-only로 읽었다. 초기 후보의 apply_migration은 기존 차단 함수에 포함된 좋아요 삭제의 명시 승인 근거 부족이라는 자동 승인 검토로 거절됐고 DB 적용 성공 응답은 없었다. 최종 후보는 `toon_set_user_block`을 재정의하지 않고 new follows만 정리하는 BEFORE INSERT trigger로 바꿨다. 최종 `apply_migration(name=toon_user_follows)`은 success:true를 반환했다. 기존 Auth/여행 앱·17개 baseline·이전 인기 migration·공용 권한/default privileges·기존 차단/좋아요 동작은 수정/재실행하지 않았다. 새 Auth 사용자/작품/관계 fixture를 원격에 생성하지 않았다.

`toon_follows`의 composite PK/self CHECK/profile FK·양방향 페이지 index·RLS와 원본 SELECT/DML revoke, private helper의 execute revoke, 제한된 공개 조회/회원 저장 RPC를 작성했다. 저장은 owner 세션/회원→팔로우 30회/600초→기존 pair mutex→차단·대상 재확인→목표 상태를 따른다. 중복은 생성 시각/수를 바꾸지 않고 불가 대상도 본인 관계 해제만 허용해 state=null을 반환한다. blocks BEFORE INSERT는 같은 mutex로 양방향 follows를 제거하며 ON CONFLICT 재시도에서도 동작한다. 해제 후 복원은 없다. 기존 차단 RPC의 user_block 30회/60초는 보존했다. 차단 제한을 계획한 10분 30회로 통일하는 것은 별도 후속이다.

**작성한 검사 파일·실행 결과:** `tests/unit/user-follows.test.ts`, `tests/integration/user-follow-actions.test.ts`, `tests/unit/user-follow-panel.test.tsx`, local rollback용 `supabase/tests/18_user_follows.test.sql`을 작성했다. strict actor/카운터/flag·페이지 입력, 실제 0/누락·불일치 응답/비공개 필드 제거·Unicode 이름, owner 세션/RPC·재시도·재조회·상태 갱신, raw DML/직접 helper 금지·미완료/정지/미확인/동의·양쪽 차단·페이지/동점·타인 관계 보존·불가 대상 해제·직접 RPC 제한을 담았다. 이 파일들은 전부 미실행이다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·타입 생성·브라우저/DB 권한·경합/부하 검수는 실행하지 않았다. 실제 확인한 사용자 흐름은 없음이며 MCP DDL 성공을 테스트 통과로 보고하지 않는다. 소스/diff와 로컬 Next Server Actions/동적 params/revalidatePath, 공식 Supabase changelog/함수/RLS·Postgres 잠금 자료를 읽었다.

**Git·외부 대기·다음 단계:** 메뉴 fix `d9b0311`/merge `d8aa65a`, 인기 feature `99a1d5a`/merge `6138d89`를 push하고 develop에서 종료한 뒤 최신 origin/develop fetch/fast-forward 후 새 `feature/user-follows`에서 작성했다. 개발 보고 시점에는 이번 stage·commit·push·통합 merge·PR를 요청하지 않아 하지 않았다. 이후 2026-10-07 사용자의 기본 Git Flow 요청으로 feature `3dcbe92` commit/push → 최신 develop merge `e950d27`/push → 깨끗한 develop 종료를 수행했다. 검사 실행 허가는 포함되지 않아 실행 검사는 하지 않았다. DB 추가 반영의 외부 설정 대기는 없으며 실제 사용자/권한/동시성/화면 검수는 별도 요청 대기다. 사용자 인증 검수는 사용자가 나중에 직접 진행할 예정이고 규장각 API는 신청 승인 대기라 이번 범위에 포함하지 않았다. 다음은 SOC-03 팔로잉 피드(현재 공개 리뷰·티어 게시만, 비공개 활동 제외), 이후 SOC-05 알림이며 리뷰/글 댓글·커뮤니티·P4 비회원 PNG/edge 제한·P6/P7과 기존 실행 검수는 유지한다.

### 2026-10-07 · 공개 리뷰·티어 팔로잉 피드 (코드·추가 DB 반영, 실행 검수 대기)

**상태·요구사항:** 진행/실행검수대기. SOC-03의 공개 리뷰·티어 피드, SOC-06의 현재 팔로우/차단·공개 철회 노출 경계를 작성했다. 글 도메인의 게시 이벤트와 전체 SOC-03/P5 완료는 후속이며 요구사항 완료 체크는 올리지 않았다.

**변경:** `/me/feed`에 공개 리뷰와 전체 공개 티어를 섞어 `(created_at,id)` 내림차순 20개씩 조회한다. 데스크톱 메뉴/내 서재/계정 메뉴 진입점, 작성자/상세 링크, 로딩/오류/팔로우 없음/공개 게시물 없음/이전 게시물 끝을 작성했다. 다음 링크는 과거 게시물 조회이며 최신 목록 복귀를 제공한다. 조회는 현재 원본의 public/visible·미삭제·활성/확인/동의·현재 팔로우·양방향 차단과 리뷰 작품 공개/성인 게이트를 먼저 적용한다. 스포일러 발췌·티어 제목은 null이고 초안/개인 평가/메모/토큰/본문은 없다. 상세의 기존 스포일러 확인 경계를 재사용한다.

**DB:** 설치된 CLI 2.119.0의 migration new 도움말을 읽고 `20261007103840_following_feed.sql`을 생성했다. MCP URL이 선택한 `zwzncrdlqnthxgdvsqxq`임을 재확인하고 관련 toon 테이블 컬럼·기존 현재 세션/계정·가시성 helper 정의만 read-only로 읽었다. 이 SQL 하나를 MCP `apply_migration(name=toon_following_feed)`로 적용해 success:true를 받았다. `toon_activity_events`는 대상별 unique/정확히 한 대상 CHECK/profile·대상 FK cascade·페이지 index·RLS와 raw SELECT/DML revoke로 제한한다. 기존 게시 함수를 재정의하지 않고 invoker trigger가 공개 transaction 안에 원문 없는 참조만 추가한다. private/unlisted 초안은 기록하지 않고 수정/재게시 충돌은 이벤트 시각을 보존한다.

현재 공개인 기존 리뷰는 published_at, 기존 티어는 현재 공개 게시본 published_at으로 초기 참조만 추가한다. 과거 티어 visibility가 없으므로 최초 전체 공개 시각 복원·과거 비공개 이력 backfill은 하지 않는다. 이미 수신한 화면은 회수되지 않으며 이후 조회에 현재 권한을 적용한다. 기존 17개 baseline/인기/팔로우 SQL·Auth·다른 앱·공용 default privileges는 수정/재실행하지 않았고 테스트 사용자/작품을 원격에 생성하지 않았다. 이력 version이 다른 shared linked CLI push/reset/전체 seed는 계속 금지다.

**서버·갱신:** 로그인 상태/필수 동의 gate와 사용자 세션 RPC만 사용한다. DB는 직접 호출에서도 live 세션·current_active와 auth.uid()를 다시 확인하고 actor override를 받지 않는다. DTO와 cursor는 strict/제한 schema로 검사하며 UTC 소수 초 6자리와 마지막 event UUID를 보존한다. 앱 envelope는 viewer와 버전을 검사하되 DB cursor는 권한 없는 정렬 경계다. 철회된 기준 이벤트도 안전한 이전 목록 조회를 허용한다. null/누락/스포일러·중복·정렬·next/범위 오류를 성공/빈 목록으로 보정하지 않는다. dynamic/private/no-store/noindex·기존 디자인 토큰을 유지하고 새 의존성/공유 캐시/카드별 SDK 조회를 추가하지 않았다. 팔로우/차단·게시/철회/삭제/운영·작품 관리 후 피드 무효화를 연결했다.

**작성한 검사 파일·실행 결과:** `tests/unit/following-feed.test.ts`, `tests/unit/following-feed-view.test.tsx`, `tests/integration/following-feed-data.test.ts`, `supabase/tests/19_following_feed.test.sql`을 작성하고 기존 follow action의 무효화 기대값을 갱신했다. actor/reveal/중복 query 주입, 다른 회원 cursor·6자리 소수 초, 제한 DTO·스포일러·순서/중복/next/범위, empty/error 구분, first public/re-publish idempotency, 익명/만료/미확인/pending/정지·editable metadata·동의, private/unlisted/숨김/삭제/성인 작품·팔로우 해제/양방향 차단·현재 내용과 철회된 anchor·동점 페이지를 담았다. 모두 작성만 했으며 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/부하 검수는 미실행이다. 실제 확인한 사용자 흐름은 없다. DB 적용 성공은 실사용/테스트 통과가 아니다.

**근거·Git·다음:** 설치된 Next 16.3.8의 Server Component/Promise searchParams/revalidatePath 문서와 Supabase 공식 changelog/functions/RLS, Postgres partial index/cursor, React 직렬화 지침을 읽었다. 스키마 metadata와 source/diff를 읽었으며 실행 검증은 하지 않았다. 이전 팔로우 feature `3dcbe92`/develop `e950d27` push 후 깨끗한 최신 develop fetch/fast-forward를 기준으로 새 `feature/following-feed`에서 작성했다. 개발 보고 시점에는 이번 stage/commit/push/통합 merge/PR를 요청하지 않아 하지 않았다. 이후 2026-10-07 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push→최신 develop merge/push→develop 종료를 진행한다. 검사 실행 허가는 포함되지 않으며 실제 반영 결과는 Git 이력으로 확인한다. 외부 설정으로 막힌 피드 항목은 없지만 실제 사용자/권한/화면 검수는 별도 요청 대기다. 다음은 SOC-05 알림이다. 커뮤니티 글과 피드 이벤트·리뷰/글 댓글·P4 비회원 PNG/edge 제한·P6/P7 및 기존 검수 범위는 후속이며, 규장각 API는 사용자 신청 승인 후 별도 연결한다.


### 2026-10-08 · 앱 안 알림과 읽음 처리 (코드·추가 DB 반영, 실행 검수 대기)

**상태·요구사항:** 진행/실행검수대기. SOC-05의 현재 팔로우·티어 좋아요·댓글·답글·제보 처리 알림과 읽음/모두 읽음, SOC-06의 현재 노출 경계를 작성했다. 기존 설정과 수신 여부를 연결했다. 미구현 리뷰/글 반응·댓글 대상과 커뮤니티, 전체 P5 완료는 후속이다.

**변경:** `/me/notifications`의 전체/미읽음 필터·20개 커서 페이지·실제 미읽음 수·로딩/빈 상태/주소 오류/재조회·개별/모두 읽음, 상단 종과 계정 메뉴 진입, 종류별 수신 설정 안내를 작성했다. 종의 응답 오류/로딩은 가짜 0을 표시하지 않는다. 읽음 응답의 ID/cutoff를 확인한 뒤 현재 서버 상태를 불러오며 유실/오류를 성공으로 표시하지 않는다. 모두 읽음은 페이지의 readThrough 시각까지 생성된 미읽음에만 적용하고 나중 생성분은 남긴다. 고정 snapshot/commit 순서 보장은 아니며 실시간 구독 없이 다음 요청/새로고침에서 갱신한다.

댓글 알림은 `/tiers/[id]/comments/[commentId]`의 현재 공개 권한·기존 스포일러 gate를 재사용한다. 제보 알림은 `/submissions/[id]`의 사용자 세션·본인 ID 필터/RLS 상세로 연결하여 최근 50개 목록 밖에서도 접근한다. 알림에는 제목/본문/제보 원문·결과 문구를 저장하거나 내려주지 않는다. 삭제/비공개/링크 공개/숨김/차단/비활성·관계/반응 취소 때 원래 종류/작성자/대상 ID·링크도 제거한 일반 안내로 바꾼다. 이미 받은 화면은 회수할 수 없다. 원본 변경 action의 알림 경로 무효화와 읽음 후 root layout 무효화를 연결했다. 새 의존성이나 공유 캐시는 없다.

**DB 반영:** CLI 2.119.0 migration new help와 공식 changelog/functions/RLS 자료를 읽고 `20261007154622_notifications.sql`을 생성했다. MCP get_project_url로 선택한 `zwzncrdlqnthxgdvsqxq`를 확인하고 관련 Toon 컬럼/기존 가시성 helper 정의만 read-only로 읽었다. 새 SQL 하나를 MCP `apply_migration(name=toon_notifications)`으로 적용해 success:true를 받았다. `toon_notifications`의 recipient/dedupe unique·자기 알림 금지·FK·페이지/미읽음/FK index·RLS/raw revoke와 정밀 RPC grant를 작성했다. 원본 테이블의 AFTER INSERT/제보 pending 처리 전환 trigger는 invoker이며 기존 trusted mutation transaction에 참여한다. 기존 함수나 공용 Auth/여행 앱/default privileges, 기존 baseline·migration은 수정하지 않았다. 과거 이벤트 backfill·원격 테스트 사용자/작품/관계 생성도 없다.

생성은 현재 활성/확인/동의·자기 알림 제외·양방향 차단·수신 설정을 확인한다. 댓글은 source ID+recipient, 제보는 submission ID+recipient로 중복을 막는다. 답글은 원 댓글 작성자와 표 작성자에게 보내되 같으면 한 건이며 본인은 제외한다. 팔로우/좋아요는 기존 pair lock 내 직전 동일 알림부터 24시간 rolling 억제와 일자 dedupe key를 적용하며 취소/재시도/재삽입이 생성 시각·읽음 상태를 올리거나 되돌리지 않는다. 수신자 access row 잠금을 추가하지 않는다. 현재 원본/부모의 권한을 재검사하는 제한 DTO만 조회하며 raw DML/helper 직접 실행은 막았다. 본인 읽음 RPC는 auth.uid()/현재 세션·계정으로 한정하고 개별 120회/분·모두 20회/분으로 제한한다. 수기 DB 계약은 생성 타입 검증이 아니다.

**작성한 검사 파일·실행 결과:** `tests/unit/notifications.test.ts`, `tests/unit/notification-inbox.test.tsx`, `tests/integration/notification-actions-data.test.ts`, local rollback 전용 `supabase/tests/20_notifications.test.sql`을 작성하고 기존 follow/like action의 무효화 기대값을 갱신했다. cursor 계정/필터·마이크로초, actor/recipient 주입, 제한 DTO/일반 안내·순서/중복/잘못된 응답, 응답 유실·읽음 ACK, raw 권한·인증/타인 ID·자기 알림·설정·중복·답글 분배·제보 처리·cutoff 이후 미읽음 유지·비공개/차단을 담았다. 모두 작성만 했다. 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/성능 검수는 실행하지 않았다. 실제 확인한 사용자 흐름은 없으며 DDL 성공을 기능 검증으로 보고하지 않는다. 소스/diff 읽기와 설치된 Next 16.3.8의 Server Components/Promise searchParams/revalidatePath 문서만 참고했다.

**Git·다음 단계:** 이전 팔로잉 피드 feature `b634486`/develop merge `e340033` push 후 최신 develop fetch/fast-forward를 기준으로 새 `feature/notifications`에서 작성했다. 개발 보고 시점에는 commit/push 요청이 없어 stage·commit·push·통합 merge·PR를 하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 알림 DB 설치의 외부 설정 대기는 없지만 실제 Auth/권한/브라우저 흐름은 별도 요청 대기다. 다음은 커뮤니티 글의 초안/공개·스포일러/신고/운영과 피드 이벤트 연결이며 리뷰/글 댓글·다른 반응·P4 비회원 PNG/edge 제한·P6/P7 및 기존 검수 범위는 유지한다. 규장각 API는 사용자 신청 승인 후 별도 연동하고 인증 검수는 사용자가 나중에 직접 진행할 예정이다.

### 2026-10-08 · 커뮤니티 글·운영·팔로잉 피드 (코드 작성, DB 적용/실행 검수 대기)

**상태·요구사항:** 진행/외부연결대기. COM-01/02, COM-03의 최신순·주제/작품/검색, COM-04의 초안·게시·수정·공개 취소·삭제·스포일러, SOC-03 글 피드·SOC-06 차단, OPS-01/02/04 신고·운영·속도 제한 증분이다. 글 좋아요·댓글·인기순·관련 알림과 전체 P5 완료는 후속이다.

**변경:** `/community`, `/community/new`, `/posts/[id]`, `/me/posts`, `/me/posts/[id]/edit`, `/me/post-reports`, `/admin/post-reports`, `/admin/posts/[id]`를 작성했다. 데스크톱/모바일 상단과 계정/운영 메뉴를 연결했다. 네 주제, 공개 작품 검색·최대 5개 선택, 20개 페이지·빈 상태·잘못된 조건 안내를 제공한다. 글 생성은 명시적 POST이며 GET에서 DB를 만들지 않는다. 초안 수동 저장과 게시본을 분리하고 게시 시 저장본 확인·두 버전으로 충돌을 감지한다. 저장 안 된 입력 안내/브라우저 종료 경고는 있으나 앱 내부 링크 이동을 차단하는 전체 이탈 방지나 자동 저장은 없다. 사용자 글은 기존 plain text/안전 링크 렌더러로 표시한다.

스포일러 제목/본문/발췌/연결 작품은 최초 public DTO·피드·메타데이터에서 제외하고 검색어/작품 필터에도 사용하지 않는다. 명시 펼치기는 현재 공개·차단·작품·버전을 다시 확인한다. 연결 작품이 공개 불가이면 글 전체를 숨긴다. 신고는 공개 타인 글에 한하며 본인 접수/결과와 운영 큐를 분리한다. 운영자는 현재 게시본만 펼치며 private 수정 초안/공개 취소 원문을 받지 않는다. 숨김/복구/기각·선택 신고 결과·원문 없는 감사 기록은 원자 저장하도록 작성했다. 기존 차단 action에 커뮤니티 경로 무효화를 더했다.

**DB와 외부 대기:** 설치된 CLI 2.119.0의 migration new로 `20261008090225_community_posts.sql`을 생성했다. CLI 도움말은 sandbox의 `~/.supabase` 로그 쓰기 제한 뒤 승인된 재호출로 읽었으며 검사 명령은 아니다. Supabase MCP get_project_url/search_docs가 `OAuth token refresh failed: Failed to parse server response`를 반환했다. 재연결을 요청하고 독립적인 로컬 구현을 진행했다. 이번 원격 schema 조회/DDL/데이터 변경은 성공한 것이 없고, 새 migration은 **미적용**이다. 복구 후 `zwzncrdlqnthxgdvsqxq` 대상과 관련 Toon 의존 정의를 읽고 이번 파일 하나만 MCP로 추가 적용해야 한다. 공유 linked CLI push/reset/전체 seed는 금지다.

SQL은 `toon_posts`/`toon_post_works`, `toon_private.toon_post_drafts`/`toon_post_reports`/`toon_post_moderation_events`를 추가한다. 기존 리뷰 초안 guard/ACL을 바꾸지 않기 위해 글 초안을 private 전용 테이블로 분리했다. RLS/raw revoke/빈 search_path·정밀 RPC grant, auth.uid()/현재 회원/운영 역할·소유권, Unicode/JSON/UUID/개수 제한, 버전·잠금·속도 제한을 작성했다. 공개 취소는 초안을 보존하고 삭제는 본문·제목·초안·작품 연결을 지워 최소 참조/상태를 남긴다. 첫 공개 때 invoker trigger가 원문 없는 post FK 이벤트를 추가하며 unique로 수정/재게시 시각 상승을 막는다. 기존 피드 RPC는 리뷰/티어 경계를 유지하고 글 현재 권한/DTO를 추가했다. 기존 migration/baseline·공용 Auth·여행 앱·default privileges는 편집하거나 적용하지 않았다.

새 글 테이블의 존재만으로 모든 작품 병합을 막지 않도록 기존 병합 summary를 이번 migration 안에서 확장했다. 삭제되지 않은 글의 현재 작품 연결 또는 private draft가 source/target을 참조하면 병합을 거절한다. 참조 없는 작품의 기존 병합은 유지한다. 글 참조/비공개 payload를 보존하는 병합 handler와 P7 신고 FK·hard delete 보존 정리는 후속이다.

**작성한 검사 파일·실행 상태:** `tests/unit/post-model.test.ts`, `tests/unit/post-ui.test.tsx`, `tests/integration/post-actions.test.ts`, `tests/integration/post-data.test.ts`, local rollback 전용 `supabase/tests/21_community_posts.test.sql`을 작성했다. 입력/공개 길이·중복 작품·owner 주입, 저장/게시 충돌·초안 격리, spoiler DTO/검색 누출, 현재 회원/소유자/운영자, raw 권한, 신고 중복/결과·차단/작품 숨김·공개 취소·삭제, 피드 첫 공개/재게시 보존을 다룬다. 파일은 전부 미실행이며 원격 테스트 데이터는 생성하지 않았다. 테스트·lint·typecheck·build·React Doctor·advisor·env 검사·생성 타입·브라우저/DB 권한·경합/부하 검수와 실제 확인한 사용자 흐름은 **없음**이다. 소스/diff 읽기만 수행했으며 통과나 정상 동작을 주장하지 않는다.

**근거·Git·다음:** 설치된 Next 16.3.8 Server Actions 가이드와 Supabase 공식 changelog/functions/RLS, 적용한 Supabase/Postgres/React 스킬을 읽었다. 알림 반영 뒤 최신 develop `9c9834f`를 fetch/fast-forward 기준으로 새 `feature/community-posts`를 생성했다. 개발 보고 시점에는 stage·commit·push·통합 merge·PR를 요청하지 않아 수행하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 테스트/자동 검사 실행 허가는 포함되지 않는다. MCP 재연결 후 새 DB 설치가 먼저 필요하고, 다음 개발은 글 좋아요·댓글/답글·인기순·알림이다. 리뷰 반응/토론·P4 비회원 PNG/edge 제한·P6/P7 및 기존 실행 검수는 유지한다. 규장각 API 승인/표지 연동과 사용자의 인증 검수는 별도 후속이다.

### 2026-10-08 · 커뮤니티 좋아요·댓글/답글·인기순·알림 (코드 작성, DB 적용/실행 검수 대기)

**상태·요구사항:** 진행/외부연결대기. COM-03/04, SOC-04/05/06, OPS-01/02/04의 글 토론 증분이다. 기존 글에 좋아요/취소, 댓글·한 단계 답글·본인 수정/삭제, 댓글 신고/운영, 최근 7일 인기 정렬과 글 좋아요/댓글/답글 알림을 작성했다. 전체 COM/P5 완료 또는 실제 동작 확인으로 표시하지 않는다.

**변경:** `src/lib/post-comments`, `src/lib/posts/like-*`, 대응 UI, `/posts/[id]/comments`와 정확한 댓글 상세, `/me/post-comment-reports`, `/admin/post-comment-reports`, `/admin/post-comments/[id]`를 추가했다. 글 상세에서 좋아요/첫 댓글 페이지를 병렬 조회하고 기존 신고 화면·운영 메뉴를 연결했다. 목표 상태 좋아요와 DB ACK 후 UI 갱신, 댓글 생성 UUID 재시도, 본인 수정 버전 충돌·삭제 확인을 작성했다. 스포일러는 글/원 댓글/댓글 중 하나라도 해당하면 처음에 본문을 보내지 않고 명시적 펼치기로 현재 버전을 재검사한다. 삭제된 원 댓글은 본문/공개 신원 없이 기존 답글을 보존하지만 새 답글은 막는다.

`toon_search_posts`로 기존 검색/주제/작품 조건을 유지하며 인기순을 추가했다. 최근 168시간 유효 좋아요 + 서로 다른 비작성자 댓글 참여자 × 2이며 댓글/답글 중복 참여·수정/복구 시각으로 가산하지 않는다. 현재 비공개/숨김/삭제/차단/비활성 활동을 제외하고 카드에는 집계만 표시한다. 최신순은 페이지 후보를 먼저 제한하고 인기순은 현재 후보를 집계한다. 고정 snapshot/사전 집계는 아니며 페이지 이동 중 순서가 달라질 수 있다.

알림은 기존 inbox/read/preferences를 재사용하고 post_like/post_comment/post_reply와 대상 FK만 추가한다. AFTER INSERT trigger가 제목/본문 없는 참조를 원자 기록한다. 자기 알림 제외, 좋아요 24시간 억제/UTC 일자 dedupe, 댓글 source ID/수신자 중복 방지, 현재 수신 설정을 적용한다. 답글은 원 댓글 작성자와 서로 다른 글 작성자에게 전달한다. 열람 때 현재 대상/계정/차단을 다시 검사하고 볼 수 없으면 kind/actor/target까지 일반 안내로 바꾼다. 댓글 신고 결과는 본인 결과 화면에서 제공하며 별도 결과 알림은 구현하지 않았다.

**DB·외부 대기:** 설치된 CLI 2.119.0 migration new로 `20261008102414_community_discussions.sql`을 생성했다. 기존 티어 RPC/테이블을 유지하고 글 전용 `toon_post_comments`/`toon_post_reactions`, private 댓글 신고/감사를 추가한다. RLS/raw revoke/정밀 RPC grant·빈 search_path·5초 제한, 현재 회원/역할·소유권·버전, 글→부모→댓글 잠금과 정렬된 interaction pair mutex, 댓글 입력/속도 제한을 작성했다. 기존 차단 RPC를 재정의하지 않는 trigger로 글 좋아요를 함께 정리한다. 글·댓글·계정의 현재 접근을 집계/알림에도 적용한다. shared Auth·여행 앱·공용 default privileges 및 이전 baseline은 변경하지 않았다.

MCP `get_project_url`은 이번에도 `OAuth token refresh failed: Failed to parse server response`로 실패했다. **이전 `20261008090225_community_posts.sql`과 이번 `20261008102414_community_discussions.sql` 모두 원격 미적용**이며 이번 원격 schema 조회/DDL/데이터 변경 성공은 없다. 복구 후 `zwzncrdlqnthxgdvsqxq` 대상·관련 Toon 의존 정의/이력을 확인하고 글→토론 순서로 두 migration만 추가 적용한다. linked CLI push/reset/전체 seed는 금지다. 원격 테스트 사용자/작품을 생성하지 않았다.

**작성한 검사 파일·실행 상태:** 댓글 입력/스포일러 DTO/한 단계 경계, 좋아요 및 댓글 액션의 현재 회원/정확한 ACK·대상/버전, 실패 후 UI 입력/재시도, 정렬/집계 DTO와 정확한 알림 링크를 다루는 단위/action/UI 파일을 작성했다. 기존 글 카드/DAL fixture에 실제 집계 계약을 반영했고 local rollback `supabase/tests/22_community_discussions.test.sql`에 raw 권한·비활성 사용자·좋아요 중복/본인 금지·재전송 댓글/교차 부모·스포일러·신고 중복/운영·부모 숨김/삭제·인기 기간·수신 설정/알림 중복·차단/삭제/공개 취소 경계를 작성했다. **파일 작성만 했으며 실행하지 않았다.** 테스트·lint·typecheck·build·React Doctor·advisor·env·생성 타입·브라우저/DB 권한·경합/성능 검수는 전부 미실행이다. 실제 확인한 사용자 흐름도 없음이다. 소스와 diff 읽기만 수행했고 검사 통과를 주장하지 않는다.

**Git·다음 단계:** 이전 커뮤니티 글 feature `6b58df8`와 develop merge `8eb6747` push 후 깨끗한 develop에서 fetch/fast-forward 기준을 확인하고 새 `feature/community-discussions`를 생성했다. 개발 보고 시점에는 Git 반영을 하지 않았다. 이후 2026-10-08 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 테스트/자동 검사 실행 허가는 포함하지 않는다. MCP 복구 후 두 SQL 설치와 별도 요청된 검수, 다음 개발은 리뷰 좋아요/댓글·정렬/알림이다. 글 참조 작품 병합 보존 handler, 댓글 신고 FK와 공유 Auth 탈퇴 보존/비식별화, P4 비회원 PNG/edge 제한·P6/P7·기존 미검수 범위와 규장각/허가 표지 연동은 후속이다.

### 2026-10-08 · 공통 본문 높이·푸터 반응형 배치 (코드 수정, 실행 검수 대기)

**상태·요구사항:** OPS-05 반응형/P0 공통 레이아웃 수정. 사용자가 이용약관·개인정보처리방침 등 짧은 페이지에서 푸터가 화면 아래까지 내려가지 않는 현상을 보고했다. 소스에서 body에 최소 화면 높이/세로 배치가 없고 main이 남는 높이를 채우지 않는 구조를 확인했다. ThemeProvider는 별도 DOM wrapper를 만들지 않아 공통 body/main에 CSS를 적용한다.

**변경:** `src/app/globals.css`에서 body를 세로 flex와 최소 100dvh(100vh fallback)로 두고 main은 flex:1 0 auto/flow-root, 헤더·푸터는 축소되지 않도록 작성했다. 짧은 페이지는 남은 화면을 채우고 긴 페이지는 내용에 따라 문서가 늘어나도록 고정 height나 푸터 fixed 배치를 사용하지 않는다. 준비/404/오류/로딩 화면의 중복 65vh 최소 높이를 제거했다. 모바일 하단 메뉴의 기존 82px 여백은 유지하면서 더 큰 safe-area-inset-bottom을 반영한다. 768px 이상에서는 기존 Stitch 규칙이 모바일 메뉴와 여백을 제거한다. 약관·개인정보 안내 문구, 인증/DB, 의존성은 변경하지 않았다.

**실행 상태·Git·다음:** 소스/문서/diff 읽기만 수행했다. 테스트·lint·typecheck·build·React Doctor·env·브라우저 수동/자동 검수는 사용자 지시에 따라 미실행이며 실제 확인한 사용자 흐름은 없다. migration이나 테스트 파일 추가가 필요 없는 CSS 수정이다. 이전 커뮤니티 토론 feature `2a05b5f`/develop merge `6c4bfb7` push 후 최신 develop fetch/fast-forward 기준 새 `fix/responsive-page-height`에서 작성했다. 개발 보고 시점에는 Git 반영을 하지 않았다. 이후 사용자 요청에 따라 해당 수정 브랜치 commit/push → 최신 develop merge/push를 진행하며 검사 허가는 포함하지 않는다. 외부 설정으로 막힌 항목은 없으며 사용자가 검수를 요청하면 짧은 법적 안내/로그인/빈 상태, 긴 목록, 모바일 safe area와 화면 크기 변경을 확인한다. 기존 커뮤니티 migration 두 개의 MCP 적용 대기는 이번 CSS 수정과 별개로 유지한다.

### 2026-10-08 · 커뮤니티 조회 오류·DB 준비 상태 구분 (코드 수정, 원인 확정/DB 복구 대기)

**상태·요구사항:** COM-03 탐색/OPS-05 오류 상태 수정. 사용자가 커뮤니티 진입 시 `src/lib/auth/errors.ts`의 일반 INTERNAL_ERROR 발생을 보고했다. 이 위치는 원래 DB 오류를 일반 메시지로 바꾸는 지점이어서 제공된 스택만으로 실제 DB 오류 코드를 확정할 수 없다. 현재 `listPosts`는 `toon_search_posts`를 호출하며 해당 RPC를 추가하는 두 커뮤니티 migration이 적용 대기로 기록돼 있어 스키마/API 미설치가 유력하다. 이번 MCP `get_project_url`도 OAuth token refresh failed: Failed to parse server response로 실패했으며 재인증을 요청했다. 원격 schema 조회·DDL·런타임 원인 확인은 성공한 것이 없다.

**코드 변경:** `src/lib/posts/errors.ts`에서 PGRST202/PGRST205/42883/42P01을 커뮤니티 CONFIG_REQUIRED로 구분하고 `/community`에서 이 상태만 준비 안내로 처리한다. 정상 빈 목록과 구분하고 글쓰기/내 글 링크를 숨기며 검색·정렬·페이지를 보존하는 GET 다시 불러오기를 제공한다. 예상하지 못한 오류는 그대로 오류 경계로 전달한다. DB 함수/테이블 누락과 stale API schema cache를 구분할 근거 없이 화면에서 특정 원인을 단정하지 않는다. 준비 안내로 처리하는 상태는 console.error를 호출하지 않는다. 예상하지 못한 DB 오류의 서버 로그는 도메인과 형식 제한된 오류 코드만 남기며 SQL/메시지/hint/details/사용자 입력은 출력하지 않는다. 다른 도메인의 공통 계정 오류 처리나 RLS/권한은 변경하지 않았다.

**실행 상태:** 설치된 Next 오류 처리 가이드와 공식 Supabase changelog/PostgREST 오류 문서를 읽었다. `tests/integration/post-data.test.ts`에 누락 스키마 분류/로그 원문 제외를 추가하고 `tests/unit/community-page.test.tsx`에 준비 상태·재요청 조건·정상 빈 목록 복구·예상 밖 오류 전파를 작성했다. 파일 작성만 했으며 테스트·lint·typecheck·build·React Doctor·advisor·env·브라우저/실제 DB 권한 검수는 미실행이다. 앱/API 재현 요청도 실행하지 않았고 실제 확인한 사용자 흐름은 없다. UI 오류 대응을 원격 DB 복구나 커뮤니티 기능 동작 확인으로 보고하지 않는다.

**Git·보존·남은 작업:** 최신 origin/develop에서 `fix/community-loading-error`를 생성했으며 이전 `fix/responsive-page-height` 작업의 미커밋 globals.css와 UX/진행 문서 변경을 그대로 보존했다. 이번 오류 수정과 레이아웃 변경은 별도 작업이다. 개발 보고 시점에는 Git 반영을 하지 않았으며 이후 사용자 요청으로 각 수정 브랜치 commit/push → develop merge/push를 분리 진행한다. 실제 결과는 Git 이력으로 확인하고 검사 실행 허가는 포함하지 않는다. MCP 복구 후 `zwzncrdlqnthxgdvsqxq`의 Toon 의존 정의·migration 이력을 확인하고 미적용 `20261008090225_community_posts.sql` → `20261008102414_community_discussions.sql`을 순서대로 추가 적용해야 한다. 기존 baseline·공유 Auth/다른 앱·공용 default privileges는 유지하며 linked CLI push/reset/전체 seed는 금지다. 검사와 실제 흐름 확인은 별도 사용자 요청을 따른다.

**같은 작업 후속 · 처리된 오류의 콘솔 출력 수정:** 사용자가 `[posts] Community database API unavailable {}`와 `console.error` 8번 줄을 가리키는 개발 오류창을 보고했다. 이전 수정에서 준비 상태를 catch하더라도 추가한 console.error가 개발 오류 표시를 유발하는 문제였다. 예상된 CONFIG_REQUIRED 분기의 console.error를 제거하고 해당 네 오류 코드가 로그 없이 분류되는지에 대한 기존 테스트 파일의 기대값을 수정했다. 예상하지 못한 오류 전파/진단은 유지한다. 같은 `fix/community-loading-error`에서 이어갔으며 레이아웃 변경도 보존했다. 소스/diff만 읽었고 테스트·자동 검사·브라우저 검수는 미실행이다. 이번 콘솔 수정은 DB 설치 완료를 뜻하지 않으며 두 migration의 원격 적용은 MCP 인증 복구 후 진행해야 한다.

### 2026-10-08 · 이전 수정 Git Flow 완료와 리뷰 반응·토론 (코드 작성·DB/실행 검수 대기)

**Git 결과:** 기존 미커밋 레이아웃과 커뮤니티 오류 변경을 보존해 각 집중 브랜치로 분리했다. `fix/responsive-page-height`의 `eb3d7f3`을 push하고 develop `c57d80e`로 merge/push했다. `fix/community-loading-error`의 `9d87f1d`를 push하고 develop `77bec41`로 merge/push했다. 원격 refs와 깨끗한 develop 상태를 읽어 확인했다. 검사 훅을 실행하지 않았으며 main/force push/PR는 하지 않았다. 최신 develop을 fetch/fast-forward 확인한 뒤 새 `feature/review-discussions`를 생성했다. 개발 보고 시점에는 이번 리뷰 기능 자체를 stage/commit/push/통합 merge하지 않았다. 이후 사용자 요청에 따라 feature/review-discussions commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다.

**변경·요구사항:** REV-03/04, SOC-04/05/06, OPS-01/02/04 증분이다. 리뷰 좋아요/취소·댓글/한 단계 답글·본인 수정/삭제, 타인 신고/차단, 내 신고 결과/운영 큐/숨김·복구·감사, 알림의 정확한 댓글 링크를 작성했다. 작품별/회원별 목록의 latest/likes/popular 정렬과 현재 유효한 좋아요·최근 168시간 참여자/점수를 연결했다. 리뷰 ID 참조는 기존 작품 병합의 work_id 변경에도 유지하도록 작성했다. 숨김/차단/스포일러/삭제한 부모의 현재 접근을 집계와 알림에도 적용한다.

**설치 대기 대응:** 새 조회 API가 없는 것으로 분류되는 네 DB 코드만 기존 최신순 리뷰 RPC로 fallback하고 실제 정렬/집계 준비 상태를 표시한다. 좋아요/댓글·관련 신고 화면도 CONFIG_REQUIRED를 준비 안내로 처리한다. 기대한 미설치 상태에 console.error를 쓰지 않으며 알 수 없는 실패를 빈 데이터로 바꾸지 않는다. 기존 리뷰 본문/카드/알림 종류를 유지한다.

**SQL·외부 대기:** 설치된 CLI 2.119.0의 migration new로 `20261008121123_review_discussions.sql`을 만들었다. 새 toon_review_comments/reactions와 private 신고/감사, RLS/raw revoke/정밀 grants·버전·잠금·속도 제한·참조 알림을 작성했다. MCP get_project_url은 OAuth token refresh failed: Failed to parse server response로 실패했다. 이번 원격 조회/DDL/데이터 변경 성공은 없다. `20261008090225_community_posts.sql` → `20261008102414_community_discussions.sql` → `20261008121123_review_discussions.sql` 모두 원격 미적용이다. 복구 후 zwzncrdlqnthxgdvsqxq와 Toon 의존 정의/이력을 확인하고 세 증분만 순서대로 설치한다. baseline·공유 Auth·여행 앱·공용 default privileges 변경, linked CLI push/reset/전체 seed, 원격 테스트 사용자/작품 생성은 하지 않았다.

**작성 파일·실행 상태:** 댓글 계약/스포일러/재전송/수정 입력 보존, 좋아요 ACK와 권한 입력 제한, 실제 집계/알림 DTO, 목록 fallback 및 예상 밖 장애 전파의 단위/action/UI mock 테스트를 작성했다. `supabase/tests/23_review_discussions.test.sql`은 로컬 rollback 전용으로 raw 권한·정지/본인 금지·중복/부모 관계·스포일러·신고/숨김·인기 집계·알림 설정·차단/삭제·작품 비공개 경계를 작성했다. **파일 작성만 했으며 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/성능 검수는 전부 미실행이다. 실제 확인한 사용자 흐름은 없다.** 소스와 diff를 읽은 것을 실행 검수로 보고하지 않는다.

**다음 단계:** MCP 복구 후 세 SQL 설치, 사용자가 요청할 때만 실행 검수. 다음 개발 후보는 커뮤니티 참조 작품 병합 보존과 P5 잔여 정리다. P4 비회원 PNG/edge 제한, P6 비교/추천, P7 공유 Auth 앱 탈퇴/댓글 신고 보존·비식별화, 규장각 API 승인/허가 표지 연동과 기존 미검증 범위를 유지한다.

### 2026-10-08 · 커뮤니티 작품 병합 보존 (코드 작성·DB/검수 대기)

**Git·인증:** 이전 리뷰 토론 feature `d39e988`와 develop merge `627c94a`를 push한 깨끗한 develop에서 fetch/fast-forward 확인 후 새 `feature/community-work-merge`를 생성했다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 수행하지 않았다. 2026-10-09 사용자 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 직전 사용자 승인으로 `codex mcp login supabase`는 Successfully logged in을 반환했지만, 이번 get_project_url은 MCP authentication required. Reconnect to continue using this server.를 반환했다. 사용자가 재연결했다고 알려 준 뒤 한 번 더 호출했으나 동일했다. 원격 DB 설치/조회 성공은 없으며 무한 재인증 반복이나 다른 프로젝트/토큰 경로로 우회하지 않았다.

**변경·요구사항:** CAT-08, COM-01/02/03, OPS-04. 기존 글 연결 작품의 병합 차단을 별도 보존 처리로 대체했다. 게시본/초안의 source→target ID 치환, 첫 위치 기준 중복 제거·게시본 위치 정리, 각각의 변경 버전 증가, 원문·공개/스포일러/운영 상태·댓글/좋아요/신고·최초 게시일/수정일·피드/알림 보존을 작성했다. 대상 작품만 연결된 글은 수정하지 않는다. 원본 작품이 공개 불가이면 연결이 있는 글/초안을 unavailable 충돌로 막아 재노출하지 않는다. 본인 원문 없는 연결 이력을 private에 보관하고 내 글 편집에서 `/me/posts/[id]/merge-history`로 확인한다. 관리자 미리보기/감사는 건수만 제공한다.

**DB·충돌:** 설치된 CLI 2.119.0 도움말과 migration new로 `20261008141422_community_work_merge.sql`을 생성했다. 기존 개인/티어 병합 코드를 private wrapper로 보존하고 직접 실행권을 회수했다. public RPC는 기존 role/confirm/token/version 검사를 유지한다. 작품 잠금과 관련 글/초안/연결/access NOWAIT 잠금 아래 전체 transaction으로 실행한다. 글/초안 내용과 연결을 private fingerprint에 추가하고 변경 후에는 미리보기를 다시 요구한다. PostgreSQL 공식 locking 문서와 Supabase changelog를 읽었으며 새 dependency/업그레이드는 하지 않았다. 원격 PostgreSQL 버전·권한·동작 확인은 아니다.

**원격 적용 대기:** `20261008090225_community_posts.sql` → `20261008102414_community_discussions.sql` → `20261008121123_review_discussions.sql` → `20261008141422_community_work_merge.sql` 네 파일 모두 미적용이다. 연결 복구 후 `zwzncrdlqnthxgdvsqxq`와 Toon 관련 정의/이력을 확인하고 이 순서로 추가 적용한다. 기존 baseline·공유 Auth·다른 앱·공용 default privileges 변경, linked CLI push/reset/전체 seed, 원격 사용자/작품 fixture 생성은 없다.

**작성한 검사·실행 상태:** 관리자 DTO에서 private 데이터 제외·구 DB optional 집계, 캐시 무효화, 본인 이력 DAL의 auth/입력/대상 확인·미설치 안내와 bounded DTO 테스트를 작성했다. local rollback 전용 `supabase/tests/24_community_work_merge.test.sql`은 권한/미리보기 stale·비공개 원본 차단·게시본/초안의 서로 다른 순서·중복 제거·원문/참조/이벤트 보존·버전 충돌·본인 이력 경계를 작성했다. **파일 작성만 했고 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/성능 검수는 모두 미실행이다. 실제 확인한 사용자 흐름은 없다.** 소스/diff 읽기와 CLI 도움말·파일 생성은 실행 검수로 간주하지 않는다.

**다음:** MCP 연결 복구와 4개 SQL 적용, 사용자 요청 시에만 검수. 다음 기능 후보는 P6 공개 평가 기반 취향 비교다. P4 비회원 PNG/edge 제한·P5 잔여·P7 공유 Auth 앱 탈퇴/보존·비식별화·규장각 API/허가 표지·인증 검수와 이전 미검증 범위는 유지한다.

### 2026-10-09 · P6 취향 비교 (코드 작성·원격 적용 승인/검수 대기)

**상태·요구사항:** DISC-01/05, SOC-06 진행. 타인 프로필의 취향 비교 진입, 로그인 복귀·본인 비교 안내, 공통 평가/함께 S/차이 큰 작품 20편 페이지·빈 상태·loading·계산 설명을 작성했다. 둘 다 기본 티어 우선, 그 외 공통 별점, 서로 다른 신호만 가진 작품 제외, n<5 null, 정수 점수와 표본 구간을 구현했다. 기존 Stitch 토큰과 반응형 페이지 구조를 유지한다. 실제 동작/권한/화면 검수는 아직 없으며 P6 전체나 요구사항 완료 체크는 하지 않는다.

**DB·보안:** CLI 2.119.0의 migration new로 `20261009091203_taste_comparison.sql`을 생성했다. 새 stable `toon_compare_taste` 하나이며 사용자 세션/현재 계정/상대 활성·동의·차단·현재 공개 작품을 검사한다. 본인 공개/비공개와 상대 public 평가만 교집합으로 집계하며 원시 전체 수/독서 상태/메모는 반환하지 않는다. security definer/빈 search_path/명시 권한/함수별 revoke·grant를 사용하고 테이블/RLS/공유 Auth/다른 앱/default privileges는 변경하지 않는다. profile/section/page/집계/페이지 응답을 서버에서 검증하고 private/no-store/noindex/no-referrer·prefetch false를 적용했다. SQL은 기존 두 사용자 PK 범위를 사용하며 성능 증명은 하지 않았다.

**MCP·승인 차단:** get_project_url은 `https://zwzncrdlqnthxgdvsqxq.supabase.co`를 반환했고 list_migrations 및 관련 Toon 함수 정의·제약·평가/서재/프로필 컬럼을 read-only로 읽었다. 이전 4개 SQL이 없는 이력을 확인한 뒤 첫 `toon_community_posts` apply_migration을 요청했으나 자동 승인 검토가 공유 프로젝트 원격 DDL의 명시적 적용 승인 부족으로 거절했다. 원격 DDL 성공은 없고 우회/재시도하지 않았다. 현재 승인을 받을 구체 범위는 `20261008090225_community_posts.sql` → `20261008102414_community_discussions.sql` → `20261008121123_review_discussions.sql` → `20261008141422_community_work_merge.sql` → `20261009091203_taste_comparison.sql`이다. 앞 4개는 기존에 작성·커밋한 파일이며 새 비교 RPC는 평가 기반만 사용한다. 공유 앱 데이터/계정 변경이나 초기화는 하지 않는다.

**근거·작성한 검사:** 설치된 Next 16.3.8 fetching guide, Supabase changelog/functions/RLS, Postgres/Supabase/React 스킬을 읽었다. 단위 DTO/표본 구간/URL 주입, DAL 현재 회원·대상/페이지 대조·미설치 오류, UI 표본 부족/실제 0/페이지 보존, local rollback `25_taste_comparison.test.sql`의 80점·별점 fallback/0점·20편 페이지·현재 공개/차단/상대 상태/세션 경계를 작성했다. **파일 작성만 했고 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·성능 검수는 모두 미실행이며 실제 확인한 사용자 흐름은 없다.** DDL/컬럼 metadata 읽기는 권한 동작 검수가 아니다. 원격 테스트 사용자/작품/seed는 만들지 않았다. 사용자 요청 전 검사 금지는 계속 적용한다.

**Git·다음:** 이전 feature `2799db3`와 develop `be37d0e` push 이후 깨끗한 develop에서 fetch/fast-forward를 확인하고 `feature/taste-comparison`을 생성했다. 개발 보고 시점에는 stage/commit/push/통합 merge/PR를 하지 않았다. 이후 2026-10-09 사용자가 기본 Git Flow를 요청해 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 반영 결과는 Git 이력으로 확인하며 검사·원격 SQL 적용 허가는 포함하지 않는다. 원격 SQL 적용 승인과 검사 요청은 별도다. 다음 후보는 P6 공개 S 공동 평가 기반 작품 추천이며 분석/순위/유사 사용자·P4/P5/P7 및 인증/규장각/허가 표지와 기존 미검증 범위는 유지한다.

### 2026-10-10 · 공개 S 공동 평가 작품 추천 (작성·MCP 재연결/실행 검수 대기)

**상태·요구사항:** DISC-03/05, SOC-06 진행. 작품 상세에 기존 S 독자들의 공동 평가 기반 추천 최대 6편과 실제 n/s·계산 시각·추천 설명을 작성했다. 공통 표본 n≥5/s≥3, s/(n+10) 보정 정렬을 사용하며 표본 부족·API 미설치·일시 실패·접근 불가를 구분한다. Suspense로 추천 로딩을 분리하고 추천 실패는 안전한 안내로 제한해 작품/리뷰 경로를 유지한다. 같은 장르 목록은 별도로 유지하고 UI는 기존 WorkCard/허가 이미지·텍스트 표지·색상 토큰과 반응형 grid를 쓴다. 개인 이웃 추천/순위/분석과 P6 전체 완료는 후속이다.

**SQL·권한:** CLI 2.119.0 migration new로 `20261009170725_shared_s_recommendations.sql`을 생성했다(UTC 파일명, KST 작업일 10일). 새 RPC 하나이며 공개 기준 S cohort → 후보 공개 canonical tier 집계 → 최소 표본 → score/n/s/UUID 정렬 → 상위 6카드 투영이다. 본인도 비공개 평가면 제외하며 서재 status는 공개하지 않고 planned만 제외한다. 기존 profile_visible/work_public/current_active/session_live와 권리 확인 card helper를 사용한다. 로그인 UID가 있으면 활성 세션을 요구하고 실패 시 익명 우회가 없다. 반환에는 작품 정보와 집계값만 있으며 평가자 ID/표본 미달 후보/전체 cohort 수는 없다. raw ACL/RLS·baseline/공유 Auth/여행 앱/default privileges·원격 사용자/작품 데이터는 변경하지 않았다. 기존 평가 PK·public-work index를 사용하며 성능 검증/새 index 추가는 하지 않았다.

**MCP·이전 SQL:** 사용자의 ‘좋아 고고’는 직전 안내한 대기 SQL 5개 적용과 다음 추천 개발의 진행 승인으로 받아 시작했다. get_project_url/list_migrations 모두 OAuth token refresh failed: Failed to parse server response라 현재 원격 대상/이력 읽기와 DDL 성공은 없다. 재연결 질문을 보냈고 그동안 코드 작성은 진행했다. 연결 복구 후 `zwzncrdlqnthxgdvsqxq`와 최신 이력/Toon 의존 정의를 확인하고 `20261008090225_community_posts.sql` → `20261008102414_community_discussions.sql` → `20261008121123_review_discussions.sql` → `20261008141422_community_work_merge.sql` → `20261009091203_taste_comparison.sql` → `20261009170725_shared_s_recommendations.sql` 순서로 이어간다. 현재 총 6개 미적용이며 기존 5개의 적용 승인을 다시 요청할 이유는 없다. 이번에는 원격 DDL 호출 자체를 하지 않아 자동 승인 검토의 새 거절도 없다. linked CLI push/reset/전체 seed는 금지다.

**검사·근거:** 설치된 Next 16.3.8 fetching/Suspense 문서, Supabase 공식 changelog/functions, Supabase/Postgres/React 스킬을 읽었다. 단위 DTO 최소 표본/계산식/본인 작품·중복/identity 주입, DAL 요청 세션·잘못된 대상·missing API/timeout, UI 실제 근거·빈 상태와 패널 실패 격리, local rollback `26_shared_s_recommendations.test.sql`의 표본 경계/보정 정렬/상위 6개·동점/공개 철회·양방향 차단/비활성·세션 거절 fixture를 작성했다. **실행은 하지 않았다. 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·부하 검수 및 실제 사용자 흐름은 모두 미실행**이며 사용자 요청 전 금지를 유지한다. 새로운 dependency/버전 변경은 없다.

**Git·다음:** 취향 비교 feature `dbb09ee`/develop `9a924f9` push 후 깨끗한 develop에서 fetch/fast-forward 확인, 새 `feature/shared-s-recommendations`를 만들었다. 개발 보고 시점에는 미커밋이었다. 이후 2026-10-10 사용자 Git Flow 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다. 우선 MCP 재연결 후 승인된 SQL 적용을 재개한다. 다음 기능 후보는 P6 공개 평가 기반 이웃 개인 추천이며 P4/P5/P7·순위/분석·인증/규장각/허가 표지와 기존 미검증 범위는 유지한다.


### 2026-10-10 · 대기 SQL 6개 원격 적용 완료 (기능 검수 대기)

**상태·요구사항:** 사용자 ‘좋아 아까 sql작업해야한다는거 진행해’ 요청으로 COM-01/02/03/04, REV-03/04, SOC-03/04/05/06, CAT-08, OPS-01/02/04, DISC-01/03/05의 대기 migration 6개를 적용했다. MCP get_project_url은 `zwzncrdlqnthxgdvsqxq`를 반환했고, 적용 전 이력과 관련 Toon 테이블 컬럼·제약·함수 정의를 read-only로 확인했다. 기존 로컬 SQL을 수정하지 않고 아래 순서로 각각 apply_migration에 전달했다.

| 순서 | 로컬 SQL 파일 | 원격 migration 이름 | 원격 version (UTC) | 적용 결과 |
|---|---|---|---|---|
| 1 | `20261008090225_community_posts.sql` | `toon_community_posts` | `20261009180324` | success:true |
| 2 | `20261008102414_community_discussions.sql` | `toon_community_discussions` | `20261009180338` | success:true |
| 3 | `20261008121123_review_discussions.sql` | `toon_review_discussions` | `20261009180344` | success:true |
| 4 | `20261008141422_community_work_merge.sql` | `toon_community_work_merge` | `20261009180351` | success:true |
| 5 | `20261009091203_taste_comparison.sql` | `toon_taste_comparison` | `20261009180358` | success:true |
| 6 | `20261009170725_shared_s_recommendations.sql` | `toon_shared_s_recommendations` | `20261009180403` | success:true |

**설치 근거·범위:** 마지막 list_migrations에 위 6건이 모두 등록됐고 기존 여행 앱 12건과 Toon 설치/인기/팔로우/피드/알림 이력도 유지됐다. 이번 대기 SQL은 모두 설치 완료이며 아래/위 과거 작업의 미적용·연결 대기 기록은 당시 상태다. 공용 Auth/다른 앱/default privileges·기존 baseline 변경, linked CLI push/reset/전체 seed, 원격 테스트 사용자/작품 생성은 하지 않았다. migration 안의 새 트리거/함수만 설치했으며 실제 글 게시·반응·작품 병합 등 사용자 동작을 실행하지 않았다.

**미검증·다음:** 테스트·lint·typecheck·build·React Doctor·advisor·env·타입 생성·브라우저/DB 권한·경합/성능 검사와 실제 사용자 흐름은 모두 미실행이다. DDL 성공/이력 확인은 기능·권한 검수 통과를 뜻하지 않는다. 연결/SQL 설치를 막던 항목은 해소됐으며, 실행 검수는 별도 사용자 요청 때 진행한다. 다음 개발 후보는 P6 공개 평가 기반 이웃 개인 추천이고 기존 P4/P5/P7·순위/분석·인증/규장각/허가 표지 잔여 범위는 유지한다.

**Git:** 공동 S 추천 feature `cb2ada5`/develop merge `1d1014c` push 이후 최신 develop fetch/fast-forward 확인 후 `chore/apply-pending-supabase-migrations`를 생성했다. 이번 변경 파일은 README·진행표·AGENTS 적용 기록뿐이다. SQL 적용 보고 시점에는 미커밋이었다. 이후 사용자 Git Flow 요청으로 작업 브랜치 commit/push → 최신 develop merge/push → develop 종료를 진행한다. 실제 결과는 Git 이력으로 확인하며 검사 실행 허가는 포함하지 않는다.
