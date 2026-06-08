# Multi Organization Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 사용자가 여러 조직에 소속될 수 있게 하고, 신청서 작성 시 선택한 결재 기준 조직으로 예상 결재선과 제출 결재선을 산정한다.

**Architecture:** `user_organizations`를 소속 원본으로 추가하고 `users.organization_id`는 대표 소속 미러로 유지한다. 신청서에는 `approval_organization_id`를 저장하며, 결재선 산정기는 신청자 ID와 선택 조직 ID를 함께 받아 소속 검증, 조직 스코프 해석, 같은 결재자 중복 제거를 담당한다. 관리자 화면은 사용자 소속 목록을 편집하고, 신청서 작성 화면은 본인의 활성 소속 중 결재 기준 조직을 선택한다.

**Tech Stack:** Spring Boot 3.3, Java 21, JdbcTemplate, Spring Data JPA, Flyway, PostgreSQL, JUnit 5, AssertJ, React, Vite, TypeScript, Vitest, Testing Library.

---

## 파일 구조

- Create: `backend/src/main/resources/db/migration/V4__add_user_organizations_and_approval_organization.sql`
  `user_organizations`, `applications.approval_organization_id`, 더이음사랑의교회 조직 트리 seed, 기존 사용자/신청서 이관을 담당한다.
- Modify: `backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java`
  새 테이블, 컬럼, 조직 트리, 대표 소속 이관 검증을 추가한다.
- Create: `backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java`
  사용자 소속 목록 조회, 대표 소속 동기화, 신청 가능 조직 검증을 담당한다.
- Create: `backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java`
  대표 소속 저장, 중복 차단, `users.organization_id` 미러 동기화를 검증한다.
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
  사용자 API에 `organizationMemberships`를 추가하고 사용자 생성/수정 시 소속 서비스로 저장한다.
- Modify: `backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java`
  선택된 결재 기준 조직을 받아 소속 검증, 스코프 해석, 중복 결재자 제거를 수행한다.
- Modify: `backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java`
  팀/부 스코프 해석, 비소속 조직 차단, 결재자 중복 제거 테스트를 추가한다.
- Modify: `backend/src/main/java/com/theieum/approval/application/Application.java`
  `approvalOrganization` 필드를 추가하고 임시저장/수정 시 갱신한다.
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
  create/update/preview/submit 명령에 `approvalOrganizationId`를 추가하고 저장된 조직 기준으로 제출한다.
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
  결재 기준 조직 목록 API, preview query param, create/update payload/response 확장을 제공한다.
- Modify: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`
  선택 조직 저장, 비소속 조직 차단, 제출 스냅샷 생성 검증을 추가한다.
- Modify: `frontend/src/admin/adminTypes.ts`, `frontend/src/admin/adminApi.ts`, `frontend/src/admin/AdminReferencePage.tsx`, `frontend/src/admin/AdminReferencePage.test.tsx`
  관리자 사용자 소속 목록 타입, 저장 payload, 대표 소속 UI를 추가한다.
- Modify: `frontend/src/applications/applicationTypes.ts`, `frontend/src/applications/applicationApi.ts`, `frontend/src/applications/ApplicationForm.tsx`, `frontend/src/applications/ApplicationForm.test.tsx`
  신청서 결재 기준 조직 목록, 선택 UI, preview 재조회, payload 확장을 추가한다.
- Modify: `docs/admin-user-guide.md`, `docs/staging-trial-data-and-attachments.md`, `docs/handoff-2026-06-03.md`
  다중 소속 운영 방식과 새 조직 트리 설명을 반영한다.

커밋은 사용자가 직접 확인 후 진행한다. 각 task 끝의 체크포인트는 `git add`나 `git commit`을 실행하지 않는다.

## Task 1: Flyway Migration And Seed

**Files:**
- Create: `backend/src/main/resources/db/migration/V4__add_user_organizations_and_approval_organization.sql`
- Modify: `backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java`

- [x] **Step 1: Write the failing migration test**

`DatabaseMigrationTest.flywayCreatesCoreTablesAndSeedsMvpData()`에 아래 검증을 추가한다.

```java
assertTablesExist(
        "users",
        "organizations",
        "positions",
        "approval_types",
        "approval_lines",
        "approval_line_steps",
        "approval_org_exceptions",
        "applications",
        "application_approval_steps",
        "approval_histories",
        "attachments",
        "notification_events",
        "calendar_events",
        "user_organizations");

assertColumnsExist(
        "applications",
        "approval_organization_id");

Integer missingPrimaryMembershipCount = jdbcTemplate.queryForObject(
        """
        select count(*)
        from users u
        where not exists (
            select 1
            from user_organizations uo
            where uo.user_id = u.id
              and uo.organization_id = u.organization_id
              and uo.primary_flag = true
              and uo.active = true
        )
        """,
        Integer.class);
assertThat(missingPrimaryMembershipCount).isZero();

Integer churchOrganizationCount = jdbcTemplate.queryForObject(
        """
        select count(*)
        from organizations
        where name in (
            '더이음사랑의교회',
            '예배부',
            '찬양팀',
            '미디어팀',
            '새가족팀',
            '중보기도팀',
            '총무부',
            '기획팀',
            '시설팀',
            '재정부',
            '회계팀',
            '감사팀',
            '미래준비부',
            '이음씨드',
            '이음키즈'
        )
        """,
        Integer.class);
assertThat(churchOrganizationCount).isEqualTo(15);
```

- [x] **Step 2: Run RED**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest
```

Expected: `table user_organizations should exist` 또는 `column applications.approval_organization_id should exist` 검증에서 실패한다.

- [x] **Step 3: Add migration**

Create `backend/src/main/resources/db/migration/V4__add_user_organizations_and_approval_organization.sql`.

