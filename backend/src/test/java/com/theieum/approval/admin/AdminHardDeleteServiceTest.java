package com.theieum.approval.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.theieum.approval.common.ResourceNotFoundException;
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
    void hardDeleteUserRemovesUnusedUser() {
        long userId = createUser("delete-user-target", 2L, 2L, "APPLICANT");

        service.hardDeleteUser(userId);

        assertThat(count("select count(*) from users where id = ?", userId)).isZero();
    }

    @Test
    void hardDeleteUserRejectsReferencesBeforeDeleting() {
        long userId = createUser("referenced-user-target", 2L, 2L, "APPLICANT");
        jdbcTemplate.update("""
                insert into applications (
                    applicant_id, approval_type_id, application_date, receipt_date,
                    vendor, amount, description, status
                ) values (?, 1, ?, ?, '테스트 가맹점', 1000, '참조 테스트', 'DRAFT')
                """, userId, LocalDate.now(), LocalDate.now());

        assertThatThrownBy(() -> service.hardDeleteUser(userId))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("사용 중인 사용자");

        assertThat(count("select count(*) from users where id = ?", userId)).isOne();
    }

    @Test
    void hardDeleteOrganizationRejectsChildOrganizations() {
        assertThatThrownBy(() -> service.hardDeleteOrganization(1L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("하위 조직");
    }

    @Test
    void hardDeleteOrganizationRemovesUnusedOrganization() {
        long organizationId = jdbcTemplate.queryForObject("""
                insert into organizations (name, parent_id, level_no, sort_order, active)
                values ('삭제 대상 조직', null, 1, 999, true)
                returning id
                """, Long.class);

        service.hardDeleteOrganization(organizationId);

        assertThat(count("select count(*) from organizations where id = ?", organizationId)).isZero();
    }

    @Test
    void hardDeletePositionRejectsUserAndApprovalLineStepReferences() {
        assertThatThrownBy(() -> service.hardDeletePosition(4L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("사용자가 있거나 결재선에서 사용 중인 직위");
    }

    @Test
    void hardDeletePositionRemovesUnusedPosition() {
        long positionId = jdbcTemplate.queryForObject("""
                insert into positions (name, rank_order, sort_order, active)
                values ('삭제 대상 직위', 999, 999, true)
                returning id
                """, Long.class);

        service.hardDeletePosition(positionId);

        assertThat(count("select count(*) from positions where id = ?", positionId)).isZero();
    }

    @Test
    void hardDeleteApprovalLineRemovesStepsBeforeLine() {
        long lineId = jdbcTemplate.queryForObject("""
                insert into approval_lines (approval_type_id, name, active)
                values (1, '삭제 대상 결재선', true)
                returning id
                """, Long.class);
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
        long exceptionId = jdbcTemplate.queryForObject("""
                insert into approval_org_exceptions (
                    approval_type_id, organization_id, approver_user_id, step_order, active
                ) values (1, 3, 18, 1, true)
                returning id
                """, Long.class);

        service.hardDeleteApprovalOrgException(exceptionId);

        assertThat(count("select count(*) from approval_org_exceptions where id = ?", exceptionId)).isZero();
    }

    @Test
    void hardDeleteMissingTargetThrowsResourceNotFound() {
        assertThatThrownBy(() -> service.hardDeleteApprovalLine(999_999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Approval line not found");
    }

    private long createUser(String loginId, long organizationId, long positionId, String roles) {
        return jdbcTemplate.queryForObject("""
                insert into users (
                    login_id, password_hash, name, email, organization_id, position_id, roles, active
                ) values (?, 'test-password-hash', ?, ?, ?, ?, ?, true)
                returning id
                """,
                Long.class,
                loginId,
                loginId,
                loginId + "@theieum.local",
                organizationId,
                positionId,
                roles);
    }

    private int count(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
