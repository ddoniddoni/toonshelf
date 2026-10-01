# 06. 개발 순서, 검수, 운영

## 1. 진행 원칙

P0부터 P7까지 전체가 최종 구현 범위다. 한 번의 Codex 작업에서 모든 기능을 무리하게 작성하기보다 각 단계의 코드/DB/보안/테스트를 함께 완료한다. 뒤 단계에 있다는 이유로 요청된 기능을 제품에서 삭제하지 않는다.

이 문서가 처음 제공되는 시점의 애플리케이션 상태는 **미구현**이다. 문서 점검과 실행 코드 테스트를 구분한다. 실제 실행하지 않은 검사는 완료 표시를 하지 않는다.

| 단계 | 현재 상태 | 완료 보고/근거 |
|---|---|---|
| P0 | 조건부: 코드 구성, DB 검증 대기 | 아래 16절. 로컬 Docker 엔진 필요 |
| P1 | 미착수 | 없음 |
| P2 | 미착수 | 없음 |
| P3 | 미착수 | 없음 |
| P4 | 미착수 | 없음 |
| P5 | 미착수 | 없음 |
| P6 | 미착수 | 없음 |
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

자체 텍스트 커버를 기본으로 구현하고 허가된 이미지의 표시/내보내기 분기, 철회 처리를 연결한다. 로컬 seed는 60개의 명확한 `[테스트] 작품`과 합성 작가/장르를 사용한다. 실제 플랫폼명은 분류 텍스트일 뿐 제휴 배지가 아니다.

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
