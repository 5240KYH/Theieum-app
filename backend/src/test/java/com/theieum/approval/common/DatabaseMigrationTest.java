package com.theieum.approval.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:55432/approval_test",
        "spring.datasource.username=approval",
        "spring.datasource.password=approval",
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed"
})
class DatabaseMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayCreatesCoreTablesAndSeedsMvpData() {
        assertTablesExist(
                "users",
                "organizations",
                "positions",
                "approval_types",
                "approval_lines",
                "approval_line_steps",
                "applications",
                "application_approval_steps",
                "approval_histories",
                "attachments",
                "notification_events");

        assertColumnsExist(
                "notification_events",
                "template_code",
                "external_message_id",
                "failed_reason",
                "channel",
                "status");

        Integer receiptApprovalTypeCount = jdbcTemplate.queryForObject(
                "select count(*) from approval_types where name = ?",
                Integer.class,
                "영수증 첨부 신청");
        assertThat(receiptApprovalTypeCount).isEqualTo(1);

        Integer seedUserCount = jdbcTemplate.queryForObject("select count(*) from users", Integer.class);
        assertThat(seedUserCount).isGreaterThanOrEqualTo(20);

        List<String> requiredLoginIds = jdbcTemplate.queryForList(
                "select login_id from users where login_id in ('admin', 'employee01', 'approver01')",
                String.class);
        assertThat(requiredLoginIds).containsExactlyInAnyOrder("admin", "employee01", "approver01");

        Integer usersMissingRequiredReferences = jdbcTemplate.queryForObject(
                "select count(*) from users where organization_id is null or position_id is null",
                Integer.class);
        assertThat(usersMissingRequiredReferences).isZero();

        Integer orgPositionStepCount = jdbcTemplate.queryForObject(
                "select count(*) from approval_line_steps where step_type = ?",
                Integer.class,
                "ORG_POSITION");
        assertThat(orgPositionStepCount).isGreaterThanOrEqualTo(1);

        Integer activeOrgExceptionCount = jdbcTemplate.queryForObject(
                "select count(*) from approval_org_exceptions where active = true",
                Integer.class);
        assertThat(activeOrgExceptionCount).isGreaterThanOrEqualTo(1);
    }

    private void assertTablesExist(String... tableNames) {
        for (String tableName : tableNames) {
            Integer tableCount = jdbcTemplate.queryForObject(
                    """
                    select count(*)
                    from information_schema.tables
                    where table_schema = 'public'
                      and table_name = ?
                    """,
                    Integer.class,
                    tableName);

            assertThat(tableCount)
                    .as("table %s should exist", tableName)
                    .isEqualTo(1);
        }
    }

    private void assertColumnsExist(String tableName, String... columnNames) {
        for (String columnName : columnNames) {
            Integer columnCount = jdbcTemplate.queryForObject(
                    """
                    select count(*)
                    from information_schema.columns
                    where table_schema = 'public'
                      and table_name = ?
                      and column_name = ?
                    """,
                    Integer.class,
                    tableName,
                    columnName);

            assertThat(columnCount)
                    .as("column %s.%s should exist", tableName, columnName)
                    .isEqualTo(1);
        }
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return (Flyway flyway) -> {
                flyway.clean();
                flyway.migrate();
            };
        }
    }
}
