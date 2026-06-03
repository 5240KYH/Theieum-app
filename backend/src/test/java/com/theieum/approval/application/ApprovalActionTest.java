package com.theieum.approval.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
})
class ApprovalActionTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void approverApprovalMovesToNextStepAndNotifiesNextApprover() {
        long applicationId = submitMultiApproverApplication();
        long firstStepId = stepId(applicationId, 1);

        applicationService.approve(firstStepId, 3L, "확인했습니다");

        assertThat(applicationStatus(applicationId)).isEqualTo("IN_APPROVAL");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("APPROVED");
        assertThat(stepStatus(applicationId, 2)).isEqualTo("PENDING");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", firstStepId)
                .containsEntry("action", "APPROVED")
                .containsEntry("original_approver_id", 3L)
                .containsEntry("actor_id", 3L)
                .containsEntry("admin_override", false)
                .containsEntry("comment", "확인했습니다");

        List<Map<String, Object>> notifications = notifications(applicationId);
        assertThat(notifications).hasSize(2);
        assertThat(notifications.getLast())
                .containsEntry("recipient_id", 4L)
                .containsEntry("notification_type", "APPROVAL_REQUESTED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
    }

    @Test
    void lastApprovalCompletesApplicationAndNotifiesApplicant() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);

        applicationService.approve(stepId, 18L, "승인합니다");

        assertThat(applicationStatus(applicationId)).isEqualTo("APPROVED");
        assertThat(applicationCompletedAt(applicationId)).isNotNull();
        assertThat(stepStatus(applicationId, 1)).isEqualTo("APPROVED");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", stepId)
                .containsEntry("action", "APPROVED")
                .containsEntry("original_approver_id", 18L)
                .containsEntry("actor_id", 18L)
                .containsEntry("admin_override", false);

        List<Map<String, Object>> notifications = notifications(applicationId);
        assertThat(notifications).hasSize(2);
        assertThat(notifications.getLast())
                .containsEntry("recipient_id", 3L)
                .containsEntry("notification_type", "APPLICATION_APPROVED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
    }

    @Test
    void rejectionRejectsApplicationAndNotifiesApplicant() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);

        applicationService.reject(stepId, 18L, "영수증 금액이 맞지 않습니다");

        assertThat(applicationStatus(applicationId)).isEqualTo("REJECTED");
        assertThat(applicationCompletedAt(applicationId)).isNotNull();
        assertThat(stepStatus(applicationId, 1)).isEqualTo("REJECTED");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", stepId)
                .containsEntry("action", "REJECTED")
                .containsEntry("original_approver_id", 18L)
                .containsEntry("actor_id", 18L)
                .containsEntry("admin_override", false)
                .containsEntry("comment", "영수증 금액이 맞지 않습니다");

        List<Map<String, Object>> notifications = notifications(applicationId);
        assertThat(notifications).hasSize(2);
        assertThat(notifications.getLast())
                .containsEntry("recipient_id", 3L)
                .containsEntry("notification_type", "APPLICATION_REJECTED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
    }

    @Test
    void adminOverrideRequiresReasonAndRecordsOriginalApprover() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);

        assertThatThrownBy(() -> applicationService.adminApprove(stepId, 1L, " "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admin approval reason is required");

        applicationService.adminApprove(stepId, 1L, "결재자 부재로 관리자 예외 승인");

        assertThat(applicationStatus(applicationId)).isEqualTo("APPROVED");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("ADMIN_APPROVED");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", stepId)
                .containsEntry("action", "ADMIN_APPROVED")
                .containsEntry("original_approver_id", 18L)
                .containsEntry("actor_id", 1L)
                .containsEntry("admin_override", true)
                .containsEntry("admin_reason", "결재자 부재로 관리자 예외 승인");
    }

    @Test
    void adminOverrideCannotActOnCompletedApplication() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);
        applicationService.approve(stepId, 18L, "승인합니다");

        assertThatThrownBy(() -> applicationService.adminApprove(stepId, 1L, "완료 후 예외 승인"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only in-approval applications can be approved");
    }

    private long submitDefaultApplication() {
        Application application = createDraft(1L);
        attachDefaultPng(application.getId());
        applicationService.submit(application.getId(), 3L);
        return application.getId();
    }

    private long submitMultiApproverApplication() {
        long approvalTypeId = 301L;
        jdbcTemplate.update(
                "insert into approval_types (id, name, description, active) values (?, ?, ?, true)",
                approvalTypeId,
                "다중 결재자 액션 테스트",
                "test approval type");
        jdbcTemplate.update(
                "insert into approval_lines (id, approval_type_id, name, active) values (?, ?, ?, true)",
                301L,
                approvalTypeId,
                "다중 결재자 결재선");
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
                301L,
                301L,
                1,
                1L);
        Application application = createDraft(approvalTypeId);
        attachDefaultPng(application.getId());
        applicationService.submit(application.getId(), 3L);
        return application.getId();
    }

    private Application createDraft(long approvalTypeId) {
        return applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                approvalTypeId,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
    }

    private void attachDefaultPng(long applicationId) {
        applicationService.attachReceiptImage(
                applicationId,
                3L,
                "receipt.png",
                "image/png",
                pngBytes());
    }

    private long stepId(long applicationId, int stepOrder) {
        return jdbcTemplate.queryForObject(
                """
                select id
                from application_approval_steps
                where application_id = ? and step_order = ?
                """,
                Long.class,
                applicationId,
                stepOrder);
    }

    private String stepStatus(long applicationId, int stepOrder) {
        return jdbcTemplate.queryForObject(
                """
                select status
                from application_approval_steps
                where application_id = ? and step_order = ?
                """,
                String.class,
                applicationId,
                stepOrder);
    }

    private String applicationStatus(long applicationId) {
        return jdbcTemplate.queryForObject(
                "select status from applications where id = ?",
                String.class,
                applicationId);
    }

    private Object applicationCompletedAt(long applicationId) {
        return jdbcTemplate.queryForObject(
                "select completed_at from applications where id = ?",
                Object.class,
                applicationId);
    }

    private List<Map<String, Object>> histories(long applicationId) {
        return jdbcTemplate.queryForList(
                """
                select approval_step_id, action, original_approver_id, actor_id, admin_override, admin_reason, comment
                from approval_histories
                where application_id = ?
                order by id asc
                """,
                applicationId);
    }

    private List<Map<String, Object>> notifications(long applicationId) {
        return jdbcTemplate.queryForList(
                """
                select recipient_id, application_id, notification_type, channel, status
                from notification_events
                where application_id = ?
                order by id asc
                """,
                applicationId);
    }

    private byte[] pngBytes() {
        return new byte[] {
                (byte) 0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a,
                0x00
        };
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
