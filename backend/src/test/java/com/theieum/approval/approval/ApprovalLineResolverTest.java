package com.theieum.approval.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1, 2);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(ApprovalStepType.DIRECT_USER, ApprovalStepType.DIRECT_USER);
    }

    @Test
    void organizationExceptionOverridesDefaultLine() {
        List<ResolvedApprover> approvers = resolver.resolve(1L, 3L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(18L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(2);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(ApprovalStepType.DIRECT_USER);
    }

    @Test
    void organizationPositionStepUsesPositionOrder() {
        long approvalTypeId = 102L;
        insertOrganization(120L, "조직 직위 정렬 테스트팀", 1L, 2, 120);
        insertUser(120L, "org-position-member-1", "조직직위1", 120L, 1L);
        insertUser(121L, "org-position-member-2", "조직직위2", 120L, 1L);
        insertUser(122L, "org-position-member-3", "조직직위3", 120L, 1L);
        insertApprovalType(approvalTypeId, "조직 직위 정렬 테스트");
        insertApprovalLine(102L, approvalTypeId, "조직 직위 결재선");
        insertOrgPositionStep(103L, 102L, 1, 1L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 120L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(120L, 121L, 122L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1, 1, 1);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(
                        ApprovalStepType.ORG_POSITION,
                        ApprovalStepType.ORG_POSITION,
                        ApprovalStepType.ORG_POSITION);
    }

    @Test
    void organizationPositionStepUsesActiveMembershipsNotOnlyPrimaryMirror() {
        long approvalTypeId = 109L;
        insertOrganization(150L, "겸직 결재자 대표 조직", null, 1, 150);
        insertOrganization(151L, "겸직 결재 대상 조직", null, 1, 151);
        insertUser(150L, "multi-approver", "겸직결재자", 150L, 4L);
        insertUserOrganization(150L, 151L, false, 20, true);
        insertUser(151L, "multi-applicant", "겸직신청자", 151L, 1L);
        insertApprovalType(approvalTypeId, "겸직 결재자 조회 테스트");
        insertApprovalLine(109L, approvalTypeId, "겸직 결재자 결재선");
        insertOrgPositionStep(112L, 109L, 1, 4L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 151L, 151L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(150L);
    }

    @Test
    void organizationPositionStepUsesMembershipPositionNotUserMirrorPosition() {
        long approvalTypeId = 110L;
        insertOrganization(160L, "겸직 직위 대표 조직", null, 1, 160);
        insertOrganization(161L, "겸직 직위 결재 대상 조직", null, 1, 161);
        insertUser(160L, "multi-position-approver", "겸직직위결재자", 160L, 5L);
        insertUserOrganization(160L, 161L, 4L, false, 20, true);
        insertUser(161L, "multi-position-applicant", "겸직직위신청자", 161L, 1L);
        insertApprovalType(approvalTypeId, "겸직 소속별 직위 조회 테스트");
        insertApprovalLine(110L, approvalTypeId, "겸직 소속별 직위 결재선");
        insertOrgPositionStep(113L, 110L, 1, 4L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 161L, 161L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(160L);
    }

    @Test
    void parentOrganizationScopeUsesImmediateParentOrganization() {
        long approvalTypeId = 106L;
        insertOrganization(130L, "상위 조직 테스트팀", 1L, 2, 130);
        insertOrganization(131L, "하위 조직 테스트파트", 130L, 3, 10);
        insertUser(130L, "parent-team-lead", "상위팀장", 130L, 4L);
        insertUser(131L, "part-member", "파트원", 131L, 1L);
        insertApprovalType(approvalTypeId, "상위 조직 결재선 테스트");
        insertApprovalLine(107L, approvalTypeId, "상위 조직 팀장 결재선");
        insertOrgPositionStep(110L, 107L, 1, "PARENT_ORG", 4L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 131L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(130L);
    }

    @Test
    void rootOrganizationScopeUsesTopLevelOrganizationFromAnyDepth() {
        long approvalTypeId = 107L;
        insertOrganization(140L, "최상위 조직 테스트본부", null, 1, 140);
        insertOrganization(141L, "최상위 조직 테스트팀", 140L, 2, 10);
        insertOrganization(142L, "최상위 조직 테스트파트", 141L, 3, 10);
        insertUser(140L, "root-representative", "최상위대표", 140L, 5L);
        insertUser(142L, "part-member-root", "파트원2", 142L, 1L);
        insertApprovalType(approvalTypeId, "최상위 조직 결재선 테스트");
        insertApprovalLine(108L, approvalTypeId, "최상위 조직 대표 결재선");
        insertOrgPositionStep(111L, 108L, 1, "ROOT_ORG", 5L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 142L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(140L);
    }

    @Test
    void selectedTeamResolvesApplicantParentAndRootScopes() {
        long approvalTypeId = 201L;
        insertOrganization(210L, "선택 스코프 최상위", null, 1, 210);
        insertOrganization(211L, "선택 스코프 부", 210L, 2, 10);
        insertOrganization(212L, "선택 스코프 팀", 211L, 3, 10);
        insertUser(210L, "selected-scope-root", "선택최상위결재자", 210L, 5L);
        insertUser(211L, "selected-scope-dept", "선택부결재자", 211L, 4L);
        insertUser(212L, "selected-scope-team", "선택팀결재자", 212L, 4L);
        insertUser(213L, "selected-scope-applicant", "선택조직신청자", 211L, 1L);
        insertUserOrganization(213L, 212L, false, 20, true);
        insertApprovalType(approvalTypeId, "선택 조직 스코프 테스트");
        insertApprovalLine(201L, approvalTypeId, "선택 조직 스코프 결재선");
        insertOrgPositionStep(201L, 201L, 1, "APPLICANT_ORG", 4L);
        insertOrgPositionStep(202L, 201L, 2, "PARENT_ORG", 4L);
        insertOrgPositionStep(203L, 201L, 3, "ROOT_ORG", 5L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 213L, 212L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(212L, 211L, 210L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1, 2, 3);
    }

    @Test
    void selectedDepartmentDeduplicatesSameRootApprover() {
        long approvalTypeId = 202L;
        insertOrganization(220L, "부 선택 최상위", null, 1, 220);
        insertOrganization(221L, "부 선택 부", 220L, 2, 10);
        insertUser(220L, "selected-department-root", "부선택대표", 220L, 5L);
        insertUser(221L, "selected-department-applicant", "부선택신청자", 221L, 1L);
        insertApprovalType(approvalTypeId, "부 선택 중복 제거 테스트");
        insertApprovalLine(202L, approvalTypeId, "부 선택 중복 제거 결재선");
        insertOrgPositionStep(204L, 202L, 1, "PARENT_ORG", 5L);
        insertOrgPositionStep(205L, 202L, 2, "ROOT_ORG", 5L);

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 221L, 221L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(220L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepOrder)
                .containsExactly(1);
    }

    @Test
    void organizationLeaderStepResolvesTeamAndParentLeaders() {
        long approvalTypeId = 203L;
        insertOrganization(230L, "조직장 최상위", null, 1, 230);
        insertOrganization(231L, "조직장 부", 230L, 2, 10);
        insertOrganization(232L, "조직장 팀", 231L, 3, 10);
        insertUser(230L, "org-leader-root", "조직장최상위", 230L, 5L);
        insertUser(231L, "org-leader-dept", "조직장부", 231L, 4L);
        insertUser(232L, "org-leader-team", "조직장팀", 232L, 4L);
        insertUser(233L, "org-leader-applicant", "조직장신청자", 232L, 1L);
        setOrganizationLeader(230L, 230L);
        setOrganizationLeader(231L, 231L);
        setOrganizationLeader(232L, 232L);
        insertApprovalType(approvalTypeId, "조직장 결재선 테스트");
        insertApprovalLine(203L, approvalTypeId, "조직장 결재선");
        insertOrgLeaderStep(206L, 203L, 1, "APPLICANT_ORG");
        insertOrgLeaderStep(207L, 203L, 2, "PARENT_ORG");

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 233L, 232L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(232L, 231L);
        assertThat(approvers)
                .extracting(ResolvedApprover::organizationId)
                .containsExactly(232L, 231L);
        assertThat(approvers)
                .extracting(ResolvedApprover::positionId)
                .containsExactly(4L, 4L);
        assertThat(approvers)
                .extracting(ResolvedApprover::stepType)
                .containsExactly(ApprovalStepType.ORG_LEADER, ApprovalStepType.ORG_LEADER);
    }

    @Test
    void organizationLeaderStepWorksWhenSelectedOrganizationIsDepartment() {
        long approvalTypeId = 204L;
        insertOrganization(240L, "부 조직장 최상위", null, 1, 240);
        insertOrganization(241L, "부 조직장 부", 240L, 2, 10);
        insertUser(240L, "department-root-leader", "부조직장최상위", 240L, 5L);
        insertUser(241L, "department-leader", "부조직장", 241L, 4L);
        insertUser(242L, "department-applicant", "부신청자", 241L, 1L);
        setOrganizationLeader(240L, 240L);
        setOrganizationLeader(241L, 241L);
        insertApprovalType(approvalTypeId, "부 조직장 결재선 테스트");
        insertApprovalLine(204L, approvalTypeId, "부 조직장 결재선");
        insertOrgLeaderStep(208L, 204L, 1, "APPLICANT_ORG");
        insertOrgLeaderStep(209L, 204L, 2, "PARENT_ORG");

        List<ResolvedApprover> approvers = resolver.resolve(approvalTypeId, 242L, 241L);

        assertThat(approvers)
                .extracting(ResolvedApprover::userId)
                .containsExactly(241L, 240L);
    }

    @Test
    void organizationLeaderStepWithoutActiveLeaderFailsLineResolution() {
        long approvalTypeId = 205L;
        insertOrganization(250L, "조직장 없음 조직", null, 1, 250);
        insertUser(250L, "missing-leader-applicant", "조직장없음신청자", 250L, 1L);
        insertApprovalType(approvalTypeId, "조직장 없음 테스트");
        insertApprovalLine(205L, approvalTypeId, "조직장 없음 결재선");
        insertOrgLeaderStep(210L, 205L, 1, "APPLICANT_ORG");

        assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 250L, 250L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ORG_LEADER step has no active organization leader");
    }

    @Test
    void selectedOrganizationMustBeApplicantMembership() {
        assertThatThrownBy(() -> resolver.resolve(1L, 3L, 4L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("신청자의 활성 소속이 아닙니다");
    }

    @Test
    void orgPositionStepWithoutMatchingApproverFailsLineResolution() {
        long approvalTypeId = 103L;
        insertApprovalType(approvalTypeId, "빈 조직 직위 단계 테스트");
        insertApprovalLine(103L, approvalTypeId, "빈 조직 직위 결재선");
        insertDirectUserStep(104L, 103L, 1, 18L);
        insertOrgPositionStep(105L, 103L, 2, 5L);
        insertDirectUserStep(106L, 103L, 3, 20L);

        assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ORG_POSITION step has no active approvers");
    }

    @Test
    void inactiveDirectUserStepFailsLineResolution() {
        long approvalTypeId = 104L;
        insertApprovalType(approvalTypeId, "비활성 직접 결재자 테스트");
        insertApprovalLine(104L, approvalTypeId, "비활성 직접 결재선");
        insertDirectUserStep(107L, 104L, 1, 18L);
        jdbcTemplate.update("update users set active = false where id = ?", 18L);

        try {
            assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("DIRECT_USER step has no active direct user");
        } finally {
            jdbcTemplate.update("update users set active = true where id = ?", 18L);
        }
    }

    @Test
    void inactiveOrganizationExceptionFailsLineResolution() {
        jdbcTemplate.update("update users set active = false where id = ?", 18L);

        try {
            assertThatThrownBy(() -> resolver.resolve(1L, 3L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Organization exception has no active approver");
        } finally {
            jdbcTemplate.update("update users set active = true where id = ?", 18L);
        }
    }

    @Test
    void multipleActiveDefaultLinesFailLineResolution() {
        long approvalTypeId = 105L;
        insertApprovalType(approvalTypeId, "중복 기본 결재선 테스트");
        insertApprovalLine(105L, approvalTypeId, "첫 번째 결재선");
        insertApprovalLine(106L, approvalTypeId, "두 번째 결재선");
        insertDirectUserStep(108L, 105L, 1, 18L);
        insertDirectUserStep(109L, 106L, 1, 20L);

        assertThatThrownBy(() -> resolver.resolve(approvalTypeId, 3L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Multiple active approval lines found");
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
        insertOrgPositionStep(id, approvalLineId, stepOrder, "APPLICANT_ORG", positionId);
    }

    private void insertOrgPositionStep(
            long id,
            long approvalLineId,
            int stepOrder,
            String organizationScope,
            long positionId) {
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
                ) values (?, ?, ?, 'ORG_POSITION', ?, ?, 'POSITION_ORDER')
                """,
                id,
                approvalLineId,
                stepOrder,
                organizationScope,
                positionId);
    }

    private void insertOrgLeaderStep(long id, long approvalLineId, int stepOrder, String organizationScope) {
        jdbcTemplate.update(
                """
                insert into approval_line_steps (
                    id,
                    approval_line_id,
                    step_order,
                    step_type,
                    organization_scope,
                    sort_policy
                ) values (?, ?, ?, 'ORG_LEADER', ?, 'POSITION_ORDER')
                """,
                id,
                approvalLineId,
                stepOrder,
                organizationScope);
    }

    private void insertOrganization(long id, String name, Long parentId, int levelNo, int sortOrder) {
        jdbcTemplate.update(
                """
                insert into organizations (id, name, parent_id, level_no, sort_order, active)
                values (?, ?, ?, ?, ?, true)
                """,
                id,
                name,
                parentId,
                levelNo,
                sortOrder);
    }

    private void insertUser(long id, String loginId, String name, long organizationId, long positionId) {
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
                ) values (?, ?, null, ?, ?, ?, ?, ?, 'APPLICANT', true)
                """,
                id,
                loginId,
                "$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW",
                name,
                loginId + "@theieum.local",
                organizationId,
                positionId);
        insertUserOrganization(id, organizationId, positionId, true, 10, true);
    }

    private void insertUserOrganization(
            long userId,
            long organizationId,
            boolean primary,
            int sortOrder,
            boolean active) {
        Long positionId = jdbcTemplate.queryForObject(
                "select position_id from users where id = ?",
                Long.class,
                userId);
        insertUserOrganization(userId, organizationId, positionId, primary, sortOrder, active);
    }

    private void insertUserOrganization(
            long userId,
            long organizationId,
            long positionId,
            boolean primary,
            int sortOrder,
            boolean active) {
        jdbcTemplate.update(
                """
                insert into user_organizations (user_id, organization_id, position_id, primary_flag, sort_order, active)
                values (?, ?, ?, ?, ?, ?)
                """,
                userId,
                organizationId,
                positionId,
                primary,
                sortOrder,
                active);
    }

    private void setOrganizationLeader(long organizationId, long leaderUserId) {
        jdbcTemplate.update("update organizations set leader_user_id = ? where id = ?", leaderUserId, organizationId);
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
