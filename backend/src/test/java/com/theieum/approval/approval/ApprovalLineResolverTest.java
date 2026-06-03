package com.theieum.approval.approval;

import static org.assertj.core.api.Assertions.assertThat;

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
    }

    @Test
    void organizationExceptionOverridesDefaultLine() {
        List<ResolvedApprover> approvers = resolver.resolve(1L, 3L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(18L);
    }

    @Test
    void organizationPositionStepUsesPositionOrder() {
        long approvalTypeId = 102L;
        insertApprovalType(approvalTypeId, "조직 직위 정렬 테스트");
        insertApprovalLine(102L, approvalTypeId, "조직 직위 결재선");
        insertOrgPositionStep(103L, 102L, 1, 1L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 3L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsSubsequence(3L, 5L, 7L, 18L);
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
                ) values (?, ?, ?, 'ORG_POSITION', 'APPLICANT_ORG', ?, 'POSITION_ORDER')
                """,
                id,
                approvalLineId,
                stepOrder,
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
