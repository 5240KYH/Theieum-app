# Task 24 사용자 소속별 직위 추가 인수인계

작성일: 2026-06-08, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: `7566035 feat: 다중 소속 결재 기준 조직 반영`

## 재시작 프롬프트

```text
Task 24 사용자 소속별 직위 추가 작업을 이어서 확인해주세요.
작업 경로는 /Users/kyh/theieum이고, main 브랜치에서 추가 브랜치 없이 진행했습니다.
먼저 AGENTS.md, docs/handoffs/2026-06-08-task-24-user-organization-position.md, git status --short를 확인한 뒤 진행해주세요.
```

## 먼저 읽을 문서

```text
AGENTS.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-08-task-23-multi-organization-approval.md
docs/superpowers/plans/2026-06-08-multi-organization-approval.md
```

## 변경 요약

- `user_organizations.position_id`를 추가하는 V5 Flyway 마이그레이션을 추가했다.
- 기존 소속 데이터는 `users.position_id`로 backfill하고, `position_id`를 not null + FK로 고정했다.
- `UserOrganizationService`가 소속별 직위를 저장/조회하고, 대표 소속의 조직과 직위를 `users.organization_id`, `users.position_id`에 mirror로 동기화하도록 변경했다.
- 관리자 사용자 API의 `organizationMemberships`에 `positionId`, `positionName`을 포함했다.
- 기존 단일 소속 payload 호환을 위해 membership의 `positionId`가 없으면 request의 `positionId`를 fallback으로 사용한다.
- `ApprovalLineResolver`의 `ORG_POSITION` 결재자 조회 기준을 `users.position_id`에서 `user_organizations.position_id`로 변경했다.
- 직위 hard delete 시 `user_organizations.position_id` 참조도 삭제 차단 대상에 포함했다.
- 관리자 사용자 화면에서 전역 `직위` 입력 대신 각 소속 행의 `소속 직위`를 편집하도록 변경했다.
- 사용자 목록의 조직 요약은 `조직 / 직위`, `겸직 : 조직 / 직위(활성|비활성)` 형식으로 줄바꿈 표시한다.
- 신청서 작성 화면의 `결재 기준 조직` 선택지에서도 대표 소속의 `(대표)` suffix를 제거했다.
- 예상 결재선 API 응답에 결재자의 산정 기준 `organizationName`, `positionName`을 추가했다.
- 신청서 작성 화면의 예상 결재선은 작은 단계 badge + `조직명 이름 직위명` 순서로 표시한다.
- 결재자 산정 시 `user_organizations.position_id`를 사용하므로, 겸직자의 소속별 직위가 결재선 표시에도 반영된다.
- 신청자와 결재자가 같은 단계는 해당 단계가 현재 순서가 되는 즉시 자동 승인한다.
  - 결재선 스냅샷 단계는 삭제하지 않고 `APPROVED` 상태로 남긴다.
  - 결재 이력 action은 `AUTO_APPROVED`, 코멘트는 `신청자와 결재자가 동일하여 자동 승인되었습니다.`로 기록한다.
  - 자동 승인 단계가 연속되면 다음 일반 결재자 또는 최종 승인 완료까지 이어서 처리한다.
  - 예상 결재선 API는 `autoApprovalExpected`를 내려주고, 신청서 작성 화면은 긴 설명 대신 짧은 `자동` badge만 표시한다.
- 이전 요청의 사용자 목록 표시 개선도 같은 UI 변경 파일에 반영되어 있다.
  - 대표 소속은 `대표:` prefix 없이 표시한다.
  - 두 번째 소속부터 `겸직 : ...` 형식으로 표시한다.
  - 소속 정렬 입력은 화면에서 제거하고 내부 저장 순서만 유지한다.

## 주요 변경 파일

Backend:

```text
backend/src/main/resources/db/migration/V5__add_position_to_user_organizations.sql
backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java
backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java
backend/src/main/java/com/theieum/approval/application/ApplicationService.java
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
```

