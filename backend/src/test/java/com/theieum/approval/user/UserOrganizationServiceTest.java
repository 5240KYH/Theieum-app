package com.theieum.approval.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.TestDatabaseHarness;
import com.theieum.approval.user.UserOrganizationService.ApprovalOrganizationSummary;
import com.theieum.approval.user.UserOrganizationService.MembershipCommand;
import com.theieum.approval.user.UserOrganizationService.MembershipSummary;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
})
class UserOrganizationServiceTest {

    @Autowired
    private UserOrganizationService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saveMembershipsSynchronizesUserOrganizationMirrorWhenPrimaryMembershipChanges() {
        service.saveMemberships(3L, List.of(
                new MembershipCommand(4L, 4L, true, true, 10),
                new MembershipCommand(3L, 1L, false, true, 20)));

        Long mirrorOrganizationId = jdbcTemplate.queryForObject(
                "select organization_id from users where id = ?",
                Long.class,
                3L);
        Long mirrorPositionId = jdbcTemplate.queryForObject(
                "select position_id from users where id = ?",
                Long.class,
                3L);

        assertThat(mirrorOrganizationId).isEqualTo(4L);
        assertThat(mirrorPositionId).isEqualTo(4L);
    }

    @Test
    void findMembershipsReturnsMembershipsOrderedBySortOrderAndIdWithPrimaryFlag() {
        service.saveMemberships(3L, List.of(
                new MembershipCommand(4L, 2L, false, true, 30),
                new MembershipCommand(2L, 4L, true, true, 10),
                new MembershipCommand(3L, 1L, false, false, 10)));

        List<MembershipSummary> memberships = service.findMemberships(3L);

        assertThat(memberships).extracting(MembershipSummary::organizationId)
                .containsExactly(2L, 3L, 4L);
        assertThat(memberships).extracting(MembershipSummary::positionId)
                .containsExactly(4L, 1L, 2L);
        assertThat(memberships).extracting(MembershipSummary::positionName)
                .containsExactly("팀장", "사원", "대리");
        assertThat(memberships).extracting(MembershipSummary::primary)
                .containsExactly(true, false, false);
        assertThat(memberships).extracting(MembershipSummary::active)
                .containsExactly(true, false, true);
    }

    @Test
    void findActiveApprovalOrganizationsReturnsPrimaryMembershipBeforeLowerSortOrderSecondaryMembership() {
        service.saveMemberships(3L, List.of(
                new MembershipCommand(4L, 2L, false, true, 10),
                new MembershipCommand(2L, 4L, true, true, 30),
                new MembershipCommand(3L, 1L, false, false, 5)));

        List<ApprovalOrganizationSummary> organizations = service.findActiveApprovalOrganizations(3L);

        assertThat(organizations).extracting(ApprovalOrganizationSummary::organizationId)
                .containsExactly(2L, 4L);
        assertThat(organizations).extracting(ApprovalOrganizationSummary::primary)
                .containsExactly(true, false);
    }

    @Test
    void saveMembershipsRequiresExactlyOneActivePrimaryMembership() {
        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                new MembershipCommand(2L, 1L, true, true, 10),
                new MembershipCommand(3L, 1L, true, true, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("대표 소속");

        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                new MembershipCommand(2L, 1L, false, true, 10),
                new MembershipCommand(3L, 1L, false, true, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("대표 소속");
    }

    @Test
    void saveMembershipsRejectsInactivePrimaryMembership() {
        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                new MembershipCommand(2L, 1L, true, true, 10),
                new MembershipCommand(3L, 1L, true, false, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("대표 소속은 활성 상태");
    }

    @Test
    void saveMembershipsRejectsDuplicateOrganizations() {
        assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                new MembershipCommand(2L, 1L, true, true, 10),
                new MembershipCommand(2L, 4L, false, true, 20))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("중복");
    }

    @Test
    void saveMembershipsRejectsInactivePosition() {
        jdbcTemplate.update("update positions set active = false where id = ?", 2L);

        try {
            assertThatThrownBy(() -> service.saveMemberships(3L, List.of(
                    new MembershipCommand(2L, 1L, true, true, 10),
                    new MembershipCommand(3L, 2L, false, true, 20))))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("활성 직위");
        } finally {
            jdbcTemplate.update("update positions set active = true where id = ?", 2L);
        }
    }

    @Test
    void requireActiveMembershipRejectsOrganizationOutsideApplicantActiveMemberships() {
        service.saveMemberships(3L, List.of(
                new MembershipCommand(3L, 1L, true, true, 10),
                new MembershipCommand(4L, 4L, false, false, 20)));

        assertThat(service.requireActiveMembership(3L, 3L)).isEqualTo(3L);
        assertThatThrownBy(() -> service.requireActiveMembership(3L, 4L))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("신청자의 활성 소속이 아닙니다");
        assertThatThrownBy(() -> service.requireActiveMembership(3L, 2L))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("신청자의 활성 소속이 아닙니다");
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
