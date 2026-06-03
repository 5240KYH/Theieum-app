# 영수증 첨부 전자결재 앱 최종 리뷰

작성 시점: 2026-06-03 17시대, Asia/Seoul
검토 범위: `1b355cf2d7878268871801bb50b3bcb096e4f2bb`부터 `4b14528645de1eb7de77a92719ec95a6f8cb0504`까지

## 검증 명령

| 영역 | 명령 | 결과 |
| --- | --- | --- |
| backend | `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home ./gradlew test` | `BUILD SUCCESSFUL` |
| frontend build | `/opt/homebrew/bin/npm run build` | Vite build passed |
| frontend test | `/opt/homebrew/bin/npm run test` | 5 files, 18 tests passed |
| docker | `docker compose -p theieum_task13_review up --build -d postgres backend frontend` | backend/frontend/postgres Up |
| docker smoke | `curl -I http://localhost:3000` | `HTTP/1.1 200 OK` |
| docker smoke | `curl -i http://localhost:3000/api/auth/login` | `HTTP/1.1 401`, `Allow: POST` |
| e2e | `/opt/homebrew/bin/npm run test` in `e2e` | 1 passed |
| formatting | `git diff --check` | clean |

백엔드 로그에서 `Started ApprovalApplication`을 확인했다. 샌드박스에서는 Gradle 소켓 접근과 Docker/localhost 접근이 제한되어 관련 명령은 승인된 환경에서 재실행했다.

## 확인한 요구사항

- 사용자, 조직, 직위 seed 데이터와 관리자 조회 화면의 기본 동작
- 결재선 산정과 개발팀 조직 예외 결재선 적용
- 신청서 작성, 영수증 이미지 첨부, 제출
- 결재자 승인과 신청자 최종 상태 확인
- 관리자 예외 결재 저장과 감사 필드 테스트
- 인앱 알림 생성과 신청자 알림함 확인
- 카카오/이메일 알림 확장을 위한 `NotificationSender` 구조
- Docker Compose 기반 로컬 MVP 실행 하네스
- Playwright E2E 기반 핵심 승인 흐름 검증

## 리뷰 결과

Critical 이슈는 발견되지 않았다. 다만 운영 배포 전에는 아래 Important 항목을 별도 후속 작업으로 처리해야 한다.

### Important

1. 첨부파일 조회와 미리보기 권한 흐름이 아직 없다.
   - 현재 백엔드는 첨부 업로드만 제공하고 저장 파일을 읽는 API가 없다.
   - 상세 화면도 `첨부 이미지 조회 대기` placeholder 상태다.
   - 후속 조치: 신청자, 현재/완료 결재자, 관리자만 접근 가능한 첨부 content API와 UI를 추가한다.

2. 신청서 lifecycle 일부가 설계 요구사항보다 좁다.
   - 임시저장 수정, 취소, 반려 건 재상신 API와 화면이 없다.
   - 후속 조치: DRAFT 수정/취소와 REJECTED 재상신 정책을 정한 뒤 API, 프론트, 테스트를 추가한다.

3. 조직별 예외 결재자 관리 API와 화면이 없다.
   - DB와 결재선 산정 로직에는 `approval_org_exceptions`가 반영되어 있지만 관리자가 목록을 관리할 수 없다.
   - 후속 조치: 관리자용 조회/등록/비활성화 API와 검증 테스트를 추가한다.

4. 관리자 예외 결재 감사 데이터가 앱 화면에 충분히 노출되지 않는다.
   - `approval_histories`에는 원 결재자, 실제 처리자, 예외 사유가 저장된다.
   - 신청서 상세 응답과 화면은 현재 단계 상태 중심으로만 표시한다.
   - 후속 조치: 감사 이력 조회 응답과 UI를 추가해 실제 처리자와 사유를 표시한다.

5. Playwright E2E가 핵심 happy path만 검증한다.
   - 관리자 로그인, seed 관리 화면, 관리자 예외 결재, 반려 흐름, 결재자 알림 확인은 아직 E2E 범위 밖이다.
   - 후속 조치: 기본 승인, 관리자 smoke, 관리자 예외 결재 시나리오로 E2E를 분리 확장한다.

### Minor

- 카카오 알림은 sender 골격은 있으나 이벤트가 기본적으로 `IN_APP` 채널로 생성된다. 채널 정책과 채널별 이벤트 생성 전략이 필요하다.
- Docker Compose는 로컬 MVP 검증용이다. 운영 배포 전 `local` profile, seed 데이터, 고정 secret, 로컬 파일 저장소를 운영 구성과 분리해야 한다.
- README의 기본 계정 안내는 실제 E2E 흐름에 맞춰 `employee01 -> lead-dev` 흐름을 명확히 보강했다.

## 배포 준비 판정

로컬 MVP 검증과 Docker 기반 데모 실행은 통과했다. 현재 상태는 내부 시연과 기능 검증용으로 사용할 수 있지만, 운영 배포 준비 완료로 보기는 어렵다. 첨부파일 조회 권한, 신청서 lifecycle, 예외 결재자 관리, 감사 이력 노출은 운영 전 필수 보완 항목으로 남긴다.

## 남은 확장 후보

- 이메일 알림
- 카카오 알림톡
- S3 또는 MinIO 파일 저장
- 금액별 결재선
- 대리결재
- 운영용 `.env.example`과 `docker-compose.local.yml` / 운영 템플릿 분리
