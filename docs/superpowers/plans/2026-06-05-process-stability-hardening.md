# Process Stability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 체험 전 결재 신청, 승인/반려, 권한, 알림, 삭제 제한의 회귀 테스트를 보강한다.

**Architecture:** 기존 Spring Boot 서비스 테스트와 MockMvc API 테스트를 확장한다. 프로덕션 코드는 새 테스트가 실제 결함을 드러낼 때만 최소 변경한다. Task 완료 후 handoff와 루트 인수인계를 갱신한다.

**Tech Stack:** Spring Boot 3.3, JUnit 5, AssertJ, MockMvc, PostgreSQL test database, Gradle, Docker.

---

## File Structure

- Create: `docs/superpowers/specs/2026-06-05-process-stability-design.md`
- Create: `docs/superpowers/plans/2026-06-05-process-stability-hardening.md`
- Modify: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`
- Modify: `backend/src/test/java/com/theieum/approval/application/ApprovalActionTest.java`
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
- Create: `docs/handoffs/2026-06-05-task-20-process-stability.md`
- Modify: `docs/handoff-2026-06-03.md`
- Modify: `docs/deployment-readiness-checklist.md`

---

### Task 1: Submission Boundary Tests

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`

- [x] **Step 1: Add tests for submit boundaries**

Add tests that verify:

- a non-applicant cannot submit another user's draft
- a canceled application cannot be submitted until it is revised back to `DRAFT`

- [x] **Step 2: Run targeted submission tests**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest
```

Expected:

```text
BUILD SUCCESSFUL
```

If the host Java toolchain cannot run Java 21 tests, run the same Gradle command inside a Java 21 Docker container after starting `postgres-test`.

---

### Task 2: Approval Action Stability Tests

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/application/ApprovalActionTest.java`

- [x] **Step 1: Add tests for action ordering and terminal states**

Add tests that verify:

- a future approver cannot approve before the current pending step
- an approved application cannot be rejected afterward
- a rejected application cannot be approved afterward
- a manager override records the same audit shape as an admin override

- [x] **Step 2: Run targeted approval action tests**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.application.ApprovalActionTest
```

Expected:

```text
BUILD SUCCESSFUL
```

---

### Task 3: API Authorization and Notification Tests

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`

- [x] **Step 1: Add API process stability tests**

Add tests that verify:

- current approver can read detail and attachment while future approver cannot before their turn
- future approver can read detail and attachment after the prior step is approved
- notification read API only allows the recipient to mark the notification read
- completed and rejected applications cannot be hard deleted through applicant/admin APIs

- [x] **Step 2: Run targeted API authorization tests**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.api.ApiAuthorizationTest
```

Expected:

```text
BUILD SUCCESSFUL
```

---

### Task 4: Documentation and Handoff

**Files:**
- Create: `docs/handoffs/2026-06-05-task-20-process-stability.md`
- Modify: `docs/handoff-2026-06-03.md`
- Modify: `docs/deployment-readiness-checklist.md`

- [x] **Step 1: Create Task 20 handoff**

Record scope, changed files, verification commands, any blocked commands, and the recommended next Task 21.

- [x] **Step 2: Update root handoff**

Add Task 20 as the latest update and keep Task 19 Oracle VM trigger intact for later.

- [x] **Step 3: Update deployment checklist**

Mark only items that were actually verified by Task 20 tests.

---

### Task 5: Final Verification

**Files:**
- Verify all changed source and docs

- [x] **Step 1: Run whitespace check**

Run:

```bash
cd /Users/kyh/theieum
git diff --check
```

Expected: no output.

- [x] **Step 2: Run backend targeted tests**

Run all three targeted backend test classes from Tasks 1-3.

- [x] **Step 3: Confirm frontend tests are not required**

No frontend test run is required for Task 20 because production API contracts and frontend code did not change. If a later process-stability fix changes response shapes or frontend behavior, run:

```bash
cd /Users/kyh/theieum/frontend
npm run test
```

Expected: all frontend tests pass.

---

## Self-Review

- The plan focuses on process stability before external deployment.
- Task 21 remains separate for 30-person seed data and attachment management policy.
- Oracle VM deployment remains paused and resumable through the Task 19 trigger.
