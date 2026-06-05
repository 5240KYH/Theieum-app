# Trial Accounts And Attachments Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 30명 안팎의 스테이징 체험을 위해 seed 계정, 기준정보 검증, 첨부파일 제한, 종료 정리 문서를 안정화한다.

**Architecture:** 기존 Spring Boot REST API와 Flyway seed 구조를 유지한다. 첨부 제한은 서버 설정으로 분리하고, seed 확장은 기존 계정 ID와 결재선 동작을 깨지 않는 후방 추가 방식으로 처리한다.

**Tech Stack:** Spring Boot 3.3, Spring Data JPA, Flyway, PostgreSQL, Gradle, Docker Compose, Markdown docs.

---

## 파일 구조

- `backend/src/main/resources/db/seed/V2__seed_mvp_data.sql`: 체험 전용 `trial-*` 계정 추가
- `backend/src/main/resources/application.yml`: 첨부 크기와 개수 제한 기본값 추가
- `backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java`: 신청서별 첨부 개수 조회 추가
- `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`: 첨부 개수 제한 적용
- `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`: 첨부 크기 제한 설정값 적용
- `.env.staging.example`, `docker-compose.staging.yml`: 스테이징 첨부 정책 환경변수 연결
- `docs/staging-trial-data-and-attachments.md`: 체험 계정과 첨부 운영 런북
- `docs/staging-tester-account-packet.md`, `docs/staging-operations-runbook.md`, `docs/admin-user-guide.md`, `docs/deployment-readiness-checklist.md`, `README.md`: 운영 문서 링크와 정책 반영
- `docs/handoffs/2026-06-05-task-21-trial-accounts-attachments.md`: 다음 채팅 인수인계

## Task 1: Seed 계정 회귀 테스트

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java`
- Modify: `backend/src/main/resources/db/seed/V2__seed_mvp_data.sql`

- [x] **Step 1: 실패 테스트 작성**

`DatabaseMigrationTest`에서 seed 계정 수가 30개 이상이고, `trial-applicant01`, `trial-approver01`, `trial-manager01`이 활성 상태로 존재하는지 확인한다.

- [x] **Step 2: RED 확인**

Run:

```bash
docker run --rm --network host --user 501:20 -e GRADLE_USER_HOME=/gradle-cache -v /private/tmp/theieum-gradle-cache:/gradle-cache -v /private/tmp:/private/tmp -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21-jdk ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest
```

Expected: 기존 seed가 20개라 `seedUserCount` 기대값에서 실패한다.

- [x] **Step 3: 최소 구현**

`V2__seed_mvp_data.sql`에 `trial-*` 체험 전용 계정 10개를 추가한다. 기존 1~20번 계정과 기존 결재선은 변경하지 않는다.

- [x] **Step 4: GREEN 확인**

Targeted 테스트 묶음에서 `DatabaseMigrationTest`가 통과한다.

## Task 2: 첨부 개수 제한

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- Modify: `backend/src/main/resources/application.yml`

- [x] **Step 1: 실패 테스트 작성**

`ApplicationSubmissionTest`에 `draftCanHaveOnlyConfiguredNumberOfReceiptImages`를 추가한다. 첫 첨부는 성공하고 두 번째 첨부는 `WorkflowConflictException`과 `Receipt attachment limit exceeded`로 실패해야 한다.

- [x] **Step 2: RED 확인**

Expected: 기존 서비스에 신청서별 첨부 개수 제한이 없어 두 번째 첨부가 저장되며 실패한다.

- [x] **Step 3: 최소 구현**

`AttachmentRepository.countByApplicationId`를 추가하고, `ApplicationService.attachReceiptImage`에서 파일 저장 전에 `app.attachments.max-files-per-application` 제한을 확인한다.

- [x] **Step 4: GREEN 확인**

Targeted 테스트 묶음에서 `ApplicationSubmissionTest`가 통과한다.

## Task 3: 첨부 크기 제한 설정화

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `.env.staging.example`
- Modify: `docker-compose.staging.yml`

- [x] **Step 1: 실패 테스트 작성**

`ApiAuthorizationTest`에 `app.attachments.max-image-bytes=8`을 주입하고, 9바이트 PNG fixture 업로드가 `413 Payload Too Large`를 반환하는지 확인한다.

- [x] **Step 2: RED 확인**

Expected: 기존 컨트롤러가 5MB 상수를 사용하므로 9바이트 fixture를 허용해 실패한다.

- [x] **Step 3: 최소 구현**

`ApplicationController`에서 `app.attachments.max-image-bytes`를 주입받아 크기 제한을 적용한다. 스테이징 compose에 `ATTACHMENT_MAX_IMAGE_BYTES`와 `ATTACHMENT_MAX_FILES_PER_APPLICATION`을 전달한다.

- [x] **Step 4: GREEN 확인**

Targeted 테스트 묶음에서 `ApiAuthorizationTest`가 통과한다.

## Task 4: 문서와 인수인계

**Files:**
- Create: `docs/staging-trial-data-and-attachments.md`
- Create: `docs/handoffs/2026-06-05-task-21-trial-accounts-attachments.md`
- Modify: `docs/staging-tester-account-packet.md`
- Modify: `docs/staging-operations-runbook.md`
- Modify: `docs/admin-user-guide.md`
- Modify: `docs/deployment-readiness-checklist.md`
- Modify: `README.md`
- Modify: `docs/handoff-2026-06-03.md`

- [x] **Step 1: 운영 런북 추가**

계정 풀, 역할별 배정, 첨부 정책, volume 보존/삭제 절차를 `docs/staging-trial-data-and-attachments.md`에 정리한다.

- [x] **Step 2: 기존 문서 연결**

README, 운영 가이드, 스테이징 런북, 체크리스트에서 새 런북과 첨부 정책을 참조한다.

- [x] **Step 3: 인수인계 작성**

Task 21 변경 파일, 검증 결과, 다음 추천 task를 `docs/handoffs/2026-06-05-task-21-trial-accounts-attachments.md`와 root handoff에 기록한다.

## Self Review

- Spec coverage: seed 30명, `trial-*` 계정, 첨부 개수/크기 제한, 스테이징 환경변수, 종료 정리 절차를 모두 작업에 연결했다.
- Placeholder scan: 미완성 항목 없이 실행된 단계와 검증 명령을 기록했다.
- Type consistency: 설정 키는 `app.attachments.max-image-bytes`, `app.attachments.max-files-per-application`과 환경변수 `ATTACHMENT_MAX_IMAGE_BYTES`, `ATTACHMENT_MAX_FILES_PER_APPLICATION`로 일관된다.
