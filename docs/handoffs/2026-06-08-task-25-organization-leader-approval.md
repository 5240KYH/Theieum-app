# Task 25 조직장 기반 결재선 인수인계

작성일: 2026-06-08, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: `7566035 feat: 다중 소속 결재 기준 조직 반영`

## 재시작 프롬프트

```text
Task 25 조직장 기반 결재선 작업을 이어서 확인해주세요.
작업 경로는 /Users/kyh/theieum이고, main 브랜치에서 추가 브랜치 없이 진행했습니다.
먼저 AGENTS.md, docs/handoff-2026-06-03.md, docs/handoffs/2026-06-08-task-24-user-organization-position.md, docs/handoffs/2026-06-08-task-25-organization-leader-approval.md, git status --short를 확인한 뒤 진행해주세요.
```

## 먼저 읽을 문서

```text
AGENTS.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-08-task-24-user-organization-position.md
docs/superpowers/plans/2026-06-08-multi-organization-approval.md
```

## 변경 요약

- 팀/부 등 조직 레벨이 달라도 같은 결재선 설정을 쓸 수 있도록 `조직장` 개념을 추가했다.
- V6 Flyway 마이그레이션으로 `organizations.leader_user_id`를 추가했다.
- V7 Flyway 마이그레이션으로 `application_approval_steps.approval_organization_id`, `approval_position_id`를 추가했다.
- 관리자 조직 API는 `leader_user_id`, `leader_user_name`, `leader_position_name`을 조회/저장한다.
- 조직장 저장 정책:
  - `leaderUserId`는 nullable이다.
  - 값이 있으면 해당 사용자가 활성 사용자이고 해당 조직의 활성 소속자여야 한다.
  - 조직장 사용자 물리 삭제는 먼저 조직장 지정 해제를 요구하도록 차단한다.
- 결재선 단계 타입에 `ORG_LEADER`를 추가했다.
- `ORG_LEADER` 단계는 기존 조직범위(`APPLICANT_ORG`, `PARENT_ORG`, `ROOT_ORG`)를 그대로 사용한다.
  - 팀 선택 시 `APPLICANT_ORG`는 팀 조직장, `PARENT_ORG`는 부 조직장을 찾는다.
  - 부 선택 시 `APPLICANT_ORG`는 부 조직장, `PARENT_ORG`는 최상위 조직장을 찾는다.
- `ORG_LEADER` 단계의 결재자 직위는 `user_organizations.position_id` 기준으로 내려간다.
- 조직장이 없거나 비활성 사용자/비활성 소속이면 예상 결재선/제출 단계에서 명확히 실패한다.
- 신청자와 조직장이 같은 경우는 Task 24의 자동승인 로직을 그대로 재사용한다.
- 제출된 결재 단계는 결재선 산정 당시의 조직/직위를 스냅샷으로 저장한다.
  - 이후 조직장이나 겸직 직위가 변경되어도 과거 신청서의 결재 진행 상태는 당시 기준으로 표시된다.
- 관리자 조직 화면에서 조직장 컬럼과 `조직장` 콤보를 추가했다.
- 관리자 결재선 화면에서 `조직장` 단계 유형을 추가했다.
  - `조직장` 유형은 조직범위만 입력한다.
  - 사용자/직위 입력은 숨기고 저장 payload에는 `positionId: null`, `directUserId: null`을 보낸다.

## 주요 변경 파일

Backend:

```text
backend/src/main/resources/db/migration/V6__add_organization_leader.sql
backend/src/main/resources/db/migration/V7__add_approval_step_assignment_snapshot.sql
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java
backend/src/main/java/com/theieum/approval/application/ApplicationApprovalStep.java
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
backend/src/main/java/com/theieum/approval/application/ApplicationService.java
backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java
backend/src/main/java/com/theieum/approval/approval/ApprovalStepType.java
```

Backend tests:

```text
backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java
backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java
```

Frontend:

```text
frontend/src/admin/adminTypes.ts
frontend/src/admin/AdminReferencePage.tsx
frontend/src/admin/AdminReferencePage.test.tsx
frontend/src/applications/applicationTypes.ts
frontend/src/applications/ApplicationDetailPage.tsx
frontend/src/applications/ApplicationDetailPage.test.tsx
frontend/src/app/styles.css
```

## 검증 결과

```bash
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest --tests com.theieum.approval.approval.ApprovalLineResolverTest
```

결과: PASS

```bash
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest --tests com.theieum.approval.approval.ApprovalLineResolverTest --tests com.theieum.approval.api.ApiAuthorizationTest --tests com.theieum.approval.admin.AdminHardDeleteServiceTest
```

결과: PASS

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx
```

결과: PASS, 15 tests

```bash
cd frontend && npm run test -- ApplicationDetailPage.test.tsx ApplicationForm.test.tsx AdminApplicationsPage.test.tsx
```

결과: PASS, 24 tests

```bash
docker run --rm --network host -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test
```

결과: PASS, 119 tests, failures 0, errors 0

```bash
cd frontend && npm run test
```

결과: PASS, 71 tests

```bash
cd frontend && npm run build
```

결과: PASS

```bash
git diff --check
docker compose config
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
docker compose up --build -d postgres backend frontend
docker compose ps
docker compose logs --tail=120 backend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

결과:

- `git diff --check`: PASS
- local/staging compose config: PASS
- `theieum-backend`, `theieum-frontend` 최신 이미지 빌드 성공
- `theieum-backend-1`, `theieum-frontend-1`, `theieum-postgres-1`, `theieum-postgres-test-1` 실행 중
- backend 로그에서 `Successfully applied 1 migration to schema "public", now at version v7` 확인
- 호스트 기준 `http://localhost:3000`: HTTP 200
- headless 브라우저에서 `http://localhost:3000/login` 로그인 화면 렌더링 확인
  - 화면 텍스트: `영수증 첨부 전자결재`, `로그인`, `아이디`, `비밀번호`

## 남은 확인 사항

- 실제 로컬 개발 DB에는 각 조직의 `leader_user_id`가 아직 지정되어 있지 않을 수 있다. 조직장 결재선을 사용하려면 관리자 조직 관리 화면에서 먼저 조직장을 지정해야 한다.
- 관리자 조직 화면 로그인 후 확인은 seed 관리자 비밀번호 추측을 더 진행하지 않아 중단했다. 조직장 화면 계약은 `AdminReferencePage.test.tsx`와 Docker 렌더링으로 검증했다.
- 본 인수인계 작성 후 사용자 요청에 따라 `main` 브랜치에서 커밋/푸시를 진행한다.
