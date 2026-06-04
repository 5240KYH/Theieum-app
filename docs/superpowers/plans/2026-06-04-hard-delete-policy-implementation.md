# Hard Delete Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기준정보와 임시/취소 신청서에 복구 불가 완전 삭제 기능을 추가하되, 결재 기록과 참조 무결성은 보호한다.

**Architecture:** 기존 `DELETE` 엔드포인트는 비활성화 의미로 유지하고, 완전 삭제는 `/hard-delete` 경로로 분리한다. 백엔드는 `AdminHardDeleteService`와 `ApplicationHardDeleteService`에 참조 검사와 삭제 순서를 모으고, 프론트는 `ADMIN` 전용 위험 액션과 신청자/관리자 신청서 삭제 버튼을 명확히 분리한다.

**Tech Stack:** Java 21, Spring Boot, JDBC/JPA, PostgreSQL, Flyway, JUnit 5, MockMvc, React 18, TypeScript, React Router, Vitest, Testing Library.

---

## Scope And Guardrails

- 실제 구현 시작 전 `git status --short`를 확인한다.
- 사용자가 명시적으로 요청하기 전까지 `git add`, `git commit`, `git push`를 실행하지 않는다.
- 현재 Task 15 변경분이 작업트리에 남아 있으므로, Task 16 구현 중 해당 변경을 되돌리지 않는다.
- 기존 `DELETE /api/admin/.../{id}` 동작은 비활성화로 보존한다.
- 완전 삭제는 `ADMIN` 기준정보, 작성자 본인 또는 `ADMIN`의 `DRAFT`/`CANCELED` 신청서로 제한한다.
- 신청서 `IN_APPROVAL`, `APPROVED`, `REJECTED`는 삭제하지 않는다.
- 테스트 DB는 기존 `TestDatabaseHarness` 기준 `localhost:55432/approval_test`를 사용한다.

## File Structure

- Create: `backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java`  
  사용자/조직/직위/결재선/예외 결재자 참조 검사와 완전 삭제 SQL을 담당한다.
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`  
  기준정보 `/hard-delete` 엔드포인트와 관리자 신청서 완전 삭제 엔드포인트를 추가한다.
- Create: `backend/src/main/java/com/theieum/approval/application/ApplicationHardDeleteService.java`  
  신청서 상태/권한 검사, 결재 이력 차단, 첨부파일 DB row와 실제 파일 삭제를 담당한다.
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`  
  작성자 본인용 `DELETE /api/applications/{id}/hard-delete` 엔드포인트를 추가한다.
- Modify: `backend/src/main/java/com/theieum/approval/attachment/FileStorage.java`  
  실제 첨부파일 삭제 메서드를 추가한다.
- Modify: `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`  
  로컬 파일 삭제 구현을 추가한다.
- Create: `backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java`  
  기준정보 완전 삭제 정책과 참조 차단을 검증한다.
- Create: `backend/src/test/java/com/theieum/approval/application/ApplicationHardDeleteTest.java`  
  신청서 완전 삭제 권한, 상태 제한, 첨부파일 삭제를 검증한다.
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`  
  API 권한 경계와 HTTP status를 검증한다.
- Modify: `frontend/src/admin/adminApi.ts`  
  기준정보와 관리자 신청서 완전 삭제 API 함수를 추가한다.
- Modify: `frontend/src/applications/applicationApi.ts`  
  작성자 본인용 신청서 완전 삭제 API 함수를 추가한다.
- Modify: `frontend/src/admin/AdminReferencePage.tsx`  
  `ADMIN` 전용 완전 삭제 버튼과 확인 모달을 추가한다.
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`  
  `ADMIN`/`MANAGER` 버튼 노출과 완전 삭제 API 호출을 검증한다.
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`  
  작성자 본인용 신청서 삭제 버튼과 확인 모달을 추가한다.
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`  
  `DRAFT`/`CANCELED` 버튼 노출, 삭제 호출, 삭제 불가 상태를 검증한다.
- Modify: `frontend/src/admin/AdminApplicationsPage.tsx`  
  `ADMIN`이 `DRAFT`/`CANCELED` 신청서를 완전 삭제할 수 있는 위험 액션을 추가한다.
- Modify: `frontend/src/admin/AdminApplicationsPage.test.tsx`  
  관리자 신청서 완전 삭제 버튼과 API 호출을 검증한다.
- Modify: `frontend/src/app/styles.css`  
  위험 모달과 완전 삭제 버튼 스타일을 추가한다.
- Modify: `docs/admin-user-guide.md`  
  비활성화와 완전 삭제 차이를 반영한다.
- Modify: `docs/deployment-readiness-checklist.md`  
  외부 체험 전 테스트 데이터 삭제 검증 항목을 추가한다.
- Create or Modify: `docs/handoffs/2026-06-04-task-16-hard-delete-policy.md`  
  구현 완료 후 재시작용 인수인계를 남긴다.

