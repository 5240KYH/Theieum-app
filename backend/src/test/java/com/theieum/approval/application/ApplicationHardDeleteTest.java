package com.theieum.approval.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

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