```sql
create table user_organizations (
    id bigint generated by default as identity primary key,
    user_id bigint not null references users (id),
    organization_id bigint not null references organizations (id),
    primary_flag boolean not null default false,
    sort_order integer not null default 10,
    active boolean not null default true,
    created_at timestamptz not null default current_timestamp,
    unique (user_id, organization_id)
);

create unique index ux_user_organizations_active_primary
    on user_organizations (user_id)
    where primary_flag = true and active = true;

insert into user_organizations (user_id, organization_id, primary_flag, sort_order, active)
select id, organization_id, true, 10, true
from users;

alter table applications
    add column approval_organization_id bigint references organizations (id);

update applications app
set approval_organization_id = users.organization_id
from users
where users.id = app.applicant_id
  and app.approval_organization_id is null;

alter table applications
    alter column approval_organization_id set not null;

insert into organizations (id, name, parent_id, level_no, sort_order, active) values
    (10, '더이음사랑의교회', null, 1, 10, true),
    (11, '예배부', 10, 2, 10, true),
    (12, '총무부', 10, 2, 20, true),
    (13, '재정부', 10, 2, 30, true),
    (14, '미래준비부', 10, 2, 40, true),
    (111, '찬양팀', 11, 3, 10, true),
    (112, '미디어팀', 11, 3, 20, true),
    (113, '새가족팀', 11, 3, 30, true),
    (114, '중보기도팀', 11, 3, 40, true),
    (121, '기획팀', 12, 3, 10, true),
    (122, '시설팀', 12, 3, 20, true),
    (131, '회계팀', 13, 3, 10, true),
    (132, '감사팀', 13, 3, 20, true),
    (141, '이음씨드', 14, 3, 10, true),
    (142, '이음키즈', 14, 3, 20, true);

select setval(pg_get_serial_sequence('organizations', 'id'), (select max(id) from organizations));
select setval(pg_get_serial_sequence('user_organizations', 'id'), (select max(id) from user_organizations));
```

- [x] **Step 4: Run GREEN**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest
```

Expected: `BUILD SUCCESSFUL`.

- [x] **Step 5: Manual checkpoint**

Run:

```bash
git diff -- backend/src/main/resources/db/migration/V4__add_user_organizations_and_approval_organization.sql backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java
```

Expected: 새 마이그레이션과 migration test 변경만 보인다. 커밋하지 않는다.

## Task 2: User Organization Service And Admin API Contract

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java`
- Create: `backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java`
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`

- [x] **Step 1: Write failing service tests**

Create `backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java`.

```java
package com.theieum.approval.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.theieum.approval.common.TestDatabaseHarness;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac"
})
class UserOrganizationServiceTest {

    @Autowired
    private UserOrganizationService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saveMembershipsSynchronizesPrimaryOrganizationMirror() {
        service.saveMemberships(3L, List.of(
                new UserOrganizationService.MembershipCommand(3L, false, true, 10),
                new UserOrganizationService.MembershipCommand(4L, true, true, 20)));

        Long mirroredOrganizationId = jdbcTemplate.queryForObject(
                "select organization_id from users where id = ?",
                Long.class,
                3L);
        assertThat(mirroredOrganizationId).isEqualTo(4L);

        List<UserOrganizationService.MembershipSummary> memberships = service.findMemberships(3L);
        assertThat(memberships)
                .extracting(UserOrganizationService.MembershipSummary::organizationId)
                .containsExactly(3L, 4L);
        assertThat(memberships)
                .filteredOn(UserOrganizationService.MembershipSummary::primary)
                .singleElement()
                .extracting(UserOrganizationService.MembershipSummary::organizationId)
                .isEqualTo(4L);
    }