---

### Task 1: Backend 기준정보 완전 삭제 테스트 작성

**Files:**
- Create: `backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java`
- Later implementation target: `backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java`

- [ ] **Step 1: Write failing service tests**

Create `backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java`:

```java
package com.theieum.approval.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.theieum.approval.common.TestDatabaseHarness;
import com.theieum.approval.common.WorkflowConflictException;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
})
class AdminHardDeleteServiceTest {

    @Autowired
    private AdminHardDeleteService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void hardDeletePositionRemovesUnusedPosition() {
        Long id = jdbcTemplate.queryForObject(
                "insert into positions (name, rank_order, sort_order, active) values ('임시 직위', 999, 999, true) returning id",
                Long.class);

        service.hardDeletePosition(id);

        assertThat(count("select count(*) from positions where id = ?", id)).isZero();
    }

    @Test
    void hardDeletePositionRejectsPositionUsedByUsers() {
        assertThatThrownBy(() -> service.hardDeletePosition(1L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("사용자가 있는 직위");
    }

    @Test
    void hardDeleteOrganizationRejectsParentOrganizationWithChildren() {
        assertThatThrownBy(() -> service.hardDeleteOrganization(1L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("하위 조직");
    }

    @Test
    void hardDeleteApprovalLineRemovesStepsFirst() {
        Long approvalTypeId = jdbcTemplate.queryForObject(
                "insert into approval_types (name, description, active) values ('삭제 테스트', 'test', true) returning id",
                Long.class);
        Long lineId = jdbcTemplate.queryForObject(
                "insert into approval_lines (approval_type_id, name, active) values (?, '삭제 테스트 결재선', true) returning id",
                Long.class,
                approvalTypeId);
        jdbcTemplate.update("""
                insert into approval_line_steps (
                    approval_line_id, step_order, step_type, direct_user_id, sort_policy
                ) values (?, 1, 'DIRECT_USER', 2, 'POSITION_ORDER')
                """, lineId);

        service.hardDeleteApprovalLine(lineId);

        assertThat(count("select count(*) from approval_line_steps where approval_line_id = ?", lineId)).isZero();
        assertThat(count("select count(*) from approval_lines where id = ?", lineId)).isZero();
    }

    @Test
    void hardDeleteApprovalOrgExceptionRemovesException() {
        Long id = jdbcTemplate.queryForObject("""
                insert into approval_org_exceptions (
                    approval_type_id, organization_id, approver_user_id, step_order, active
                ) values (1, 3, 18, 1, true) returning id
                """, Long.class);

        service.hardDeleteApprovalOrgException(id);

        assertThat(count("select count(*) from approval_org_exceptions where id = ?", id)).isZero();
    }

    @Test
    void hardDeleteUserRejectsUserReferencedByApplications() {
        assertThatThrownBy(() -> service.hardDeleteUser(3L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("사용 중인 사용자");
    }

    private int count(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    @TestConfiguration
    static class ResetDatabaseConfig {

        @Bean
        FlywayMigrationStrategy cleanMigrateStrategy() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.admin.AdminHardDeleteServiceTest
```

Expected: `FAIL` because `AdminHardDeleteService` does not exist.

---

### Task 2: Backend 기준정보 완전 삭제 서비스와 API 구현

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java`
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
- Test: `backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java`
- Test: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`

- [ ] **Step 1: Implement `AdminHardDeleteService`**

Create `backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java`:

