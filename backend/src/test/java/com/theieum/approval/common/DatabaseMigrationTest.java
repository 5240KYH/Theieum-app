package com.theieum.approval.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import java.time.LocalDate;
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
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac"
})
class DatabaseMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Flyway flyway;

    @Test
    void flywayCreatesCoreTablesAndSeedsMvpData() {
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
        assertColumnIsNotNullable("applications", "approval_organization_id");

        assertColumnsExist(
                "user_organizations",
                "position_id");
        assertColumnIsNotNullable("user_organizations", "position_id");

        assertColumnsExist(
                "organizations",
                "leader_user_id");

        assertColumnsExist(
                "application_approval_steps",
                "approval_organization_id",
                "approval_position_id");
        assertColumnIsNotNullable("application_approval_steps", "approval_organization_id");
        assertColumnIsNotNullable("application_approval_steps", "approval_position_id");

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
        assertThat(seedUserCount).isGreaterThanOrEqualTo(30);

        List<String> requiredLoginIds = jdbcTemplate.queryForList(
                """
                select login_id
                from users
                where login_id in ('admin', 'employee01', 'approver01', 'trial-applicant01', 'trial-approver01', 'trial-manager01')
                """,
                String.class);
        assertThat(requiredLoginIds).containsExactlyInAnyOrder(
                "admin",
                "employee01",
                "approver01",
                "trial-applicant01",
                "trial-approver01",
                "trial-manager01");

        Integer activeTrialAccountCount = jdbcTemplate.queryForObject(
                "select count(*) from users where login_id like 'trial-%' and active = true",
                Integer.class);
        assertThat(activeTrialAccountCount).isGreaterThanOrEqualTo(10);

        Integer managerTrialAccountCount = jdbcTemplate.queryForObject(
                "select count(*) from users where login_id like 'trial-manager%' and roles like '%MANAGER%' and active = true",
                Integer.class);
        assertThat(managerTrialAccountCount).isGreaterThanOrEqualTo(1);

        Integer usersMissingRequiredReferences = jdbcTemplate.queryForObject(
                "select count(*) from users where organization_id is null or position_id is null",
                Integer.class);
        assertThat(usersMissingRequiredReferences).isZero();

        Integer membershipsMissingRequiredReferences = jdbcTemplate.queryForObject(
                "select count(*) from user_organizations where organization_id is null or position_id is null",
                Integer.class);
        assertThat(membershipsMissingRequiredReferences).isZero();

        Integer orgPositionStepCount = jdbcTemplate.queryForObject(
                "select count(*) from approval_line_steps where step_type = ?",
                Integer.class,
                "ORG_POSITION");
        assertThat(orgPositionStepCount).isGreaterThanOrEqualTo(1);

        Integer activeOrgExceptionCount = jdbcTemplate.queryForObject(
                "select count(*) from approval_org_exceptions where active = true",
                Integer.class);
        assertThat(activeOrgExceptionCount).isGreaterThanOrEqualTo(1);

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

        Integer worshipMediaPathCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from organizations root
                join organizations department on department.parent_id = root.id
                join organizations team on team.parent_id = department.id
                where root.name = '더이음사랑의교회'
                  and root.parent_id is null
                  and root.level_no = 1
                  and root.active = true
                  and department.name = '예배부'
                  and department.level_no = 2
                  and department.active = true
                  and team.name = '미디어팀'
                  and team.level_no = 3
                  and team.active = true
                """,
                Integer.class);
        assertThat(worshipMediaPathCount).isEqualTo(1);

        Integer financeAuditPathCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from organizations root
                join organizations department on department.parent_id = root.id
                join organizations team on team.parent_id = department.id
                where root.name = '더이음사랑의교회'
                  and root.parent_id is null
                  and root.level_no = 1
                  and root.active = true
                  and department.name = '재정부'
                  and department.level_no = 2
                  and department.active = true
                  and team.name = '감사팀'
                  and team.level_no = 3
                  and team.active = true
                """,
                Integer.class);
        assertThat(financeAuditPathCount).isEqualTo(1);

        Integer activePrimaryIndexCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from pg_index idx
                join pg_class index_class on index_class.oid = idx.indexrelid
                join pg_class table_class on table_class.oid = idx.indrelid
                join pg_namespace table_schema on table_schema.oid = table_class.relnamespace
                where table_schema.nspname = 'public'
                  and table_class.relname = 'user_organizations'
                  and index_class.relname = 'ux_user_organizations_active_primary'
                  and idx.indisunique = true
                  and idx.indpred is not null
                  and pg_get_indexdef(idx.indexrelid) like '%USING btree (user_id)%'
                  and lower(regexp_replace(pg_get_expr(idx.indpred, idx.indrelid), '\\s+', '', 'g'))
                      = '((primary_flag=true)and(active=true))'
                """,
                Integer.class);
        assertThat(activePrimaryIndexCount).isEqualTo(1);
    }

    @Test
    void v4MigratesExistingApplicationsToApplicantOrganization() {
        assertIsDedicatedTestDatabase();
        flyway.clean();
        Flyway.configure()
                .configuration(flyway.getConfiguration())
                .target("3")
                .load()
                .migrate();

        Long applicantId = jdbcTemplate.queryForObject(
                "select id from users where login_id = ?",
                Long.class,
                "employee01");
        Long applicantOrganizationId = jdbcTemplate.queryForObject(
                "select organization_id from users where id = ?",
                Long.class,
                applicantId);
        Long applicationId = jdbcTemplate.queryForObject(
                """
                insert into applications (
                    applicant_id, approval_type_id, application_date, receipt_date,
                    vendor, amount, description, status
                ) values (?, 1, ?, ?, 'V4 테스트 가맹점', 12345, 'V4 이관 테스트', 'DRAFT')
                returning id
                """,
                Long.class,
                applicantId,
                LocalDate.of(2026, 6, 8),
                LocalDate.of(2026, 6, 8));

        flyway.migrate();

        Long approvalOrganizationId = jdbcTemplate.queryForObject(
                "select approval_organization_id from applications where id = ?",
                Long.class,
                applicationId);
        assertThat(approvalOrganizationId).isEqualTo(applicantOrganizationId);
        assertColumnIsNotNullable("applications", "approval_organization_id");
    }

    @Test
    void v4ReusesExistingChurchRootWhenSeedingOrganizationTree() {
        assertIsDedicatedTestDatabase();
        flyway.clean();
        Flyway.configure()
                .configuration(flyway.getConfiguration())
                .target("3")
                .load()
                .migrate();

        jdbcTemplate.update(
                """
                insert into organizations (name, parent_id, level_no, sort_order, active)
                values ('더이음사랑의교회', null, 1, 999, true)
                """);

        flyway.migrate();

        Integer rootCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from organizations
                where name = '더이음사랑의교회'
                  and parent_id is null
                """,
                Integer.class);
        assertThat(rootCount).isEqualTo(1);

        Integer churchOrganizationTreeCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from organizations org
                where org.name = '더이음사랑의교회'
                   or exists (
                       select 1
                       from organizations root
                       where root.name = '더이음사랑의교회'
                         and root.parent_id is null
                         and (
                             org.parent_id = root.id
                             or org.parent_id in (
                                 select department.id
                                 from organizations department
                                 where department.parent_id = root.id
                             )
                         )
                   )
                """,
                Integer.class);
        assertThat(churchOrganizationTreeCount).isEqualTo(15);

        Integer worshipMediaPathCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from organizations root
                join organizations department on department.parent_id = root.id
                join organizations team on team.parent_id = department.id
                where root.name = '더이음사랑의교회'
                  and root.parent_id is null
                  and department.name = '예배부'
                  and team.name = '미디어팀'
                """,
                Integer.class);
        assertThat(worshipMediaPathCount).isEqualTo(1);
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

    private void assertColumnIsNotNullable(String tableName, String columnName) {
        String nullable = jdbcTemplate.queryForObject(
                """
                select is_nullable
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = ?
                  and column_name = ?
                """,
                String.class,
                tableName,
                columnName);

        assertThat(nullable)
                .as("column %s.%s should be not null", tableName, columnName)
                .isEqualTo("NO");
    }

    private void assertIsDedicatedTestDatabase() {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            String actualUrl = connection.getMetaData().getURL();
            if (!TestDatabaseHarness.JDBC_URL.equals(actualUrl)) {
                throw new IllegalStateException("Refusing to clean non-test database: " + actualUrl);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Unable to verify test database before clean", ex);
        }
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
