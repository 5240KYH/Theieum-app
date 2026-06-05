# Multi Receipt Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신청서당 여러 영수증 이미지를 업로드하고, 상세에서 편하게 미리보며, 관리자가 월별 첨부 ZIP을 다운로드할 수 있게 한다.

**Architecture:** 기존 `attachments` 테이블과 개별 첨부 content API를 유지한다. 서버는 신청서당 첨부 제한을 10개로 늘리고 관리자 전용 월별 ZIP API를 추가하며, 프론트는 다중 파일 선택/썸네일 그리드/확대 미리보기와 관리자 월별 다운로드 버튼을 추가한다.

**Tech Stack:** Spring Boot 3.3, Spring Data JPA, JdbcTemplate, Java ZipOutputStream, React/Vite, Vitest, Testing Library, Docker Compose.

---

## 파일 구조

- `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`: 첨부 개수 제한은 기존 로직 유지, 기본값 변경
- `backend/src/main/resources/application.yml`: `ATTACHMENT_MAX_FILES_PER_APPLICATION` 기본값 10
- `.env.staging.example`, `docker-compose.staging.yml`: 스테이징 기본값 10
- `backend/src/main/java/com/theieum/approval/admin/AdminController.java`: 관리자 월별 ZIP 다운로드 API 추가
- `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`: 10개 허용/11번째 차단 테스트
- `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`: 월별 ZIP 권한/내용 테스트
- `frontend/src/applications/ApplicationForm.tsx`: 다중 파일 선택, 썸네일, 개별 삭제, 확대 미리보기
- `frontend/src/applications/ApplicationDetailPage.tsx`: 여러 첨부 확대 미리보기 모달
- `frontend/src/admin/adminApi.ts`: 월별 ZIP 다운로드 helper
- `frontend/src/admin/AdminApplicationsPage.tsx`: 월 선택과 다운로드 버튼
- `frontend/src/app/styles.css`: 다중 첨부 그리드와 미리보기 스타일
- `docs/**`: 첨부 정책 10개와 월별 다운로드 문서화

## Task 1: Backend Multi Attachment Limit

- [x] **Step 1: Write failing test**

`ApplicationSubmissionTest`에서 `draftAllowsTenReceiptImagesAndRejectsEleventh`를 작성한다. 10개 첨부는 저장되고 11번째는 `WorkflowConflictException`이 발생해야 한다.

- [x] **Step 2: Run RED**

```bash
docker run --rm --network host --user 501:20 -e GRADLE_USER_HOME=/gradle-cache -v /private/tmp/theieum-gradle-cache:/gradle-cache -v /private/tmp:/private/tmp -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21-jdk ./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest
```

Expected: 현재 테스트 property가 1개 제한이라 2번째 첨부에서 실패한다.

- [x] **Step 3: Implement**

테스트 property와 기본 설정을 10개로 바꾸고, `.env.staging.example`도 10개로 바꾼다.

- [x] **Step 4: Run GREEN**

같은 테스트가 통과해야 한다.

## Task 2: Backend Monthly ZIP Download

- [x] **Step 1: Write failing API tests**

`ApiAuthorizationTest`에 `adminCanDownloadMonthlyReceiptAttachmentZip`과 `managerCannotDownloadMonthlyReceiptAttachmentZip`을 추가한다.

- [x] **Step 2: Run RED**

```bash
docker run --rm --network host --user 501:20 -e GRADLE_USER_HOME=/gradle-cache -v /private/tmp/theieum-gradle-cache:/gradle-cache -v /private/tmp:/private/tmp -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21-jdk ./gradlew test --tests com.theieum.approval.api.ApiAuthorizationTest
```

Expected: `/api/admin/attachments/monthly-download`가 없어서 404 또는 405로 실패한다.

- [x] **Step 3: Implement**

`AdminController`에 `GET /attachments/monthly-download?month=YYYY-MM`을 추가한다. `requireAdmin(user)`를 적용하고, `receipt_date`가 해당 월인 첨부를 ZIP으로 내려준다.

- [x] **Step 4: Run GREEN**

API 테스트가 통과해야 한다.

## Task 3: Frontend Multi Upload And Preview

- [x] **Step 1: Write failing frontend tests**

`ApplicationForm.test.tsx`에서 여러 파일 선택 시 썸네일이 여러 개 표시되고 `/attachments` API가 파일 수만큼 호출되는지 확인한다. `ApplicationDetailPage` 관련 테스트 또는 기존 상세 flow에서 썸네일 클릭 시 확대 미리보기가 열리는지 확인한다.

- [x] **Step 2: Run RED**

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx ApplicationDetailPage.test.tsx
```

Expected: 기존 단일 파일 state 때문에 다중 썸네일/다중 업로드 기대가 실패한다.

- [x] **Step 3: Implement**

`ApplicationForm`을 `File[]` 기반 state로 바꾸고, `multiple` input, 썸네일 그리드, 개별 삭제, 확대 미리보기를 구현한다. `ApplicationDetailPage`는 여러 첨부 썸네일과 확대 미리보기 모달을 제공한다.

- [x] **Step 4: Run GREEN**

프론트 테스트가 통과해야 한다.

## Task 4: Admin Monthly Download UI

- [x] **Step 1: Write failing frontend test**

`AdminApplicationsPage.test.tsx`에서 월 선택 후 `월별 첨부 다운로드` 버튼을 누르면 `/api/admin/attachments/monthly-download?month=2026-06` blob fetch가 호출되는지 확인한다.

- [x] **Step 2: Run RED**

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx
```

Expected: 버튼이 없어 실패한다.

- [x] **Step 3: Implement**

`adminApi.ts`에 blob helper를 추가하고 `AdminApplicationsPage` 상단 toolbar에 월 input과 다운로드 버튼을 추가한다.

- [x] **Step 4: Run GREEN**

관리자 프론트 테스트가 통과해야 한다.

## Task 5: Docs And Handoff

- [x] **Step 1: Update docs**

Task 21 문서와 staging/admin docs의 `1개` 정책을 `최대 10개`로 바꾸고 월별 ZIP 다운로드 절차를 추가한다.

- [x] **Step 2: Verify**

```bash
git diff --check
rg -n "영수증 이미지 1개|ATTACHMENT_MAX_FILES_PER_APPLICATION=1([^0-9]|$)" docs README.md .env.staging.example docker-compose.staging.yml backend/src/main/resources/application.yml
```

Expected: 의도적으로 남긴 과거 설명이 없다면 결과가 없어야 한다.

## Self Review

- Spec coverage: 다중 업로드, 상세 미리보기, 관리자 월별 ZIP, 권한 제한, 문서 갱신을 모두 포함한다.
- Placeholder scan: 실행할 테스트와 수정 파일이 구체적으로 적혀 있다.
- Type consistency: 서버 설정 키와 환경변수 이름은 Task 21에서 도입한 `app.attachments.max-files-per-application` / `ATTACHMENT_MAX_FILES_PER_APPLICATION`을 그대로 쓴다.
