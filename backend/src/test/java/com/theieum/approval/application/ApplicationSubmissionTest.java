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
        "app.file-storage.root-path=/private/tmp/theieum-approval-test",
        "app.attachments.max-files-per-application=10"
})
class ApplicationSubmissionTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void submitApplicationCreatesApprovalSnapshotAndFirstNotification() {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        applicationService.attachReceiptImage(
                application.getId(),
                3L,
                "receipt.png",
                "image/png",
                pngBytes());

        Application submitted = applicationService.submit(application.getId(), 3L);

        assertThat(submitted.getStatus()).isEqualTo(ApplicationStatus.IN_APPROVAL);
        assertThat(submitted.getSubmittedAt()).isNotNull();

        String filePath = jdbcTemplate.queryForObject(
                "select file_path from attachments where application_id = ?",
                String.class,
                application.getId());
        assertThat(filePath).startsWith("/private/tmp/theieum-approval-test/");

        List<Map<String, Object>> steps = jdbcTemplate.queryForList(
                """
                select step_order, original_approver_id, status
                from application_approval_steps
                where application_id = ?
                order by step_order asc
                """,
                application.getId());
        assertThat(steps).hasSize(1);
        assertThat(steps.getFirst())
                .containsEntry("step_order", 1)
                .containsEntry("original_approver_id", 18L)
                .containsEntry("status", "PENDING");

