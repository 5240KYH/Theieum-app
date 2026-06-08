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
class ApprovalActionTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void approverApprovalMovesToNextStepAndNotifiesNextApprover() {
        long applicationId = submitMultiApproverApplication();
        long firstStepId = stepId(applicationId, 1);

        applicationService.approve(firstStepId, 18L, "확인했습니다");

        assertThat(applicationStatus(applicationId)).isEqualTo("IN_APPROVAL");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("APPROVED");
        assertThat(stepStatus(applicationId, 2)).isEqualTo("PENDING");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", firstStepId)
                .containsEntry("action", "APPROVED")
                .containsEntry("original_approver_id", 18L)
                .containsEntry("actor_id", 18L)
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
    void futureApproverCannotActBeforeCurrentPendingStep() {
        long applicationId = submitMultiApproverApplication();
        long secondStepId = stepId(applicationId, 2);

        assertThatThrownBy(() -> applicationService.approve(secondStepId, 4L, "차례 전 승인"))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only the current approval step can be processed");

        assertThat(applicationStatus(applicationId)).isEqualTo("IN_APPROVAL");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("PENDING");
        assertThat(stepStatus(applicationId, 2)).isEqualTo("PENDING");
        assertThat(histories(applicationId)).isEmpty();
        assertThat(notifications(applicationId)).hasSize(1);
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
    void approvalAutoApprovesApplicantStepWhenItBecomesCurrentAndNotifiesNextApprover() {
        long approvalTypeId = nextId("approval_types");
        long approvalLineId = nextId("approval_lines");
        long firstStepId = nextId("approval_line_steps");
        jdbcTemplate.update(
                "insert into approval_types (id, name, description, active) values (?, ?, ?, true)",
                approvalTypeId,
                "중간 자동승인 테스트",
                "test approval type");
        jdbcTemplate.update(
                "insert into approval_lines (id, approval_type_id, name, active) values (?, ?, ?, true)",
                approvalLineId,
                approvalTypeId,
                "중간 자동승인 결재선");
        jdbcTemplate.update(
                """
                insert into approval_line_steps (
                    id,
                    approval_line_id,
                    step_order,
                    step_type,
                    direct_user_id,
                    sort_policy
                ) values
                    (?, ?, 1, 'DIRECT_USER', 18, 'POSITION_ORDER'),
                    (?, ?, 2, 'DIRECT_USER', 3, 'POSITION_ORDER'),
                    (?, ?, 3, 'DIRECT_USER', 1, 'POSITION_ORDER')
                """,
                firstStepId,
                approvalLineId,
                firstStepId + 1,
                approvalLineId,
                firstStepId + 2,
                approvalLineId);
        Application application = createDraft(approvalTypeId);
        attachDefaultPng(application.getId());
        applicationService.submit(application.getId(), 3L);

        applicationService.approve(stepId(application.getId(), 1), 18L, "확인했습니다");

        assertThat(applicationStatus(application.getId())).isEqualTo("IN_APPROVAL");
        assertThat(stepStatus(application.getId(), 1)).isEqualTo("APPROVED");
        assertThat(stepStatus(application.getId(), 2)).isEqualTo("APPROVED");
        assertThat(stepStatus(application.getId(), 3)).isEqualTo("PENDING");

        List<Map<String, Object>> histories = histories(application.getId());
        assertThat(histories).hasSize(2);
        assertThat(histories.getLast())
                .containsEntry("action", "AUTO_APPROVED")
                .containsEntry("original_approver_id", 3L)
                .containsEntry("actor_id", 3L)
                .containsEntry("admin_override", false)
                .containsEntry("comment", "신청자와 결재자가 동일하여 자동 승인되었습니다.");

        List<Map<String, Object>> notifications = notifications(application.getId());
        assertThat(notifications).hasSize(2);
        assertThat(notifications.getLast())
                .containsEntry("recipient_id", 1L)
                .containsEntry("notification_type", "APPROVAL_REQUESTED");
    }

    @Test
    void approvedApplicationCannotBeRejectedAfterCompletion() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);
        applicationService.approve(stepId, 18L, "승인합니다");

        assertThatThrownBy(() -> applicationService.reject(stepId, 18L, "완료 후 반려"))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only in-approval applications can be approved");