```java
package com.theieum.approval.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.common.WorkflowConflictException;

@Service
public class AdminHardDeleteService {

    private final JdbcTemplate jdbcTemplate;

    public AdminHardDeleteService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void hardDeleteUser(long id) {
        requireExists("users", id, "User not found: " + id);
        requireUnused("""
                select count(*) from applications where applicant_id = ?
                """, id, "신청서에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from application_approval_steps where original_approver_id = ?
                """, id, "결재 단계에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from approval_histories
                where original_approver_id = ? or actor_id = ?
                """, new Object[] {id, id}, "결재 이력에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from attachments where uploaded_by = ?
                """, id, "첨부파일에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from notification_events where recipient_id = ?
                """, id, "알림에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from approval_line_steps where direct_user_id = ?
                """, id, "결재선 단계에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*) from approval_org_exceptions where approver_user_id = ?
                """, id, "예외 결재자에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        jdbcTemplate.update("delete from users where id = ?", id);
    }

    @Transactional
    public void hardDeleteOrganization(long id) {
        requireExists("organizations", id, "Organization not found: " + id);
        requireUnused("select count(*) from organizations where parent_id = ?", id, "하위 조직이 있어 완전 삭제할 수 없습니다.");
        requireUnused("select count(*) from users where organization_id = ?", id, "소속 사용자가 있어 완전 삭제할 수 없습니다.");
        requireUnused("select count(*) from approval_org_exceptions where organization_id = ?", id, "예외 결재자 설정에서 사용 중인 조직입니다.");
        jdbcTemplate.update("delete from organizations where id = ?", id);
    }

    @Transactional
    public void hardDeletePosition(long id) {
        requireExists("positions", id, "Position not found: " + id);
        requireUnused("select count(*) from users where position_id = ?", id, "사용자가 있는 직위는 완전 삭제할 수 없습니다.");
        requireUnused("select count(*) from approval_line_steps where position_id = ?", id, "결재선 단계에서 사용 중인 직위입니다.");
        jdbcTemplate.update("delete from positions where id = ?", id);
    }

    @Transactional
    public void hardDeleteApprovalLine(long id) {
        requireExists("approval_lines", id, "Approval line not found: " + id);
        jdbcTemplate.update("delete from approval_line_steps where approval_line_id = ?", id);
        jdbcTemplate.update("delete from approval_lines where id = ?", id);
    }

    @Transactional
    public void hardDeleteApprovalOrgException(long id) {
        requireExists("approval_org_exceptions", id, "Approval organization exception not found: " + id);
        jdbcTemplate.update("delete from approval_org_exceptions where id = ?", id);
    }

    private void requireExists(String table, long id, String message) {
        Integer count = jdbcTemplate.queryForObject("select count(*) from " + table + " where id = ?", Integer.class, id);
        if (count == null || count == 0) {
            throw new ResourceNotFoundException(message);
        }
    }

    private void requireUnused(String sql, long id, String message) {
        requireUnused(sql, new Object[] {id}, message);
    }

    private void requireUnused(String sql, Object[] args, String message) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        if (count != null && count > 0) {
            throw new WorkflowConflictException(message);
        }
    }
}
```

- [ ] **Step 2: Add `ADMIN` hard-delete endpoints**

Modify `backend/src/main/java/com/theieum/approval/admin/AdminController.java`:

```java
private final AdminHardDeleteService adminHardDeleteService;
```

Add the constructor parameter and assignment:

```java
AdminHardDeleteService adminHardDeleteService
```

```java
this.adminHardDeleteService = adminHardDeleteService;
```

Add endpoint methods near the existing soft-delete methods:

```java
@DeleteMapping("/users/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeleteUser(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    adminHardDeleteService.hardDeleteUser(id);
    return ResponseEntity.noContent().build();
}

@DeleteMapping("/organizations/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeleteOrganization(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    adminHardDeleteService.hardDeleteOrganization(id);
    return ResponseEntity.noContent().build();
}

@DeleteMapping("/positions/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeletePosition(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    adminHardDeleteService.hardDeletePosition(id);
    return ResponseEntity.noContent().build();
}

@DeleteMapping("/approval-lines/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeleteApprovalLine(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    adminHardDeleteService.hardDeleteApprovalLine(id);
    return ResponseEntity.noContent().build();
}

@DeleteMapping("/approval-org-exceptions/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeleteApprovalOrgException(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    adminHardDeleteService.hardDeleteApprovalOrgException(id);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 3: Add API authorization coverage**

Append tests to `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`:

```java
@Test
void managerCannotHardDeleteReferenceData() throws Exception {
    jdbcTemplate.update("""
            insert into users (
                login_id, external_subject, password_hash, name, email,
                organization_id, position_id, roles, active
            ) values (?, null, ?, ?, ?, 1, 5, 'MANAGER', true)
            """,
            "manager-test",
            passwordEncoder.encode("password"),
            "테스트 매니저",
            "manager-test@theieum.local");

    String managerToken = login("manager-test");

    mockMvc.perform(delete("/api/admin/positions/{id}/hard-delete", 1L)
                    .header("Authorization", bearer(managerToken)))
            .andExpect(status().isForbidden());
}

@Test
void adminHardDeleteReferenceDataReturnsConflictWhenReferenced() throws Exception {
    String adminToken = login("admin");

    mockMvc.perform(delete("/api/admin/positions/{id}/hard-delete", 1L)
                    .header("Authorization", bearer(adminToken)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("사용자가 있는 직위는 완전 삭제할 수 없습니다."));
}
```

- [ ] **Step 4: Run backend reference delete tests**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.admin.AdminHardDeleteServiceTest --tests com.theieum.approval.api.ApiAuthorizationTest
```

Expected: `BUILD SUCCESSFUL`.

---

### Task 3: Backend 신청서 완전 삭제와 첨부파일 삭제 구현

**Files:**
- Modify: `backend/src/main/java/com/theieum/approval/attachment/FileStorage.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`
- Create: `backend/src/main/java/com/theieum/approval/application/ApplicationHardDeleteService.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
- Create: `backend/src/test/java/com/theieum/approval/application/ApplicationHardDeleteTest.java`

- [ ] **Step 1: Write failing application hard-delete tests**

Create `backend/src/test/java/com/theieum/approval/application/ApplicationHardDeleteTest.java`:

```java
package com.theieum.approval.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.TestDatabaseHarness;
import com.theieum.approval.common.WorkflowConflictException;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
})
class ApplicationHardDeleteTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private ApplicationHardDeleteService hardDeleteService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void applicantCanHardDeleteOwnDraftWithAttachmentFile() {
        Application application = createDraft(3L);
        applicationService.attachReceiptImage(application.getId(), 3L, "receipt.png", "image/png", pngBytes());
        String filePath = jdbcTemplate.queryForObject(
                "select file_path from attachments where application_id = ?",
                String.class,
                application.getId());
        assertThat(Files.exists(Path.of(filePath))).isTrue();