        List<Map<String, Object>> notifications = jdbcTemplate.queryForList(
                """
                select recipient_id, application_id, notification_type, channel, status, read_flag
                from notification_events
                where application_id = ?
                """,
                application.getId());
        assertThat(notifications).hasSize(1);
        assertThat(notifications.getFirst())
                .containsEntry("recipient_id", 18L)
                .containsEntry("application_id", application.getId())
                .containsEntry("notification_type", "APPROVAL_REQUESTED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED")
                .containsEntry("read_flag", false);
    }

    @Test
    void submitApplicationRequiresReceiptImage() {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));

        assertThatThrownBy(() -> applicationService.submit(application.getId(), 3L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Receipt image attachment is required");
    }

    @Test
    void nonApplicantCannotAttachReceiptImage() {
        Application application = createDefaultDraft();

        assertThatThrownBy(() -> applicationService.attachReceiptImage(
                        application.getId(),
                        4L,
                        "receipt.png",
                        "image/png",
                        pngBytes()))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("Only the applicant can attach receipts");
    }

    @Test
    void emptyReceiptImageIsRejected() {
        Application application = createDefaultDraft();

        assertThatThrownBy(() -> applicationService.attachReceiptImage(
                        application.getId(),
                        3L,
                        "receipt.png",
                        "image/png",
                        new byte[] {}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Receipt attachment must not be empty");
    }

    @Test
    void mismatchedReceiptImageSignatureIsRejected() {
        Application application = createDefaultDraft();

        assertThatThrownBy(() -> applicationService.attachReceiptImage(
                        application.getId(),
                        3L,
                        "receipt.png",
                        "image/png",
                        new byte[] {1, 2, 3, 4}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Receipt attachment content does not match image type");
    }

    @Test
    void nonImageAttachmentIsRejected() {
        Application application = createDefaultDraft();

        assertThatThrownBy(() -> applicationService.attachReceiptImage(
                        application.getId(),
                        3L,
                        "receipt.txt",
                        "text/plain",
                        new byte[] {1, 2, 3, 4}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Receipt attachment must be an image");
    }

    @Test
    void draftAllowsTenReceiptImagesAndRejectsEleventh() {
        Application application = createDefaultDraft();
        for (int index = 1; index <= 10; index++) {
            applicationService.attachReceiptImage(
                    application.getId(),
                    3L,
                    "receipt-" + index + ".png",
                    "image/png",
                    pngBytes());
        }

        assertThatThrownBy(() -> applicationService.attachReceiptImage(
                        application.getId(),
                        3L,
                        "receipt-11.png",
                        "image/png",
                        pngBytes()))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Receipt attachment limit exceeded");

        Integer attachmentCount = jdbcTemplate.queryForObject(
                "select count(*) from attachments where application_id = ?",
                Integer.class,
                application.getId());
        assertThat(attachmentCount).isEqualTo(10);
    }

    @Test
    void submittedApplicationCannotBeSubmittedAgain() {
        Application application = createDefaultDraft();
        attachDefaultPng(application.getId(), 3L);

        applicationService.submit(application.getId(), 3L);

        assertThatThrownBy(() -> applicationService.submit(application.getId(), 3L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only draft applications can be submitted");

        Integer stepCount = jdbcTemplate.queryForObject(
                "select count(*) from application_approval_steps where application_id = ?",
                Integer.class,
                application.getId());
        Integer notificationCount = jdbcTemplate.queryForObject(
                "select count(*) from notification_events where application_id = ?",
                Integer.class,
                application.getId());
        assertThat(stepCount).isEqualTo(1);
        assertThat(notificationCount).isEqualTo(1);
    }

    @Test
    void nonApplicantCannotSubmitDraft() {
        Application application = createDefaultDraft();
        attachDefaultPng(application.getId(), 3L);

        assertThatThrownBy(() -> applicationService.submit(application.getId(), 4L))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("Only the applicant can submit this application");

        assertThat(applicationStatus(application.getId())).isEqualTo("DRAFT");
        assertThat(rowCount("application_approval_steps", application.getId())).isZero();
        assertThat(rowCount("notification_events", application.getId())).isZero();
    }

    @Test
    void canceledApplicationMustBeRevisedBeforeSubmit() {
        Application application = createDefaultDraft();
        attachDefaultPng(application.getId(), 3L);
        applicationService.cancelDraft(application.getId(), 3L);

        assertThatThrownBy(() -> applicationService.submit(application.getId(), 3L))
                .isInstanceOf(WorkflowConflictException.class)
                .hasMessageContaining("Only draft applications can be submitted");

        assertThat(applicationStatus(application.getId())).isEqualTo("CANCELED");
        assertThat(rowCount("application_approval_steps", application.getId())).isZero();
        assertThat(rowCount("notification_events", application.getId())).isZero();

        applicationService.updateDraft(new ApplicationService.UpdateDraftCommand(
                application.getId(),
                3L,
                1L,
                LocalDate.of(2026, 6, 4),
                LocalDate.of(2026, 6, 3),
                "재작성 상점",
                new BigDecimal("22000.00"),
                "취소 후 재작성"));

        Application submitted = applicationService.submit(application.getId(), 3L);

        assertThat(submitted.getStatus()).isEqualTo(ApplicationStatus.IN_APPROVAL);
        assertThat(rowCount("application_approval_steps", application.getId())).isOne();
        assertThat(rowCount("notification_events", application.getId())).isOne();
    }

    @Test
    void submitApplicationRenumbersMultiApproverResolverStepsForSnapshot() {
        long approvalTypeId = 201L;
        jdbcTemplate.update(
                """
                insert into organizations (id, name, parent_id, level_no, sort_order, active)
                values (?, ?, 1, 2, 90, true)
                """,
                301L,
                "다중 결재자 테스트팀");
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
                ) values
                    (?, 'multi-step-applicant-1', null, 'test-password-hash', '다중결재신청자1', 'multi-step-applicant-1@test.local', ?, 1, 'APPLICANT,APPROVER', true),
                    (?, 'multi-step-applicant-2', null, 'test-password-hash', '다중결재신청자2', 'multi-step-applicant-2@test.local', ?, 1, 'APPLICANT,APPROVER', true),
                    (?, 'multi-step-applicant-3', null, 'test-password-hash', '다중결재신청자3', 'multi-step-applicant-3@test.local', ?, 1, 'APPLICANT,APPROVER', true)
                """,
                301L,
                301L,
                302L,
                301L,
                303L,
                301L);
        jdbcTemplate.update(
                "insert into approval_types (id, name, description, active) values (?, ?, ?, true)",
                approvalTypeId,
                "다중 결재자 제출 테스트",
                "test approval type");
        jdbcTemplate.update(
                "insert into approval_lines (id, approval_type_id, name, active) values (?, ?, ?, true)",
                201L,
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
                201L,
                201L,
                1,
                1L);
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                301L,
                approvalTypeId,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        applicationService.attachReceiptImage(
                application.getId(),
                301L,
                "receipt.png",
                "image/png",
                pngBytes());

        applicationService.submit(application.getId(), 301L);

        List<Map<String, Object>> steps = jdbcTemplate.queryForList(
                """
                select step_order, original_approver_id, status
                from application_approval_steps
                where application_id = ?
                order by step_order asc
                """,
                application.getId());
        assertThat(steps).hasSize(3);
        assertThat(steps)
                .extracting(step -> step.get("step_order"))
                .containsExactly(1, 2, 3);
        assertThat(steps)
                .extracting(step -> step.get("original_approver_id"))
                .containsExactly(301L, 302L, 303L);

        List<Map<String, Object>> notifications = jdbcTemplate.queryForList(
                """
                select recipient_id, notification_type, channel, status
                from notification_events
                where application_id = ?
                """,
                application.getId());
        assertThat(notifications).hasSize(1);
        assertThat(notifications.getFirst())
                .containsEntry("recipient_id", 301L)
                .containsEntry("notification_type", "APPROVAL_REQUESTED")
                .containsEntry("channel", "IN_APP")
                .containsEntry("status", "CREATED");
    }

    private Application createDefaultDraft() {
        return applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
    }

    private String applicationStatus(long applicationId) {
        return jdbcTemplate.queryForObject(
                "select status from applications where id = ?",
                String.class,
                applicationId);
    }

    private int rowCount(String tableName, long applicationId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from " + tableName + " where application_id = ?",
                Integer.class,
                applicationId);
        return count == null ? 0 : count;
    }

    private void attachDefaultPng(long applicationId, long uploaderId) {
        applicationService.attachReceiptImage(
                applicationId,
                uploaderId,
                "receipt.png",
                "image/png",
                pngBytes());
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