        assertThat(applicationStatus(applicationId)).isEqualTo("APPROVED");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("APPROVED");
        assertThat(histories(applicationId)).hasSize(1);
        assertThat(notifications(applicationId)).hasSize(2);
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
    void rejectedApplicationCannotBeApprovedAfterCompletion() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);
        applicationService.reject(stepId, 18L, "영수증 금액이 맞지 않습니다");

        assertThatThrownBy(() -> applicationService.approve(stepId, 18L, "반려 후 승인"))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only in-approval applications can be approved");

        assertThat(applicationStatus(applicationId)).isEqualTo("REJECTED");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("REJECTED");
        assertThat(histories(applicationId)).hasSize(1);
        assertThat(notifications(applicationId)).hasSize(2);
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
    void managerOverrideRecordsOriginalApproverAndManagerActor() {
        long managerId = createRoleTestUser("process-manager", "MANAGER,APPLICANT");
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);

        applicationService.adminApprove(stepId, managerId, "결재자 부재로 매니저 예외 승인");

        assertThat(applicationStatus(applicationId)).isEqualTo("APPROVED");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("ADMIN_APPROVED");

        List<Map<String, Object>> histories = histories(applicationId);
        assertThat(histories).hasSize(1);
        assertThat(histories.getFirst())
                .containsEntry("approval_step_id", stepId)
                .containsEntry("action", "ADMIN_APPROVED")
                .containsEntry("original_approver_id", 18L)
                .containsEntry("actor_id", managerId)
                .containsEntry("admin_override", true)
                .containsEntry("admin_reason", "결재자 부재로 매니저 예외 승인");
    }

    @Test
    void adminOverrideOnIntermediateStepNotifiesApplicantAndNextApprover() {
        long applicationId = submitMultiApproverApplication();
        long stepId = stepId(applicationId, 1);

        applicationService.adminApprove(stepId, 1L, "결재자 부재로 관리자 예외 승인");

        assertThat(applicationStatus(applicationId)).isEqualTo("IN_APPROVAL");
        assertThat(stepStatus(applicationId, 1)).isEqualTo("ADMIN_APPROVED");
        assertThat(stepStatus(applicationId, 2)).isEqualTo("PENDING");

        List<Map<String, Object>> notifications = notifications(applicationId);
        assertThat(notifications).hasSize(3);
        assertThat(notifications.get(1))
                .containsEntry("recipient_id", 3L)
                .containsEntry("notification_type", "ADMIN_APPROVED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
        assertThat(notifications.get(2))
                .containsEntry("recipient_id", 4L)
                .containsEntry("notification_type", "APPROVAL_REQUESTED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
    }

    @Test
    void adminOverrideCannotActOnCompletedApplication() {
        long applicationId = submitDefaultApplication();
        long stepId = stepId(applicationId, 1);
        applicationService.approve(stepId, 18L, "승인합니다");

        assertThatThrownBy(() -> applicationService.adminApprove(stepId, 1L, "완료 후 예외 승인"))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only in-approval applications can be approved");
    }

    private long submitDefaultApplication() {
        Application application = createDraft(1L);
        attachDefaultPng(application.getId());
        applicationService.submit(application.getId(), 3L);
        return application.getId();
    }

    private long submitMultiApproverApplication() {
        long approvalTypeId = nextId("approval_types");
        long approvalLineId = nextId("approval_lines");
        long approvalLineStepId = nextId("approval_line_steps");
        jdbcTemplate.update(
                "insert into approval_types (id, name, description, active) values (?, ?, ?, true)",
                approvalTypeId,
                "다중 결재자 액션 테스트",
                "test approval type");
        jdbcTemplate.update(
                "insert into approval_lines (id, approval_type_id, name, active) values (?, ?, ?, true)",
                approvalLineId,
                approvalTypeId,
                "다중 결재자 결재선");
        jdbcTemplate.update(
                """
                insert into approval_line_steps (
                    id,
                    approval_line_id,
                    step_order,
                    step_type,
                    direct_user_id,
                    sort_policy
                ) values
                    (?, ?, 1, 'DIRECT_USER', 18, 'POSITION_ORDER'),
                    (?, ?, 2, 'DIRECT_USER', 4, 'POSITION_ORDER')
                """,
                approvalLineStepId,
                approvalLineId,
                approvalLineStepId + 1,
                approvalLineId);
        Application application = createDraft(approvalTypeId);
        attachDefaultPng(application.getId());
        applicationService.submit(application.getId(), 3L);
        return application.getId();
    }

    private long createRoleTestUser(String loginId, String roles) {
        return jdbcTemplate.queryForObject(
                """
                insert into users (
                    login_id,
                    external_subject,
                    password_hash,
                    name,
                    email,
                    organization_id,
                    position_id,
                    roles,
                    active
                ) values (?, null, 'test-password-hash', ?, ?, 3, 1, ?, true)
                returning id
                """,
                Long.class,
                loginId,
                loginId,
                loginId + "@theieum.local",
                roles);
    }

    private long nextId(String tableName) {
        Long maxId = jdbcTemplate.queryForObject("select coalesce(max(id), 0) from " + tableName, Long.class);
        return maxId + 1;
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