Backend tests:

```text
backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java
backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java
backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java
backend/src/test/java/com/theieum/approval/application/ApprovalActionTest.java
backend/src/test/java/com/theieum/approval/auth/AuthIntegrationTest.java
```

Frontend:

```text
frontend/src/admin/adminTypes.ts
frontend/src/admin/AdminReferencePage.tsx
frontend/src/admin/AdminReferencePage.test.tsx
frontend/src/applications/ApplicationForm.tsx
frontend/src/applications/ApplicationForm.test.tsx
frontend/src/applications/applicationTypes.ts
frontend/src/app/styles.css
```

## 검증 결과

```bash
docker compose up -d postgres-test
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.user.UserOrganizationServiceTest --tests com.theieum.approval.approval.ApprovalLineResolverTest --tests com.theieum.approval.common.DatabaseMigrationTest --tests com.theieum.approval.admin.AdminHardDeleteServiceTest
```

결과: PASS

```bash
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test
```

결과: PASS, 112 tests

```bash
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest --tests com.theieum.approval.application.ApprovalActionTest
```

결과: PASS, 자동승인 targeted 테스트 포함

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx
```

결과: PASS, 14 tests

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

결과: PASS, 10 tests

```bash
cd frontend && npm run test
```

결과: PASS, 69 tests

```bash
cd frontend && npm run build
```

결과: PASS

```bash
git diff --check
```

결과: PASS

```bash
docker compose config
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

결과: PASS

## Docker 런타임 확인

```bash
docker compose up --build -d postgres backend frontend
docker compose ps
docker compose logs --tail=80 backend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

결과:

- `theieum-postgres-1`: healthy
- `theieum-backend-1`: Up
- `theieum-frontend-1`: Up, `0.0.0.0:3000->80`
- Flyway 로그에서 v5 적용 확인: `Successfully applied 1 migration to schema "public", now at version v5`
- `http://localhost:3000`: HTTP 200
- `employee01/password` 로그인 후 `/api/applications/approval-organizations` 호출 결과: `재정부`, `기획팀` 조회 확인
- 같은 로그인으로 `기획팀` 기준 `/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=11` 호출 결과: HTTP 200, `기획팀 김형석 팀장`에 `autoApprovalExpected: true`, `총무부 채동훈 부장&교역자`에 `autoApprovalExpected: false` 포함 확인
- 같은 로그인으로 `재정부` 기준 preview는 현재 로컬 DB에 `approval_line_steps.id=6`이 요구하는 `재정부 + 팀장` 활성 결재자가 없어 HTTP 500이 발생한다. 이는 UI 변경 문제가 아니라 현재 로컬 개발 DB 결재자 배치 데이터 이슈다.

## 현재 작업 트리 메모

- 이번 작업은 아직 커밋하지 않았다.
- 사용자 요청에 따라 새 브랜치를 만들지 않고 `main`에서 진행했다.
- `AuthIntegrationTest.meRejectsTamperedToken()`은 JWT signature 마지막 글자만 바꾸면 base64url padding 영향으로 실제 decoded signature가 동일할 수 있어, signature 첫 글자를 변경하도록 테스트를 보강했다.
- 이전 UI 요청으로 수정된 사용자 관리 화면 변경도 같은 파일에 포함되어 있으므로 커밋 전 diff를 함께 확인해야 한다.
- `postgres-test`도 테스트 후 계속 실행 중이다. 필요하면 `docker compose stop postgres-test`로 중지하면 된다.

## 남은 확인 사항

- 인앱 브라우저 도구가 현재 세션에 노출되지 않아 실제 화면 클릭 검증은 자동 브라우저로 수행하지 못했다.
- 대신 `localhost:3000` HTTP 200, 실제 API 호출, Docker/Flyway 로그, frontend DOM 테스트와 build로 검증했다.
- 사용자가 승인하면 현재 변경분을 `main`에 커밋/푸시하면 된다.
