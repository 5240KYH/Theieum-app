package com.theieum.approval.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.flywaydb.core.Flyway;
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
        "app.attachments.storage-dir=/private/tmp/theieum-approval-test"
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
                new byte[] {1, 2, 3, 4});

        Application submitted = applicationService.submit(application.getId(), 3L);

        assertThat(submitted.getStatus()).isEqualTo(ApplicationStatus.IN_APPROVAL);
        assertThat(submitted.getSubmittedAt()).isNotNull();

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
                .containsEntry("step_order", 2)
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
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Receipt image attachment is required");
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