        hardDeleteService.hardDeleteByApplicant(application.getId(), 3L);

        assertThat(count("select count(*) from applications where id = ?", application.getId())).isZero();
        assertThat(count("select count(*) from attachments where application_id = ?", application.getId())).isZero();
        assertThat(Files.exists(Path.of(filePath))).isFalse();
    }

    @Test
    void applicantCannotHardDeleteOthersDraft() {
        Application application = createDraft(3L);

        assertThatThrownBy(() -> hardDeleteService.hardDeleteByApplicant(application.getId(), 4L))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("본인의 신청서만 삭제할 수 있습니다");
    }

    @Test
    void adminCanHardDeleteCanceledApplicationFromOtherApplicant() {
        Application application = createDraft(3L);
        applicationService.cancelDraft(application.getId(), 3L);

        hardDeleteService.hardDeleteByAdmin(application.getId());

        assertThat(count("select count(*) from applications where id = ?", application.getId())).isZero();
    }

    @Test
    void submittedApplicationCannotBeHardDeleted() {
        Application application = createDraft(3L);
        applicationService.attachReceiptImage(application.getId(), 3L, "receipt.png", "image/png", pngBytes());
        applicationService.submit(application.getId(), 3L);

        assertThatThrownBy(() -> hardDeleteService.hardDeleteByAdmin(application.getId()))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("임시저장 또는 취소 상태");
    }

    private Application createDraft(long applicantId) {
        return applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                applicantId,
                1L,
                LocalDate.of(2026, 6, 4),
                LocalDate.of(2026, 6, 3),
                "삭제 테스트 상점",
                new BigDecimal("1000.00"),
                "삭제 테스트"));
    }

    private int count(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    private byte[] pngBytes() {
        return new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47,
                0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52
        };
    }

    @TestConfiguration
    static class ResetDatabaseConfig {

        @Bean
        FlywayMigrationStrategy cleanMigrateStrategy() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.application.ApplicationHardDeleteTest
```

Expected: `FAIL` because `ApplicationHardDeleteService` and `FileStorage.deleteIfExists` do not exist.

- [ ] **Step 3: Extend file storage deletion**

Modify `backend/src/main/java/com/theieum/approval/attachment/FileStorage.java`:

```java
package com.theieum.approval.attachment;

public interface FileStorage {

    StoredFile store(String originalFilename, String contentType, byte[] bytes);

    byte[] read(String path);

    void deleteIfExists(String path);
}
```

Modify `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`:

```java
@Override
public void deleteIfExists(String path) {
    try {
        Files.deleteIfExists(Path.of(path));
    } catch (IOException ex) {
        throw new FileStorageException("Unable to delete attachment", ex);
    }
}
```

- [ ] **Step 4: Implement `ApplicationHardDeleteService`**

Create `backend/src/main/java/com/theieum/approval/application/ApplicationHardDeleteService.java`:

```java
package com.theieum.approval.application;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.attachment.FileStorage;
import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.common.WorkflowConflictException;

@Service
public class ApplicationHardDeleteService {

    private final JdbcTemplate jdbcTemplate;
    private final FileStorage fileStorage;

    public ApplicationHardDeleteService(JdbcTemplate jdbcTemplate, FileStorage fileStorage) {
        this.jdbcTemplate = jdbcTemplate;
        this.fileStorage = fileStorage;
    }

    @Transactional
    public void hardDeleteByApplicant(long applicationId, long actorId) {
        ApplicationDeleteTarget target = loadTarget(applicationId);
        if (target.applicantId() != actorId) {
            throw new ForbiddenOperationException("본인의 신청서만 삭제할 수 있습니다.");
        }
        hardDeleteAllowedApplication(target);
    }

    @Transactional
    public void hardDeleteByAdmin(long applicationId) {
        hardDeleteAllowedApplication(loadTarget(applicationId));
    }

    private void hardDeleteAllowedApplication(ApplicationDeleteTarget target) {
        if (target.status() != ApplicationStatus.DRAFT && target.status() != ApplicationStatus.CANCELED) {
            throw new WorkflowConflictException("임시저장 또는 취소 상태의 신청서만 삭제할 수 있습니다.");
        }
        requireNoHistories(target.id());

        List<String> filePaths = jdbcTemplate.queryForList(
                "select file_path from attachments where application_id = ?",
                String.class,
                target.id());

        jdbcTemplate.update("delete from notification_events where application_id = ?", target.id());
        jdbcTemplate.update("delete from application_approval_steps where application_id = ?", target.id());
        jdbcTemplate.update("delete from attachments where application_id = ?", target.id());
        jdbcTemplate.update("delete from applications where id = ?", target.id());

        for (String filePath : filePaths) {
            fileStorage.deleteIfExists(filePath);
        }
    }

    private ApplicationDeleteTarget loadTarget(long applicationId) {
        List<ApplicationDeleteTarget> targets = jdbcTemplate.query("""
                select id, applicant_id, status
                from applications
                where id = ?
                """,
                (rs, rowNum) -> new ApplicationDeleteTarget(
                        rs.getLong("id"),
                        rs.getLong("applicant_id"),
                        ApplicationStatus.valueOf(rs.getString("status"))),
                applicationId);
        if (targets.isEmpty()) {
            throw new ResourceNotFoundException("Application not found: " + applicationId);
        }
        return targets.getFirst();
    }

    private void requireNoHistories(long applicationId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from approval_histories where application_id = ?",
                Integer.class,
                applicationId);
        if (count != null && count > 0) {
            throw new WorkflowConflictException("결재 이력이 있는 신청서는 삭제할 수 없습니다.");
        }
    }

    private record ApplicationDeleteTarget(long id, long applicantId, ApplicationStatus status) {
    }
}
```

- [ ] **Step 5: Add application hard-delete endpoints**

Modify `ApplicationController` constructor to inject `ApplicationHardDeleteService`:

```java
private final ApplicationHardDeleteService applicationHardDeleteService;
```

```java
ApplicationHardDeleteService applicationHardDeleteService
```

```java
this.applicationHardDeleteService = applicationHardDeleteService;
```

Add endpoint:

```java
@DeleteMapping("/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDelete(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireRole(user, "APPLICANT");
    applicationHardDeleteService.hardDeleteByApplicant(id, user.id());
    return ResponseEntity.noContent().build();
}
```

Modify imports:

```java
import org.springframework.web.bind.annotation.DeleteMapping;
```

Modify `AdminController` constructor to inject `ApplicationHardDeleteService` and add:

```java
@DeleteMapping("/applications/{id}/hard-delete")
@Transactional
public ResponseEntity<Void> hardDeleteApplication(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireAdmin(user);
    applicationHardDeleteService.hardDeleteByAdmin(id);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 6: Run application hard-delete tests**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test --tests com.theieum.approval.application.ApplicationHardDeleteTest
```

Expected: `BUILD SUCCESSFUL`.

---

### Task 4: Frontend API와 기준정보 완전 삭제 UI

**Files:**
- Modify: `frontend/src/admin/adminApi.ts`
- Modify: `frontend/src/admin/AdminReferencePage.tsx`
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Add admin API functions**

Modify `frontend/src/admin/adminApi.ts`:

```ts
export function hardDeleteAdminUser(id: number) {
  return api<void>(`/admin/users/${id}/hard-delete`, { method: 'DELETE' });
}

export function hardDeleteAdminOrganization(id: number) {
  return api<void>(`/admin/organizations/${id}/hard-delete`, { method: 'DELETE' });
}

export function hardDeleteAdminPosition(id: number) {
  return api<void>(`/admin/positions/${id}/hard-delete`, { method: 'DELETE' });
}

export function hardDeleteAdminApprovalLine(id: number) {
  return api<void>(`/admin/approval-lines/${id}/hard-delete`, { method: 'DELETE' });
}

export function hardDeleteAdminApprovalOrgException(id: number) {
  return api<void>(`/admin/approval-org-exceptions/${id}/hard-delete`, { method: 'DELETE' });
}

export function hardDeleteAdminApplication(id: number) {
  return api<void>(`/admin/applications/${id}/hard-delete`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Write failing UI tests for admin reference delete**

Append to `frontend/src/admin/AdminReferencePage.test.tsx`:

```ts
it('관리자는 기준정보를 완전 삭제할 수 있다', async () => {
  setAuth(['ADMIN', 'APPLICANT']);
  window.history.pushState({}, '', '/admin/positions');
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/admin/positions' && !init?.method) {
      return new Response(JSON.stringify(positions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/admin/positions/1/hard-delete' && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  const row = await screen.findByRole('row', { name: /#1 사원/ });
  await userEvent.click(within(row).getByRole('button', { name: '완전 삭제' }));

  expect(screen.getByRole('dialog', { name: '완전 삭제' })).toBeInTheDocument();
  expect(screen.getByText(/복구할 수 없습니다/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '완전 삭제 확인' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/admin/positions/1/hard-delete', expect.objectContaining({
    method: 'DELETE'
  }));
  expect(await screen.findByRole('status')).toHaveTextContent('완전 삭제되었습니다.');
});

it('매니저에게는 기준정보 완전 삭제 버튼이 보이지 않는다', async () => {
  setAuth(['MANAGER', 'APPLICANT']);
  window.history.pushState({}, '', '/admin/positions');
  vi.stubGlobal('fetch', mockReferenceFetch());

  render(<App />);

  await screen.findByRole('heading', { name: '직위 관리' });
  expect(screen.queryByRole('button', { name: '완전 삭제' })).not.toBeInTheDocument();
});
```

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AdminReferencePage.test.tsx
```

Expected: `FAIL` because the API functions, button, and dialog do not exist.

- [ ] **Step 3: Add hard delete config to `AdminReferencePage`**

Modify imports in `frontend/src/admin/AdminReferencePage.tsx` to include hard delete API functions and an alert icon if useful:

```ts
import {
  hardDeleteAdminApprovalLine,
  hardDeleteAdminApprovalOrgException,
  hardDeleteAdminOrganization,
  hardDeleteAdminPosition,
  hardDeleteAdminUser
} from './adminApi';
```

Add a `hardRemove` field to the page config type:

```ts
hardRemove?: (id: number) => Promise<void>;
```

Wire each kind:

```ts
users: {
  ...,
  hardRemove: hardDeleteAdminUser
}
```

Repeat for organizations, positions, approval lines, and approval org exceptions.

- [ ] **Step 4: Add dialog state and hard delete handler**

Add state:

```ts
const [hardDeleteTarget, setHardDeleteTarget] = useState<ReferenceItem | null>(null);
```

Add handler:

```ts
async function handleHardDelete() {
  if (!hardDeleteTarget || !config.hardRemove) {
    return;
  }

  setError('');
  setMessage('');

  try {
    await config.hardRemove(itemId(hardDeleteTarget));
    setHardDeleteTarget(null);
    setMessage('완전 삭제되었습니다.');
    await load();
  } catch (requestError) {
    setError(errorMessage(requestError));
  }
}
```

Only show the button for `ADMIN`:

```tsx
{auth.hasRole('ADMIN') && config.hardRemove ? (
  <button
    className="secondary-button danger-button"
    type="button"
    onClick={() => setHardDeleteTarget(item)}
  >
    완전 삭제
  </button>
) : null}
```

Add dialog near the password dialog:

```tsx
{hardDeleteTarget ? (
  <div className="modal-backdrop" role="presentation">
    <section className="modal-panel danger-modal" role="dialog" aria-modal="true" aria-labelledby="hard-delete-title">
      <h2 id="hard-delete-title">완전 삭제</h2>
      <p>이 작업은 복구할 수 없습니다.</p>
      <p className="muted-copy">대상 ID: #{itemId(hardDeleteTarget)}</p>
      <div className="row-actions">
        <button className="secondary-button" type="button" onClick={() => setHardDeleteTarget(null)}>
          취소
        </button>
        <button className="secondary-button danger-button" type="button" onClick={() => void handleHardDelete()}>
          완전 삭제 확인
        </button>
      </div>
    </section>
  </div>
) : null}
```

- [ ] **Step 5: Add minimal modal styling**

Modify `frontend/src/app/styles.css`:

```css
.danger-modal {
  border-top: 4px solid #dc2626;
}

.danger-modal h2 {
  margin: 0;
}
```

If `.modal-backdrop` or `.modal-panel` already exists, reuse it. If not, add compact fixed overlay styles matching existing form panels.

- [ ] **Step 6: Run admin reference tests**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AdminReferencePage.test.tsx
```

Expected: `PASS`.

---

### Task 5: Frontend 신청서 완전 삭제 UI

**Files:**
- Modify: `frontend/src/applications/applicationApi.ts`
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`
- Modify: `frontend/src/admin/AdminApplicationsPage.tsx`
- Modify: `frontend/src/admin/AdminApplicationsPage.test.tsx`

- [ ] **Step 1: Add application API functions**

Modify `frontend/src/applications/applicationApi.ts`:

```ts
export function hardDeleteApplication(applicationId: number) {
  return api<void>(`/applications/${applicationId}/hard-delete`, {
    method: 'DELETE'
  });
}
```

Use `hardDeleteAdminApplication` from `adminApi.ts` for admin list deletion.

- [ ] **Step 2: Write failing applicant detail tests**

Append to `frontend/src/applications/ApplicationDetailPage.test.tsx`:

```ts
import userEvent from '@testing-library/user-event';

it('임시저장 신청서 작성자는 신청서를 완전 삭제할 수 있다', async () => {
  const draftResponse = {
    ...applicationResponse,
    status: 'DRAFT',
    applicant: { id: 3, name: '직원01' },
    approvalSteps: [],
    approvalHistories: []
  };
  setAuth(['APPLICANT']);
  window.history.pushState({}, '', '/applications/100');
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/applications/100' && !init?.method) {
      return new Response(JSON.stringify(draftResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/applications/100/hard-delete' && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  await screen.findByRole('heading', { name: '신청서 상세' });
  await userEvent.click(screen.getByRole('button', { name: '신청서 삭제' }));
  expect(screen.getByRole('dialog', { name: '신청서 삭제' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '삭제 확인' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/hard-delete', expect.objectContaining({
    method: 'DELETE'
  }));
});

it('결재중 신청서에는 완전 삭제 버튼이 보이지 않는다', async () => {
  setAuth(['APPLICANT']);
  window.history.pushState({}, '', '/applications/100');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/applications/100') {
      return new Response(JSON.stringify(applicationResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(null, { status: 404 });
  }));

  render(<App />);

  await screen.findByRole('heading', { name: '신청서 상세' });
  expect(screen.queryByRole('button', { name: '신청서 삭제' })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Implement applicant detail deletion**

Modify `frontend/src/applications/ApplicationDetailPage.tsx`:

```ts
import { useNavigate } from 'react-router-dom';
import { hardDeleteApplication } from './applicationApi';
import { useAuth } from '../auth/AuthContext';
```

Add:

```ts
const auth = useAuth();
const navigate = useNavigate();
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
```

Add helpers:

```ts
function canHardDeleteApplication(application: ApplicationResponse) {
  return (application.status === 'DRAFT' || application.status === 'CANCELED')
    && (auth.hasRole('ADMIN') || application.applicant.id === auth.user?.id);
}

async function handleHardDeleteApplication() {
  if (!application) {
    return;
  }

  setError('');

  try {
    await hardDeleteApplication(application.id);
    navigate('/applications/my');
  } catch (requestError) {
    setError(errorMessage(requestError));
  }
}
```

Render button:

```tsx
{application && canHardDeleteApplication(application) ? (
  <button className="secondary-button danger-button" type="button" onClick={() => setDeleteDialogOpen(true)}>
    신청서 삭제
  </button>
) : null}
```

Render dialog:

```tsx
{deleteDialogOpen ? (
  <div className="modal-backdrop" role="presentation">
    <section className="modal-panel danger-modal" role="dialog" aria-modal="true" aria-labelledby="application-delete-title">
      <h2 id="application-delete-title">신청서 삭제</h2>
      <p>이 신청서와 첨부파일은 복구할 수 없습니다.</p>
      <div className="row-actions">
        <button className="secondary-button" type="button" onClick={() => setDeleteDialogOpen(false)}>
          취소
        </button>
        <button className="secondary-button danger-button" type="button" onClick={() => void handleHardDeleteApplication()}>
          삭제 확인
        </button>
      </div>
    </section>
  </div>
) : null}
```

- [ ] **Step 4: Add admin application list deletion tests**

Append to `frontend/src/admin/AdminApplicationsPage.test.tsx`:

```ts
it('관리자는 임시저장 신청서를 완전 삭제할 수 있다', async () => {
  setAuth(['ADMIN']);
  window.history.pushState({}, '', '/admin/applications');
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/admin/applications' && !init?.method) {
      return new Response(JSON.stringify([{ ...adminApplications[0], status: 'DRAFT' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/admin/applications/10/hard-delete' && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  await screen.findByRole('heading', { name: '전체 신청서 관리' });
  await userEvent.click(screen.getByRole('button', { name: '완전 삭제' }));
  await userEvent.click(screen.getByRole('button', { name: '완전 삭제 확인' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/admin/applications/10/hard-delete', expect.objectContaining({
    method: 'DELETE'
  }));
});
```

- [ ] **Step 5: Implement admin application deletion**

Modify `frontend/src/admin/AdminApplicationsPage.tsx`:

```ts
import { hardDeleteAdminApplication } from './adminApi';
```

Add state:

```ts
const [hardDeleteTarget, setHardDeleteTarget] = useState<AdminApplication | null>(null);
```

Add helper:

```ts
function canHardDeleteAdminApplication(application: AdminApplication) {
  return application.status === 'DRAFT' || application.status === 'CANCELED';
}
```

Add handler:

```ts
async function handleHardDeleteApplication() {
  if (!hardDeleteTarget) {
    return;
  }

  setError('');
  setMessage('');

  try {
    await hardDeleteAdminApplication(hardDeleteTarget.id);
    setHardDeleteTarget(null);
    setMessage('완전 삭제되었습니다.');
    await loadApplications();
  } catch (requestError) {
    setError(errorMessage(requestError));
  }
}
```

Render a `완전 삭제` button only when `canHardDeleteAdminApplication(application)` is true, and reuse the same `danger-modal` pattern from Task 4.

- [ ] **Step 6: Run frontend application tests**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApplicationDetailPage.test.tsx AdminApplicationsPage.test.tsx
```

Expected: `PASS`.

---

### Task 6: 문서, 통합 검증, 인수인계

**Files:**
- Modify: `docs/admin-user-guide.md`
- Modify: `docs/deployment-readiness-checklist.md`
- Create: `docs/handoffs/2026-06-04-task-16-hard-delete-policy.md`

- [ ] **Step 1: Update admin guide**

Add a section to `docs/admin-user-guide.md` near the management screen documentation:

```markdown
### 비활성화와 완전 삭제

관리 기준정보의 일반 삭제는 운영 안전을 위해 비활성화로 처리된다. 비활성 데이터는 목록에서 확인할 수 있고 다시 활성화할 수 있다.

`ADMIN`은 테스트 데이터나 잘못 만든 기준정보를 완전히 삭제할 수 있다. 완전 삭제는 복구할 수 없으며, 다른 신청서/결재 이력/알림/첨부/결재선에서 참조 중인 데이터는 삭제되지 않는다.

신청서는 작성자 본인 또는 `ADMIN`만 삭제할 수 있으며, `임시저장`과 `취소` 상태만 대상이다. 결재중, 승인, 반려 신청서는 업무 기록 보호를 위해 삭제할 수 없다.
```

- [ ] **Step 2: Update deployment checklist**

Add to `docs/deployment-readiness-checklist.md`:

```markdown
- [ ] 외부 체험 전 테스트 기준정보 완전 삭제와 참조 중 데이터 삭제 차단이 동작하는지 확인한다.
- [ ] 임시저장/취소 신청서만 작성자 또는 ADMIN이 삭제할 수 있는지 확인한다.
- [ ] 신청서 삭제 시 첨부파일 DB row와 실제 파일이 함께 삭제되는지 확인한다.
```

- [ ] **Step 3: Run full frontend verification**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

Expected:

```text
Test Files ... passed
built in
```

- [ ] **Step 4: Run backend verification**

Run:

```bash
cd /Users/kyh/theieum/backend
./gradlew test
```

Expected:

```text
BUILD SUCCESSFUL
```

If local Java/Gradle cannot run, use the existing Docker fallback documented in project memory/handoffs and record the fallback command and result in the handoff.

- [ ] **Step 5: Run static diff check**

Run:

```bash
cd /Users/kyh/theieum
git diff --check
```

Expected: no output and exit code `0`.

- [ ] **Step 6: Create handoff**

Create `docs/handoffs/2026-06-04-task-16-hard-delete-policy.md`:

```markdown
# Task 16 데이터 완전 삭제 정책 인수인계

작성일: 2026-06-04
브랜치: `codex/task-15-mobile-pwa-staging`

## 완료 범위

- 기준정보 완전 삭제 API와 UI
- 신청자/ADMIN 신청서 완전 삭제 API와 UI
- 참조 데이터 삭제 차단
- 임시저장/취소 신청서 삭제 제한
- 첨부파일 실제 파일 삭제
- 관리자 문서와 배포 체크리스트 반영

## 검증

- `cd backend && ./gradlew test`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `git diff --check`

## 다음 작업

- Task 17 공용 캘린더 설계 및 구현
- Task 18 스테이징 외부 체험 운영 준비
```

- [ ] **Step 7: Final status checkpoint**

Run:

```bash
cd /Users/kyh/theieum
git status --short
```

Expected: Task 15 변경분과 Task 16 변경분이 함께 표시된다. 사용자 요청 전에는 stage/commit/push 하지 않는다.

---

## Self-Review

### Spec Coverage

- 사용자/조직/직위/결재선/예외 결재자 완전 삭제: Task 1, Task 2, Task 4.
- 신청서 `DRAFT`/`CANCELED` 완전 삭제: Task 3, Task 5.
- 작성자 본인과 `ADMIN` 신청서 삭제 권한: Task 3, Task 5.
- `MANAGER` 기준정보 완전 삭제 불가: Task 2, Task 4.
- 참조 데이터 삭제 차단과 `409 Conflict`: Task 1, Task 2, Task 3.
- 첨부파일 DB row와 실제 파일 삭제: Task 3.
- 확인 모달과 복구 불가 안내: Task 4, Task 5.
- 문서 반영: Task 6.

### Placeholder Scan

이 계획은 구현자가 바로 작업할 수 있도록 파일 경로, 메서드명, 엔드포인트, 테스트 명령, 예상 결과를 포함한다. 프론트 테스트 예시는 현재 파일의 실제 fixture 이름인 `applicationResponse`와 `adminApplications`를 기준으로 작성했다.

### Type Consistency

- 백엔드 서비스명은 `AdminHardDeleteService`, `ApplicationHardDeleteService`로 고정한다.
- 프론트 API 함수명은 `hardDeleteAdmin...`, 작성자용은 `hardDeleteApplication`으로 고정한다.
- 신청서 상태는 기존 `ApplicationStatus`의 `DRAFT`, `CANCELED`, `IN_APPROVAL`, `APPROVED`, `REJECTED`를 사용한다.
- 완전 삭제 엔드포인트는 모두 `/hard-delete` suffix를 사용한다.