    @Test
    void saveMembershipsRequiresExactlyOneActivePrimaryMembership() {
        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                        new UserOrganizationService.MembershipCommand(3L, false, true, 10),
                        new UserOrganizationService.MembershipCommand(4L, false, true, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("대표 소속은 정확히 1개");
    }

    @Test
    void saveMembershipsRejectsDuplicateOrganization() {
        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                        new UserOrganizationService.MembershipCommand(3L, true, true, 10),
                        new UserOrganizationService.MembershipCommand(3L, false, true, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("같은 조직을 중복");
    }

    @Test
    void requireActiveMembershipRejectsUnassignedOrganization() {
        assertThatThrownBy(() -> service.requireActiveMembership(3L, 4L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("신청자의 활성 소속이 아닙니다");
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
```

- [x] **Step 2: Run RED**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.user.UserOrganizationServiceTest
```

Expected: `cannot find symbol class UserOrganizationService`.

- [x] **Step 3: Implement service**

Create `backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java`.

```java
package com.theieum.approval.user;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserOrganizationService {

    private final JdbcTemplate jdbcTemplate;

    public UserOrganizationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<MembershipSummary> findMemberships(long userId) {
        return jdbcTemplate.query(
                """
                select uo.organization_id,
                       o.name as organization_name,
                       uo.primary_flag,
                       uo.active,
                       uo.sort_order
                from user_organizations uo
                join organizations o on o.id = uo.organization_id
                where uo.user_id = ?
                order by uo.sort_order asc, uo.id asc
                """,
                (rs, rowNum) -> new MembershipSummary(
                        rs.getLong("organization_id"),
                        rs.getString("organization_name"),
                        rs.getBoolean("primary_flag"),
                        rs.getBoolean("active"),
                        rs.getInt("sort_order")),
                userId);
    }

    @Transactional(readOnly = true)
    public List<ApprovalOrganizationSummary> findActiveApprovalOrganizations(long userId) {
        return jdbcTemplate.query(
                """
                select uo.organization_id,
                       o.name as organization_name,
                       o.parent_id,
                       o.level_no,
                       uo.primary_flag
                from user_organizations uo
                join organizations o on o.id = uo.organization_id
                where uo.user_id = ?
                  and uo.active = true
                  and o.active = true
                order by uo.primary_flag desc, uo.sort_order asc, uo.id asc
                """,
                (rs, rowNum) -> new ApprovalOrganizationSummary(
                        rs.getLong("organization_id"),
                        rs.getString("organization_name"),
                        (Long) rs.getObject("parent_id"),
                        rs.getInt("level_no"),
                        rs.getBoolean("primary_flag")),
                userId);
    }

    @Transactional
    public void saveMemberships(long userId, List<MembershipCommand> memberships) {
        validateMemberships(memberships);
        Long primaryOrganizationId = memberships.stream()
                .filter(MembershipCommand::active)
                .filter(MembershipCommand::primary)
                .map(MembershipCommand::organizationId)
                .findFirst()
                .orElseThrow();

        jdbcTemplate.update("delete from user_organizations where user_id = ?", userId);
        for (MembershipCommand membership : memberships) {
            jdbcTemplate.update(
                    """
                    insert into user_organizations (
                        user_id,
                        organization_id,
                        primary_flag,
                        active,
                        sort_order
                    ) values (?, ?, ?, ?, ?)
                    """,
                    userId,
                    membership.organizationId(),
                    membership.primary(),
                    membership.active(),
                    membership.sortOrder());
        }
        jdbcTemplate.update("update users set organization_id = ? where id = ?", primaryOrganizationId, userId);
    }

    @Transactional(readOnly = true)
    public long requireActiveMembership(long userId, long organizationId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from user_organizations uo
                    join organizations o on o.id = uo.organization_id
                    where uo.user_id = ?
                      and uo.organization_id = ?
                      and uo.active = true
                      and o.active = true
                )
                """,
                Boolean.class,
                userId,
                organizationId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("선택한 조직은 신청자의 활성 소속이 아닙니다.");
        }
        return organizationId;
    }

    private void validateMemberships(List<MembershipCommand> memberships) {
        if (memberships == null || memberships.isEmpty()) {
            throw new IllegalArgumentException("소속 조직은 1개 이상 필요합니다.");
        }
        Set<Long> organizationIds = new HashSet<>();
        int activePrimaryCount = 0;
        for (MembershipCommand membership : memberships) {
            if (!organizationIds.add(membership.organizationId())) {
                throw new IllegalArgumentException("같은 조직을 중복 등록할 수 없습니다.");
            }
            requireActiveOrganization(membership.organizationId());
            if (membership.active() && membership.primary()) {
                activePrimaryCount++;
            }
        }
        if (activePrimaryCount != 1) {
            throw new IllegalArgumentException("활성 대표 소속은 정확히 1개여야 합니다.");
        }
    }

    private void requireActiveOrganization(long organizationId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from organizations
                    where id = ?
                      and active = true
                )
                """,
                Boolean.class,
                organizationId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("Active organization not found: " + organizationId);
        }
    }

    public record MembershipCommand(Long organizationId, boolean primary, boolean active, int sortOrder) {
    }

    public record MembershipSummary(
            Long organizationId,
            String organizationName,
            boolean primary,
            boolean active,
            int sortOrder) {
    }

    public record ApprovalOrganizationSummary(
            Long organizationId,
            String organizationName,
            Long parentId,
            int levelNo,
            boolean primary) {
    }
}
```

- [x] **Step 4: Extend admin controller constructor and user rows**

Modify `AdminController`:

```java
import com.theieum.approval.user.UserOrganizationService;
```

Add field:

```java
private final UserOrganizationService userOrganizationService;
```

Add constructor parameter and assignment:

```java
UserOrganizationService userOrganizationService,
```

```java
this.userOrganizationService = userOrganizationService;
```

Add record:

```java
public record UserOrganizationMembershipRequest(
        @NotNull Long organizationId,
        Boolean primary,
        Boolean active,
        @Positive Integer sortOrder) {
}
```

Extend `CreateUserRequest` and `UpdateUserRequest` with:

```java
List<@Valid UserOrganizationMembershipRequest> organizationMemberships
```

Add helper:

```java
private List<UserOrganizationService.MembershipCommand> membershipCommands(
        Long fallbackOrganizationId,
        List<UserOrganizationMembershipRequest> memberships) {
    if (memberships == null || memberships.isEmpty()) {
        return List.of(new UserOrganizationService.MembershipCommand(fallbackOrganizationId, true, true, 10));
    }
    return memberships.stream()
            .map(membership -> new UserOrganizationService.MembershipCommand(
                    membership.organizationId(),
                    Boolean.TRUE.equals(membership.primary()),
                    membership.active() == null || membership.active(),
                    membership.sortOrder() == null ? 10 : membership.sortOrder()))
            .toList();
}
```

After user insert in `createUser`, call:

```java
userOrganizationService.saveMemberships(
        id,
        membershipCommands(request.organizationId, request.organizationMemberships));
```

After user update in `updateUser`, call:

```java
userOrganizationService.saveMemberships(
        id,
        membershipCommands(request.organizationId, request.organizationMemberships));
```

Change `userRow(long id)` to return `organizationMemberships`:

```java
private Map<String, Object> userRow(long id) {
    Map<String, Object> row = one("""
            select u.id,
                   u.login_id,
                   u.name,
                   u.email,
                   u.organization_id,
                   o.name as organization_name,
                   u.position_id,
                   p.name as position_name,
                   u.roles,
                   u.active
            from users u
            join organizations o on o.id = u.organization_id
            join positions p on p.id = u.position_id
            where u.id = ?
            """, id);
    row.put("organizationMemberships", userOrganizationService.findMemberships(id));
    return row;
}
```

Update `users()` mapping to add memberships to each row:

```java
return jdbcTemplate.queryForList("""
        select u.id,
               u.login_id,
               u.name,
               u.email,
               u.organization_id,
               o.name as organization_name,
               u.position_id,
               p.name as position_name,
               u.roles,
               u.active
        from users u
        join organizations o on o.id = u.organization_id
        join positions p on p.id = u.position_id
        order by u.id asc
        """).stream()
        .peek(row -> row.put(
                "organizationMemberships",
                userOrganizationService.findMemberships(((Number) row.get("id")).longValue())))
        .toList();
```

- [x] **Step 5: Run GREEN**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.user.UserOrganizationServiceTest
```

Expected: `BUILD SUCCESSFUL`.

- [x] **Step 6: Manual checkpoint**

Run:

```bash
git diff -- backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java backend/src/main/java/com/theieum/approval/admin/AdminController.java
```

Expected: 소속 서비스와 관리자 사용자 API 변경만 보인다. 커밋하지 않는다.

## Task 3: Approval Line Resolver With Selected Organization

**Files:**
- Modify: `backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java`
- Modify: `backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java`

- [x] **Step 1: Write failing resolver tests**

Add tests to `ApprovalLineResolverTest`.

```java
@Test
void selectedTeamResolvesApplicantParentAndRootScopes() {
    long approvalTypeId = 201L;
    insertOrganization(210L, "스코프 최상위", null, 1, 210);
    insertOrganization(211L, "스코프 부", 210L, 2, 10);
    insertOrganization(212L, "스코프 팀", 211L, 3, 10);
    insertUser(210L, "scope-root", "최상위결재자", 210L, 5L);
    insertUser(211L, "scope-dept-lead", "부결재자", 211L, 4L);
    insertUser(212L, "scope-team-lead", "팀결재자", 212L, 4L);
    insertUser(213L, "scope-applicant", "겸직신청자", 211L, 1L);
    jdbcTemplate.update("""
            insert into user_organizations (user_id, organization_id, primary_flag, sort_order, active)
            values (?, ?, true, 10, true), (?, ?, false, 20, true)
            """, 213L, 211L, 213L, 212L);
    insertApprovalType(approvalTypeId, "선택 조직 스코프 테스트");
    insertApprovalLine(201L, approvalTypeId, "선택 조직 스코프 결재선");
    insertOrgPositionStep(201L, 201L, 1, "APPLICANT_ORG", 4L);
    insertOrgPositionStep(202L, 201L, 2, "PARENT_ORG", 4L);
    insertOrgPositionStep(203L, 201L, 3, "ROOT_ORG", 5L);

    List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 213L, 212L);

    assertThat(approvers)
            .extracting(ResolvedApprover::userId)
            .containsExactly(212L, 211L, 210L);
}

@Test
void selectedDepartmentDeduplicatesSameRootApprover() {
    long approvalTypeId = 202L;
    insertOrganization(220L, "부 선택 최상위", null, 1, 220);
    insertOrganization(221L, "부 선택 부", 220L, 2, 10);
    insertUser(220L, "department-root", "부선택대표", 220L, 5L);
    insertUser(221L, "department-applicant", "부선택신청자", 221L, 1L);
    jdbcTemplate.update("""
            insert into user_organizations (user_id, organization_id, primary_flag, sort_order, active)
            values (?, ?, true, 10, true)
            """, 221L, 221L);
    insertApprovalType(approvalTypeId, "부 선택 중복 제거 테스트");
    insertApprovalLine(202L, approvalTypeId, "부 선택 중복 제거 결재선");
    insertOrgPositionStep(204L, 202L, 1, "PARENT_ORG", 5L);
    insertOrgPositionStep(205L, 202L, 2, "ROOT_ORG", 5L);

    List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 221L, 221L);

    assertThat(approvers)
            .extracting(ResolvedApprover::userId)
            .containsExactly(220L);
    assertThat(approvers)
            .extracting(ResolvedApprover::stepOrder)
            .containsExactly(1);
}

@Test
void selectedOrganizationMustBeApplicantMembership() {
    assertThatThrownBy(() -> resolver.resolve(1L, 3L, 4L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("신청자의 활성 소속이 아닙니다");
}
```

- [x] **Step 2: Run RED**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.approval.ApprovalLineResolverTest
```

Expected: `method resolve in class ApprovalLineResolver cannot be applied to given types`.

- [x] **Step 3: Update resolver constructor and signature**

Modify `ApprovalLineResolver`.

```java
import java.util.LinkedHashMap;
import java.util.Map;

import com.theieum.approval.user.UserOrganizationService;
```

Add field and constructor parameter:

```java
private final UserOrganizationService userOrganizationService;

public ApprovalLineResolver(EntityManager entityManager, UserOrganizationService userOrganizationService) {
    this.entityManager = entityManager;
    this.userOrganizationService = userOrganizationService;
}
```

Replace public method signature:

```java
public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId, long approvalOrganizationId) {
    Long organizationId = userOrganizationService.requireActiveMembership(applicantId, approvalOrganizationId);
    List<ResolvedApprover> exceptionApprovers = findOrganizationExceptionApprovers(approvalTypeId, organizationId);
    if (!exceptionApprovers.isEmpty()) {
        return deduplicateApprovers(exceptionApprovers);
    }

    ApprovalLine approvalLine = findDefaultApprovalLine(approvalTypeId);
    List<ResolvedApprover> approvers = new ArrayList<>();

    for (ApprovalLineStep step : approvalLine.getSteps()) {
        if (step.getStepType() == ApprovalStepType.DIRECT_USER) {
            approvers.add(resolveDirectUser(step));
        } else if (step.getStepType() == ApprovalStepType.ORG_POSITION) {
            approvers.addAll(resolveOrganizationPosition(step, organizationId));
        }
    }

    List<ResolvedApprover> deduplicated = deduplicateApprovers(approvers);
    if (deduplicated.isEmpty()) {
        throw new IllegalStateException("Approval line has no approvers: " + approvalTypeId);
    }

    return deduplicated;
}
```

Add compatibility method temporarily for call sites that will be changed in Task 4:

```java
public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId) {
    return resolve(approvalTypeId, applicantId, findApplicantOrganizationId(applicantId));
}
```

- [x] **Step 4: Add duplicate removal helper**

Add to `ApprovalLineResolver`.

```java
private List<ResolvedApprover> deduplicateApprovers(List<ResolvedApprover> approvers) {
    Map<Long, ResolvedApprover> byUserId = new LinkedHashMap<>();
    for (ResolvedApprover approver : approvers) {
        byUserId.putIfAbsent(approver.userId(), approver);
    }
    return List.copyOf(byUserId.values());
}
```

- [x] **Step 5: Keep scope resolution behavior**

Keep existing `findParentOrganizationIdOrSelf` and `findRootOrganizationId`. With the current recursive root query, a level 2 department selected as `PARENT_ORG` resolves to level 1, and `ROOT_ORG` also resolves to level 1. The new deduplication helper removes the duplicate approver.

- [x] **Step 6: Run GREEN**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.approval.ApprovalLineResolverTest
```

Expected: `BUILD SUCCESSFUL`.

- [x] **Step 7: Manual checkpoint**

Run:

```bash
git diff -- backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
```

Expected: resolver signature, membership validation, duplicate removal, resolver tests만 보인다. 커밋하지 않는다.

## Task 4: Application Domain And API

**Files:**
- Modify: `backend/src/main/java/com/theieum/approval/application/Application.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`

- [x] **Step 1: Write failing application service tests**

Add to `ApplicationSubmissionTest`.

```java
@Test
void draftStoresSelectedApprovalOrganization() {
    jdbcTemplate.update("""
            insert into user_organizations (user_id, organization_id, primary_flag, sort_order, active)
            values (?, ?, false, 20, true)
            on conflict (user_id, organization_id) do nothing
            """, 3L, 4L);

    Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
            3L,
            1L,
            4L,
            LocalDate.of(2026, 6, 3),
            LocalDate.of(2026, 6, 2),
            "테스트 상점",
            new BigDecimal("12500.00"),
            "겸직 조직 신청"));

    Long approvalOrganizationId = jdbcTemplate.queryForObject(
            "select approval_organization_id from applications where id = ?",
            Long.class,
            application.getId());
    assertThat(approvalOrganizationId).isEqualTo(4L);
}

@Test
void draftRejectsApprovalOrganizationOutsideApplicantMemberships() {
    assertThatThrownBy(() -> applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                    3L,
                    1L,
                    4L,
                    LocalDate.of(2026, 6, 3),
                    LocalDate.of(2026, 6, 2),
                    "테스트 상점",
                    new BigDecimal("12500.00"),
                    "비소속 조직 신청")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("신청자의 활성 소속이 아닙니다");
}
```

Update existing `CreateDraftCommand` calls in this test to include `approvalOrganizationId = 3L`. Example:

```java
Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
        3L,
        1L,
        3L,
        LocalDate.of(2026, 6, 3),
        LocalDate.of(2026, 6, 2),
        "테스트 상점",
        new BigDecimal("12500.00"),
        "점심 식대"));
```

- [x] **Step 2: Run RED**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest
```

Expected: `CreateDraftCommand` constructor arity mismatch or `approval_organization_id` mapping missing.

- [x] **Step 3: Update Application entity**

Modify `Application.java`.

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "approval_organization_id", nullable = false)
private Organization approvalOrganization;
```

Update constructor:

```java
public Application(
        User applicant,
        ApprovalType approvalType,
        Organization approvalOrganization,
        LocalDate applicationDate,
        LocalDate receiptDate,
        String vendor,
        BigDecimal amount,
        String description) {
    this.applicant = applicant;
    this.approvalType = approvalType;
    this.approvalOrganization = approvalOrganization;
    this.applicationDate = applicationDate;
    this.receiptDate = receiptDate;
    this.vendor = vendor;
    this.amount = amount;
    this.description = description;
    this.status = ApplicationStatus.DRAFT;
}
```

Add getter:

```java
public Organization getApprovalOrganization() {
    return approvalOrganization;
}
```

Update draft mutation:

```java
public void updateDraft(
        ApprovalType approvalType,
        Organization approvalOrganization,
        LocalDate applicationDate,
        LocalDate receiptDate,
        String vendor,
        BigDecimal amount,
        String description,
        Instant updatedAt) {
    this.approvalType = approvalType;
    this.approvalOrganization = approvalOrganization;
    this.applicationDate = applicationDate;
    this.receiptDate = receiptDate;
    this.vendor = vendor;
    this.amount = amount;
    this.description = description;
    this.updatedAt = updatedAt;
    if (this.status == ApplicationStatus.CANCELED) {
        this.status = ApplicationStatus.DRAFT;
    }
}
```

- [x] **Step 4: Update ApplicationService command records and create/update logic**

Import:

```java
import com.theieum.approval.organization.Organization;
```

In `createDraft`:

```java
long approvalOrganizationId = userOrganizationService.requireActiveMembership(
        command.applicantId(),
        command.approvalOrganizationId());
Organization approvalOrganization = entityManager.getReference(Organization.class, approvalOrganizationId);

return applicationRepository.save(new Application(
        applicant,
        approvalType,
        approvalOrganization,
        command.applicationDate(),
        command.receiptDate(),
        command.vendor(),
        command.amount(),
        command.description()));
```

In `updateDraft`:

```java
long approvalOrganizationId = userOrganizationService.requireActiveMembership(
        command.actorId(),
        command.approvalOrganizationId());
Organization approvalOrganization = entityManager.getReference(Organization.class, approvalOrganizationId);

application.updateDraft(
        approvalType,
        approvalOrganization,
        command.applicationDate(),
        command.receiptDate(),
        command.vendor(),
        command.amount(),
        command.description(),
        Instant.now());
```

In `previewApprovalLine`:

```java
public List<ApprovalPreviewStep> previewApprovalLine(
        long approvalTypeId,
        long applicantId,
        long approvalOrganizationId) {
    findActiveUser(applicantId);
    List<ResolvedApprover> approvers = approvalLineResolver.resolve(
            approvalTypeId,
            applicantId,
            approvalOrganizationId);
```

In `submit`:

```java
List<ResolvedApprover> approvers = approvalLineResolver.resolve(
        application.getApprovalType().getId(),
        application.getApplicant().getId(),
        application.getApprovalOrganization().getId());
```

Update records:

```java
public record CreateDraftCommand(
        Long applicantId,
        Long approvalTypeId,
        Long approvalOrganizationId,
        LocalDate applicationDate,
        LocalDate receiptDate,
        String vendor,
        BigDecimal amount,
        String description) {
}

public record UpdateDraftCommand(
        Long applicationId,
        Long actorId,
        Long approvalTypeId,
        Long approvalOrganizationId,
        LocalDate applicationDate,
        LocalDate receiptDate,
        String vendor,
        BigDecimal amount,
        String description) {
}
```

- [x] **Step 5: Update ApplicationController**

Inject `UserOrganizationService` into `ApplicationController`.

Add endpoint:

```java
@GetMapping("/approval-organizations")
@Transactional(readOnly = true)
public List<ApprovalOrganizationResponse> approvalOrganizations(@AuthenticationPrincipal AuthenticatedUser user) {
    requireRole(user, "APPLICANT");
    return userOrganizationService.findActiveApprovalOrganizations(user.id()).stream()
            .map(ApprovalOrganizationResponse::from)
            .toList();
}
```

Update preview:

```java
public List<ApprovalPreviewStepResponse> approvalPreview(
        @AuthenticationPrincipal AuthenticatedUser user,
        @RequestParam(defaultValue = "1") long approvalTypeId,
        @RequestParam long approvalOrganizationId) {
    requireRole(user, "APPLICANT");
    return applicationService.previewApprovalLine(approvalTypeId, user.id(), approvalOrganizationId)
            .stream()
            .map(ApprovalPreviewStepResponse::from)
            .toList();
}
```

Extend request:

```java
public static class CreateApplicationRequest {
    public Long approvalTypeId;
    @NotNull
    public Long approvalOrganizationId;
    @NotNull
    public LocalDate receiptDate;
    public LocalDate applicationDate;
    @NotBlank
    public String vendor;
    @NotNull
    public BigDecimal amount;
    @NotBlank
    public String description;
}
```

Pass `request.approvalOrganizationId` into create/update commands.

Add response:

```java
public record ApprovalOrganizationResponse(
        Long id,
        String name,
        Long parentId,
        int levelNo,
        boolean primary) {

    static ApprovalOrganizationResponse from(UserOrganizationService.ApprovalOrganizationSummary summary) {
        return new ApprovalOrganizationResponse(
                summary.organizationId(),
                summary.organizationName(),
                summary.parentId(),
                summary.levelNo(),
                summary.primary());
    }
}
```

Extend `ApplicationResponse` with:

```java
Long approvalOrganizationId,
String approvalOrganizationName,
```

In `toResponse`, map:

```java
application.getApprovalOrganization().getId(),
application.getApprovalOrganization().getName(),
```

- [x] **Step 6: Run GREEN**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest
```

Expected: `BUILD SUCCESSFUL`.

- [x] **Step 7: Run focused backend suite**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test --tests com.theieum.approval.common.DatabaseMigrationTest --tests com.theieum.approval.user.UserOrganizationServiceTest --tests com.theieum.approval.approval.ApprovalLineResolverTest --tests com.theieum.approval.application.ApplicationSubmissionTest
```

Expected: `BUILD SUCCESSFUL`.

## Task 5: Frontend Admin User Memberships

**Files:**
- Modify: `frontend/src/admin/adminTypes.ts`
- Modify: `frontend/src/admin/AdminReferencePage.tsx`
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`

- [x] **Step 1: Add failing admin frontend test**

In `AdminReferencePage.test.tsx`, add a test that opens user edit and verifies membership UI.

```tsx
it('사용자 소속 목록에서 대표 소속과 겸직 소속을 편집한다', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/admin/users' && !init) {
      return jsonResponse([
        {
          id: 3,
          login_id: 'employee01',
          name: '직원01',
          email: 'employee01@theieum.local',
          organization_id: 3,
          organization_name: '개발팀',
          position_id: 1,
          position_name: '사원',
          roles: 'APPLICANT',
          active: true,
          organizationMemberships: [
            { organizationId: 3, organizationName: '개발팀', primary: true, active: true, sortOrder: 10 }
          ]
        }
      ]);
    }
    if (url === '/api/admin/organizations') {
      return jsonResponse([
        { id: 3, name: '개발팀', parent_id: 1, level_no: 2, sort_order: 30, active: true },
        { id: 4, name: '영업팀', parent_id: 1, level_no: 2, sort_order: 40, active: true }
      ]);
    }
    if (url === '/api/admin/positions') {
      return jsonResponse([{ id: 1, name: '사원', rank_order: 10, sort_order: 10, active: true }]);
    }
    if (url === '/api/admin/users/3' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      expect(body.organizationMemberships).toEqual([
        { organizationId: 3, primary: true, active: true, sortOrder: 10 },
        { organizationId: 4, primary: false, active: true, sortOrder: 20 }
      ]);
      return jsonResponse({ id: 3 });
    }
    return jsonResponse([]);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  await userEvent.click(await screen.findByRole('button', { name: '사용자 관리' }));
  await userEvent.click(await screen.findByRole('button', { name: '직원01 수정' }));
  await userEvent.click(screen.getByRole('button', { name: '소속 추가' }));
  await userEvent.selectOptions(screen.getByLabelText('추가 소속 2 조직'), '4');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/3', expect.objectContaining({
    method: 'PUT'
  })));
});
```

- [x] **Step 2: Run RED**

Run:

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx
```

Expected: `소속 추가` 버튼이 없어 실패한다.

- [x] **Step 3: Update admin types**

Modify `frontend/src/admin/adminTypes.ts`.

```ts
export interface AdminUserOrganizationMembership {
  organizationId: number;
  organizationName: string;
  primary: boolean;
  active: boolean;
  sortOrder: number;
}
```

Add to `AdminUser`:

```ts
organizationMemberships?: AdminUserOrganizationMembership[];
```

- [x] **Step 4: Add membership draft helpers**

In `AdminReferencePage.tsx`, add draft key handling.

```ts
type MembershipDraft = {
  organizationId: string;
  primary: boolean;
  active: boolean;
  sortOrder: number;
};

function membershipsFromUser(user: AdminUser): MembershipDraft[] {
  const memberships = user.organizationMemberships?.length
    ? user.organizationMemberships
    : [{
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        primary: true,
        active: true,
        sortOrder: 10
      }];
  return memberships.map((membership) => ({
    organizationId: String(membership.organizationId),
    primary: membership.primary,
    active: membership.active,
    sortOrder: membership.sortOrder
  }));
}

function normalizeMembershipPayload(memberships: MembershipDraft[]) {
  return memberships.map((membership) => ({
    organizationId: Number(membership.organizationId),
    primary: membership.primary,
    active: membership.active,
    sortOrder: membership.sortOrder
  }));
}
```

When opening a user draft, set:

```ts
organizationMemberships: membershipsFromUser(user)
```

When building user payload, send:

```ts
organizationMemberships: normalizeMembershipPayload(draft.organizationMemberships as MembershipDraft[])
```

- [x] **Step 5: Render membership editor**

Inside the user edit form, replace direct `organizationId` select with membership editor. Keep `organizationId` in payload as representative fallback.

```tsx
if (kind === 'users' && field.key === 'organizationId') {
  const memberships = (draft.organizationMemberships as MembershipDraft[] | undefined) ?? [];
  return (
    <div className="admin-field wide-admin-field" key="organizationMemberships">
      <span>소속 조직 <RequiredMark /></span>
      <div className="membership-editor">
        {memberships.map((membership, index) => (
          <div className="membership-row" key={`${membership.organizationId}-${index}`}>
            <SelectField
              label={`${index === 0 ? '대표' : '추가'} 소속 ${index + 1} 조직`}
              required
              value={membership.organizationId}
              options={organizations.map((organization) => ({
                value: String(organization.id),
                label: organization.name
              }))}
              onChange={(value) => updateMembership(index, { organizationId: value })}
            />
            <label className="inline-checkbox">
              <input
                type="radio"
                name="primary-membership"
                checked={membership.primary}
                onChange={() => setPrimaryMembership(index)}
              />
              대표
            </label>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={membership.active}
                onChange={(event) => updateMembership(index, { active: event.target.checked })}
              />
              활성
            </label>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={addMembership}>
          소속 추가
        </button>
      </div>
    </div>
  );
}
```

Add helpers in component:

```ts
function addMembership() {
  const current = (draft.organizationMemberships as MembershipDraft[] | undefined) ?? [];
  updateDraftValue('organizationMemberships', [
    ...current,
    {
      organizationId: String(firstId(organizations)),
      primary: current.length === 0,
      active: true,
      sortOrder: (current.length + 1) * 10
    }
  ]);
}

function updateMembership(index: number, patch: Partial<MembershipDraft>) {
  const current = [...((draft.organizationMemberships as MembershipDraft[] | undefined) ?? [])];
  current[index] = { ...current[index], ...patch };
  updateDraftValue('organizationMemberships', current);
}

function setPrimaryMembership(index: number) {
  const current = ((draft.organizationMemberships as MembershipDraft[] | undefined) ?? [])
    .map((membership, membershipIndex) => ({
      ...membership,
      primary: membershipIndex === index,
      active: membershipIndex === index ? true : membership.active
    }));
  updateDraftValue('organizationMemberships', current);
}
```

- [x] **Step 6: Run GREEN**

Run:

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx
```

Expected: `PASS`.

## Task 6: Frontend Application Approval Organization Selection

**Files:**
- Modify: `frontend/src/applications/applicationTypes.ts`
- Modify: `frontend/src/applications/applicationApi.ts`
- Modify: `frontend/src/applications/ApplicationForm.tsx`
- Modify: `frontend/src/applications/ApplicationForm.test.tsx`

- [x] **Step 1: Add failing application form test**

Add to `ApplicationForm.test.tsx`.

```tsx
it('겸직자는 결재 기준 조직을 선택하고 선택값으로 예상 결재선을 조회한다', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/applications/approval-organizations') {
      return new Response(JSON.stringify([
        { id: 11, name: '예배부', parentId: 10, levelNo: 2, primary: true },
        { id: 122, name: '시설팀', parentId: 12, levelNo: 3, primary: false }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=11') {
      return new Response(JSON.stringify([
        { stepOrder: 1, approver: { id: 20, name: '대표' } }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=122') {
      return new Response(JSON.stringify([
        { stepOrder: 1, approver: { id: 27, name: '시설팀장' } }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  const organizationSelect = await screen.findByLabelText('결재 기준 조직');
  expect(organizationSelect).toHaveValue('11');
  expect(await screen.findByText('대표')).toBeInTheDocument();

  await userEvent.selectOptions(organizationSelect, '122');

  expect(await screen.findByText('시설팀장')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=122',
    expect.anything()
  );
});
```

Update existing preview test URL from:

```ts
'/api/applications/approval-preview?approvalTypeId=1'
```

to:

```ts
'/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3'
```

and mock `/api/applications/approval-organizations`.

- [x] **Step 2: Run RED**

Run:

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

Expected: `결재 기준 조직` select가 없어 실패한다.

- [x] **Step 3: Update application types and API**

Modify `frontend/src/applications/applicationTypes.ts`.

```ts
export interface ApprovalOrganization {
  id: number;
  name: string;
  parentId: number | null;
  levelNo: number;
  primary: boolean;
}
```

Add to `CreateApplicationPayload`:

```ts
approvalOrganizationId: number;
```

Add to `ApplicationResponse`:

```ts
approvalOrganizationId: number;
approvalOrganizationName: string;
```

Modify `frontend/src/applications/applicationApi.ts`.

```ts
import {
  ApplicationResponse,
  ApprovalOrganization,
  ApprovalPreviewStep,
  AttachmentResponse,
  CreateApplicationPayload
} from './applicationTypes';

export function getApprovalOrganizations() {
  return api<ApprovalOrganization[]>('/applications/approval-organizations');
}

export function getApprovalPreview(approvalTypeId = 1, approvalOrganizationId: number) {
  return api<ApprovalPreviewStep[]>(
    `/applications/approval-preview?approvalTypeId=${approvalTypeId}&approvalOrganizationId=${approvalOrganizationId}`
  );
}
```

- [x] **Step 4: Update ApplicationForm state and loading**

In `ApplicationForm.tsx`, import `getApprovalOrganizations`.

```ts
const [approvalOrganizations, setApprovalOrganizations] = useState<ApprovalOrganization[]>([]);
const [approvalOrganizationId, setApprovalOrganizationId] = useState<number | null>(null);
```

Load organizations before preview:

```ts
useEffect(() => {
  let canceled = false;
  async function loadApprovalOrganizations() {
    const organizations = await getApprovalOrganizations();
    if (canceled) {
      return;
    }
    setApprovalOrganizations(organizations);
    const primary = organizations.find((organization) => organization.primary) ?? organizations[0] ?? null;
    setApprovalOrganizationId(primary?.id ?? null);
  }
  void loadApprovalOrganizations();
  return () => {
    canceled = true;
  };
}, []);
```

Change preview effect:

```ts
useEffect(() => {
  if (!approvalOrganizationId) {
    setApprovalPreview([]);
    return;
  }
  let canceled = false;
  async function loadApprovalPreview() {
    setApprovalPreviewError('');
    try {
      const steps = await getApprovalPreview(1, approvalOrganizationId);
      if (!canceled) {
        setApprovalPreview(steps);
      }
    } catch (requestError) {
      if (!canceled) {
        setApprovalPreview([]);
        setApprovalPreviewError(errorMessage(requestError));
      }
    }
  }
  void loadApprovalPreview();
  return () => {
    canceled = true;
  };
}, [approvalOrganizationId]);
```

- [x] **Step 5: Render selector and include payload**

Add selector before date fields:

```tsx
<label>
  <span>결재 기준 조직 <RequiredMark /></span>
  <select
    aria-label="결재 기준 조직"
    value={approvalOrganizationId ?? ''}
    onChange={(event) => setApprovalOrganizationId(Number(event.target.value))}
  >
    {approvalOrganizations.map((organization) => (
      <option key={organization.id} value={organization.id}>
        {organization.primary ? `${organization.name} (대표)` : organization.name}
      </option>
    ))}
  </select>
</label>
```

Include in create/update body:

```ts
if (!approvalOrganizationId) {
  setFormError('결재 기준 조직을 선택하면 제출할 수 있습니다.');
  return;
}

const payload: CreateApplicationPayload = {
  approvalTypeId: 1,
  approvalOrganizationId,
  applicationDate,
  receiptDate,
  vendor,
  amount: Number(amount),
  description
};
```

- [x] **Step 6: Run GREEN**

Run:

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

Expected: `PASS`.

## Task 7: Documentation And Full Verification

**Files:**
- Modify: `docs/admin-user-guide.md`
- Modify: `docs/staging-trial-data-and-attachments.md`
- Modify: `docs/handoff-2026-06-03.md`
- Modify: `docs/handoffs/2026-06-08-task-22-final-user-scenario-check.md` only if the current handoff should point to the new Task 23 planning docs.

- [x] **Step 1: Update docs**

Add this section to `docs/admin-user-guide.md` under 기준정보 관리.

```markdown
### 다중 소속과 대표 소속

사용자 소속은 사용자 관리 화면의 소속 조직 섹션에서 관리한다.

- 대표 소속은 한 사용자당 정확히 1개만 선택한다.
- 겸직 소속은 0개 이상 추가할 수 있다.
- 신청자는 본인의 활성 소속 중 결재 기준 조직을 선택해 신청서를 작성한다.
- `users.organization_id`는 대표 소속 미러 값이며 직접 수정하지 않는다.
```

Add this organization tree paragraph to the same doc:

```text
기본 조직 트리는 다락방을 제외하고 다음 기준정보를 제공한다.

더이음사랑의교회
├─ 예배부
│  ├─ 찬양팀
│  ├─ 미디어팀
│  ├─ 새가족팀
│  └─ 중보기도팀
├─ 총무부
│  ├─ 기획팀
│  └─ 시설팀
├─ 재정부
│  ├─ 회계팀
│  └─ 감사팀
└─ 미래준비부
   ├─ 이음씨드
   └─ 이음키즈
```

- [x] **Step 2: Run backend full tests**

Run:

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test
```

Expected: `BUILD SUCCESSFUL`.

- [x] **Step 3: Run frontend tests and build**

Run:

```bash
cd frontend && npm run test
```

Expected: all Vitest tests pass.

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite production build pass.

- [x] **Step 4: Run common static verification**

Run:

```bash
git diff --check
```

Expected: no output.

Run:

```bash
rg -n "approval-preview\\?approvalTypeId=1([^&]|$)|organization_id.*직접|users\\.organization_id.*수정" backend frontend docs
```

Expected: any matches are either compatibility docs or intentionally updated tests. No stale frontend call should omit `approvalOrganizationId`.

- [x] **Step 5: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: implementation files, plan/spec docs, and any pre-existing user changes are visible. Do not stage or commit automatically.

## Self Review

- Spec coverage: `user_organizations`, `users.organization_id` mirror, migration, church organization tree, admin membership UI, application approval organization selection, resolver scope rules, duplicate approver removal, tests, and docs are covered.
- Placeholder scan: no task uses placeholder markers or open-ended implementation instructions.
- Type consistency: backend uses `approvalOrganizationId`, `organizationMemberships`, `primary_flag` in SQL, and `primary` in API DTOs. Frontend uses `ApprovalOrganization` and `AdminUserOrganizationMembership` consistently.
- Scope check: this plan does not implement people-name seed data, delegation, parallel approval, amount-based lines, or removal of `users.organization_id`.
