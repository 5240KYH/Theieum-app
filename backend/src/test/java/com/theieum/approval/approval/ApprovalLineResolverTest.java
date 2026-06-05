package com.theieum.approval.approval;

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

import com.theieum.approval.approval.ApprovalLineResolver.ResolvedApprover;
import com.theieum.approval.common.TestDatabaseHarness;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac"
})
class ApprovalLineResolverTest {

    @Autowired
    private ApprovalLineResolver resolver;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void directUserStepsKeepConfiguredOrder() {
        long approvalTypeId = 101L;
        insertApprovalType(approvalTypeId, "직접 결재자 순서 테스트");
        insertApprovalLine(101L, approvalTypeId, "직접 결재자 결재선");
        insertDirectUserStep(101L, 101L, 1, 18L);
        insertDirectUserStep(102L, 101L, 2, 20L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 3L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(18L, 20L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1, 2);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(ApprovalStepType.DIRECT_USER, ApprovalStepType.DIRECT_USER);
    }

    @Test
    void organizationExceptionOverridesDefaultLine() {
        List<ResolvedApprover> approvers = resolver.resolve(1L, 3L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(18L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(2);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(ApprovalStepType.DIRECT_USER);
    }

    @Test
    void organizationPositionStepUsesPositionOrder() {
        long approvalTypeId = 102L;
        insertOrganization(120L, "조직 직위 정렬 테스트팀", 1L, 2, 120);
        insertUser(120L, "org-position-member-1", "조직직위1", 120L, 1L);
        insertUser(121L, "org-position-member-2", "조직직위2", 120L, 1L);
        insertUser(122L, "org-position-member-3", "조직직위3", 120L, 1L);
        insertApprovalType(approvalTypeId, "조직 직위 정렬 테스트");
        insertApprovalLine(102L, approvalTypeId, "조직 직위 결재선");
        insertOrgPositionStep(103L, 102L, 1, 1L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 120L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(120L, 121L, 122L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1, 1, 1);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(
                        ApprovalStepType.ORG_POSITION,
                        ApprovalStepType.ORG_POSITION,
                        ApprovalStepType.ORG_POSITION);
    }

    @Test
    void parentOrganizationScopeUsesImmediateParentOrganization() {
        long approvalTypeId = 106L;
        insertOrganization(130L, "상위 조직 테스트팀", 1L, 2, 130);
        insertOrganization(131L, "하위 조직 테스트파트", 130L, 3, 10);
        insertUser(130L, "parent-team-lead", "상위팀장", 130L, 4L);
        insertUser(131L, "part-member", "파트원", 131L, 1L);
        insertApprovalType(approvalTypeId, "상위 조직 결재선 테스트");
        insertApprovalLine(107L, approvalTypeId, "상위 조직 팀장 결재선");
        insertOrgPositionStep(110L, 107L, 1, "PARENT_ORG", 4L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 131L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(130L);
    }

    @Test
    void rootOrganizationScopeUsesTopLevelOrganizationFromAnyDepth() {
        long approvalTypeId = 107L;
        insertOrganization(140L, "최상위 조직 테스트본부", null, 1, 140);
        insertOrganization(141L, "최상위 조직 테스트팀", 140L, 2, 10);
        insertOrganization(142L, "최상위 조직 테스트파트", 141L, 3, 10);
        insertUser(140L, "root-representative", "최상위대표", 140L, 5L);
        insertUser(142L, "part-member-root", "파트원2", 142L, 1L);
        insertApprovalType(approvalTypeId, "최상위 조직 결재선 테스트");
        insertApprovalLine(108L, approvalTypeId, "최상위 조직 대표 결재선");
        insertOrgPositionStep(111L, 108L, 1, "ROOT_ORG", 5L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 142L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(140L);
    }

    @Test
    void orgPositionStepWithoutMatchingApproverFailsLineResolution() {
        long approvalTypeId = 103L;
        insertApprovalType(approvalTypeId, "빈 조직 직위 단계 테스트");
        insertApprovalLine(103L, approvalTypeId, "빈 조직 직위 결재선");
        insertDirectUserStep(104L, 103L, 1, 18L);
        insertOrgPositionStep(105L, 103L, 2, 5L);
        insertDirectUserStep(106L, 103L, 3, 20L);

        assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ORG_POSITION step has no active approvers");
    }

    @Test
    void inactiveDirectUserStepFailsLineResolution() {
        long approvalTypeId = 104L;
        insertApprovalType(approvalTypeId, "비활성 직접 결재자 테스트");
        insertApprovalLine(104L, approvalTypeId, "비활성 직접 결재선");
        insertDirectUserStep(107L, 104L, 1, 18L);
        jdbcTemplate.update("update users set active = false where id = ?", 18L);

        try {
            assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("DIRECT_USER step has no active direct user");
        } finally {
            jdbcTemplate.update("update users set active = true where id = ?", 18L);
        }
    }

    @Test
    void inactiveOrganizationExceptionFailsLineResolution() {
        jdbcTemplate.update("update users set active = false where id = ?", 18L);

        try {
            assertThatThrownBy(() -> resolver.resolve(1L, 3L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Organization exception has no active approver");
        } finally {
            jdbcTemplate.update("update users set active = true where id = ?", 18L);
        }
    }

    @Test
    void multipleActiveDefaultLinesFailLineResolution() {
        long approvalTypeId = 105L;
        insertApprovalType(approvalTypeId, "중복 기본 결재선 테스트");
        insertApprovalLine(105L, approvalTypeId, "첫 번째 결재선");
        insertApprovalLine(106L, approvalTypeId, "두 번째 결재선");
        insertDirectUserStep(108L, 105L, 1, 18L);
        insertDirectUserStep(109L, 106L, 1, 20L);

        assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Multiple active approval lines found");
    }

    private void insertApprovalType(long id, String name) {
        jdbcTemplate.update(
                "insert into approval_types (id, name, description, active) values (?, ?, ?, true)",
                id,
                name,
                "test approval type");
    }

    private void insertApprovalLine(long id, long approvalTypeId, String name) {
        jdbcTemplate.update(
                "insert into approval_lines (id, approval_type_id, name, active) values (?, ?, ?, true)",
                id,
                approvalTypeId,
                name);
    }

    private void insertDirectUserStep(long id, long approvalLineId, int stepOrder, long directUserId) {
        jdbcTemplate.update(
                """
                insert into approval_line_steps (
                    id,
                    approval_line_id,
                    step_order,
                    step_type,
                    direct_user_id,
                    sort_policy
                ) values (?, ?, ?, 'DIRECT_USER', ?, 'POSITION_ORDER')
                """,
                id,
                approvalLineId,
                stepOrder,
                directUserId);
    }

    private void insertOrgPositionStep(long id, long approvalLineId, int stepOrder, long positionId) {
        insertOrgPositionStep(id, approvalLineId, stepOrder, "APPLICANT_ORG", positionId);
    }

    private void insertOrgPositionStep(
            long id,
            long approvalLineId,
            int stepOrder,
            String organizationScope,
            long positionId) {
        jdbcTemplate.update(
                """
                insert into approval_line_steps (
                    id,
                    approval_line_id,
                    step_order,
                    step_type,
                    organization_scope,
                    position_id,
                    sort_policy
                ) values (?, ?, ?, 'ORG_POSITION', ?, ?, 'POSITION_ORDER')
                """,
                id,
                approvalLineId,
                stepOrder,
                organizationScope,
                positionId);
    }

    private void insertOrganization(long id, String name, Long parentId, int levelNo, int sortOrder) {
        jdbcTemplate.update(
                """
                insert into organizations (id, name, parent_id, level_no, sort_order, active)
                values (?, ?, ?, ?, ?, true)
                """,
                id,
                name,
                parentId,
                levelNo,
                sortOrder);
    }

    private void insertUser(long id, String loginId, String name, long organizationId, long positionId) {
        jdbcTemplate.update(
                """
                insert into users (
                    id,
                    login_id,
                    external_subject,
                    password_hash,
                    name,
                    email,
                    organization_id,
                    position_id,
                    roles,
                    active
                ) values (?, ?, null, ?, ?, ?, ?, ?, 'APPLICANT', true)
                """,
                id,
                loginId,
                "$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW",
                name,
                loginId + "@theieum.local",
                organizationId,
                positionId);
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
