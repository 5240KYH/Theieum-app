# Task 21 체험 계정/기준정보 및 첨부파일 관리 안정화 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 브랜치: `main`
기준 커밋: `56feb60 Merge pull request #3 from 5240KYH/codex/task-15-mobile-pwa-staging`

## 목표

프로세스 안정화 이후 30명 안팎 외부 체험을 열 수 있도록 seed 계정, 기준정보 확인, 첨부파일 제한, 체험 종료 정리 절차를 안정화했다.

## 주요 변경 파일

```text
backend/src/main/resources/db/seed/V2__seed_mvp_data.sql
backend/src/main/resources/application.yml
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
backend/src/main/java/com/theieum/approval/application/ApplicationService.java
backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java
backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
.env.staging.example
docker-compose.staging.yml
docs/staging-trial-data-and-attachments.md
docs/staging-tester-account-packet.md
docs/staging-operations-runbook.md
docs/staging-test-guide.md
docs/admin-user-guide.md
docs/deployment-readiness-checklist.md
README.md
docs/superpowers/specs/2026-06-05-trial-accounts-attachments-design.md
docs/superpowers/plans/2026-06-05-trial-accounts-attachments-stability.md
```

## 완료 내용

- seed 계정을 기존 20개에서 30개 이상으로 확장했다.
- 체험 전용 `trial-*` 계정을 추가했다.
  - `trial-applicant01` ~ `trial-applicant06`
  - `trial-approver01`, `trial-approver02`
  - `trial-manager01`
  - `trial-admin01`
- `trial-manager01`은 `MANAGER` 역할을 포함한다.
- 첨부파일 크기 제한을 `app.attachments.max-image-bytes` 설정으로 분리했다.
- 신청서당 첨부 개수 제한을 `app.attachments.max-files-per-application` 설정으로 추가했다.
- Task 21 당시 기본 첨부 정책은 영수증 이미지 1개, 5MB 이하였으나, 후속 다중 영수증 첨부 작업에서 신청서당 최대 10개, 파일당 5MB 이하로 확장했다.
- 스테이징 compose와 `.env.staging.example`에 첨부 정책 환경변수를 연결했다.
- 체험 계정 풀, 기준정보 점검, 첨부파일 저장 위치, 백업/삭제 절차를 `docs/staging-trial-data-and-attachments.md`에 정리했다.
- seed 확장으로 흔들리던 resolver 테스트는 독립 fixture를 사용하도록 정리했다.

## 검증

```text
docker compose up -d postgres-test: PASS
targeted RED: DatabaseMigrationTest, ApplicationSubmissionTest, ApiAuthorizationTest에서 새 테스트 3개 실패 확인
targeted GREEN: DatabaseMigrationTest, ApplicationSubmissionTest, ApiAuthorizationTest 통과
ApprovalLineResolverTest: PASS
backend 전체 테스트: PASS, 89 tests
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: PASS
```

백엔드 테스트는 호스트 Java 17 대신 Java 21 Docker 컨테이너에서 실행했다.

## 운영 메모

- 스테이징 체험 환경은 `local` profile과 `db/seed`를 사용하므로 seed 계정 비밀번호는 모두 `password`다.
- 운영 배포에서는 `db/seed`를 제외하고 운영 계정을 별도로 만든다.
- 체험자에게 실제 개인정보와 실제 영수증 업로드 금지를 반드시 안내한다.
- DB와 첨부 volume은 함께 보존하거나 함께 삭제해야 한다. DB만 보존하고 첨부 volume을 삭제하면 이미지 미리보기가 깨진다.
- 체험 종료 삭제 명령. DB/첨부 volume 삭제가 포함되므로 실행 전 명시적 승인이 필요하다.

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

## 후속 상태

Task 22 스테이징 체험 운영 전 최종 사용자 시나리오 점검은 완료되었다.

완료된 범위:

- 다중 영수증 첨부, 상세 확대 미리보기, 관리자 월별 ZIP 다운로드, 모바일 캘린더 클릭 보정을 실제 화면 기준으로 확인했다.
- 상세 결과는 `docs/handoffs/2026-06-08-task-22-final-user-scenario-check.md`에 남겼다.
- 추가 요청이 없다면 Task 22까지 계획된 기능 구현 task는 종료된 상태로 본다.

## 새 채팅 재시작 프롬프트

```text
/Users/kyh/theieum 에서 docs/handoff-2026-06-03.md 와 docs/handoffs/2026-06-08-task-22-final-user-scenario-check.md 를 먼저 읽고, Task 22까지 완료된 상태를 확인해주세요. git status --short 와 Docker 상태를 먼저 확인하고, 기존 미커밋 변경은 되돌리지 말아주세요.
```
