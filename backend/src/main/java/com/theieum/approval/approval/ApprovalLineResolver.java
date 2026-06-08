package com.theieum.approval.approval;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.user.UserOrganizationService;

import jakarta.persistence.EntityManager;

@Service
@Transactional(readOnly = true)
public class ApprovalLineResolver {

    private final EntityManager entityManager;
    private final UserOrganizationService userOrganizationService;

    public ApprovalLineResolver(EntityManager entityManager, UserOrganizationService userOrganizationService) {
        this.entityManager = entityManager;
        this.userOrganizationService = userOrganizationService;
    }

    public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId) {
        Long organizationId = findApplicantOrganizationId(applicantId);
        return resolve(approvalTypeId, applicantId, organizationId);
    }

    public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId, long approvalOrganizationId) {
        long organizationId = userOrganizationService.requireActiveMembership(applicantId, approvalOrganizationId);

        List<ResolvedApprover> exceptionApprovers = deduplicateApprovers(
                findOrganizationExceptionApprovers(approvalTypeId, organizationId));
        if (!exceptionApprovers.isEmpty()) {
            return exceptionApprovers;
        }

        ApprovalLine approvalLine = findDefaultApprovalLine(approvalTypeId);
        List<ResolvedApprover> approvers = new ArrayList<>();

        for (ApprovalLineStep step : approvalLine.getSteps()) {
            if (step.getStepType() == ApprovalStepType.DIRECT_USER) {
                approvers.add(resolveDirectUser(step));
            } else if (step.getStepType() == ApprovalStepType.ORG_POSITION) {
                approvers.addAll(resolveOrganizationPosition(step, organizationId));
            } else if (step.getStepType() == ApprovalStepType.ORG_LEADER) {
                approvers.add(resolveOrganizationLeader(step, organizationId));
            }
        }

        approvers = deduplicateApprovers(approvers);
        if (approvers.isEmpty()) {
            throw new IllegalStateException("Approval line has no approvers: " + approvalTypeId);
        }

        return List.copyOf(approvers);
    }

    private Long findApplicantOrganizationId(long applicantId) {
        List<?> organizationIds = entityManager.createNativeQuery(
                        "select organization_id from users where id = ? and active = true")
                .setParameter(1, applicantId)
                .getResultList();

        if (organizationIds.isEmpty()) {
            throw new IllegalStateException("Active applicant not found: " + applicantId);
        }

        return toLong(organizationIds.getFirst());
    }

    private List<ResolvedApprover> findOrganizationExceptionApprovers(long approvalTypeId, long organizationId) {
        List<ApprovalOrgException> exceptions = entityManager.createQuery(
                        """
                        select exception
                        from ApprovalOrgException exception
                        join fetch exception.approverUser
                        where exception.approvalType.id = :approvalTypeId
                          and exception.organization.id = :organizationId
                          and exception.active = true
                        order by exception.stepOrder asc, exception.id asc
                        """,
                        ApprovalOrgException.class)
                .setParameter("approvalTypeId", approvalTypeId)
                .setParameter("organizationId", organizationId)
                .getResultList();

        return exceptions.stream()
                .map(exception -> {
                    if (!exception.getApproverUser().isActive()) {
                        throw new IllegalStateException(
                                "Organization exception has no active approver: " + exception.getId());
                    }
                    Long approverUserId = exception.getApproverUser().getId();
                    return new ResolvedApprover(
                            approverUserId,
                            exception.getStepOrder(),
                            ApprovalStepType.DIRECT_USER,
                            exception.getOrganization().getId(),
                            findMembershipPositionIdOrUserMirror(approverUserId, exception.getOrganization().getId()).positionId());
                })
                .toList();
    }

    private ApprovalLine findDefaultApprovalLine(long approvalTypeId) {
        List<ApprovalLine> lines = entityManager.createQuery(
                        """
                        select distinct line
                        from ApprovalLine line
                        left join fetch line.steps
                        where line.approvalType.id = :approvalTypeId
                          and line.active = true
                        order by line.id asc
                        """,
                        ApprovalLine.class)
                .setParameter("approvalTypeId", approvalTypeId)
                .getResultList();

        if (lines.isEmpty()) {
            throw new IllegalStateException("Active approval line not found: " + approvalTypeId);
        }
        if (lines.size() > 1) {
            throw new IllegalStateException("Multiple active approval lines found: " + approvalTypeId);
        }

        return lines.getFirst();
    }

    private ResolvedApprover resolveDirectUser(ApprovalLineStep step) {
        if (step.getDirectUser() == null) {
            throw new IllegalStateException("DIRECT_USER step has no direct user: " + step.getId());
        }
        if (!step.getDirectUser().isActive()) {
            throw new IllegalStateException("DIRECT_USER step has no active direct user: " + step.getId());
        }

        UserAssignment assignment = findUserMirrorAssignment(step.getDirectUser().getId());
        return new ResolvedApprover(
                step.getDirectUser().getId(),
                step.getStepOrder(),
                step.getStepType(),
                assignment.organizationId(),
                assignment.positionId());
    }

    private List<ResolvedApprover> resolveOrganizationPosition(ApprovalLineStep step, long organizationId) {
        if (step.getPosition() == null) {
            throw new IllegalStateException("ORG_POSITION step has no position condition: " + step.getId());
        }
        Long targetOrganizationId = resolveOrganizationScope(step.getOrganizationScope(), organizationId);

        List<?> userIds = entityManager.createNativeQuery(
                        """
                        select users.id
                        from users
                        join user_organizations uo on uo.user_id = users.id
                        join positions on positions.id = uo.position_id
                        where uo.position_id = ?
                          and uo.organization_id = ?
                          and uo.active = true
                          and users.active = true
                        order by positions.rank_order asc, users.id asc
                        """)
                .setParameter(1, step.getPosition().getId())
                .setParameter(2, targetOrganizationId)
                .getResultList();
        if (userIds.isEmpty()) {
            throw new IllegalStateException("ORG_POSITION step has no active approvers: " + step.getId());
        }

        return userIds.stream()
                .map(userId -> new ResolvedApprover(
                        toLong(userId),
                        step.getStepOrder(),
                        step.getStepType(),
                        targetOrganizationId,
                        step.getPosition().getId()))
                .toList();
    }

    private ResolvedApprover resolveOrganizationLeader(ApprovalLineStep step, long organizationId) {
        Long targetOrganizationId = resolveOrganizationScope(step.getOrganizationScope(), organizationId);
        List<?> rows = entityManager.createNativeQuery(
                        """
                        select leader.id, uo.position_id
                        from organizations organization
                        join users leader on leader.id = organization.leader_user_id
                        join user_organizations uo on uo.user_id = leader.id
                            and uo.organization_id = organization.id
                            and uo.active = true
                        where organization.id = ?
                          and organization.active = true
                          and leader.active = true
                        order by uo.primary_flag desc, uo.sort_order asc, uo.id asc
                        limit 1
                        """)
                .setParameter(1, targetOrganizationId)
                .getResultList();
        if (rows.isEmpty()) {
            throw new IllegalStateException("ORG_LEADER step has no active organization leader: " + step.getId());
        }

        Object[] row = (Object[]) rows.getFirst();
        return new ResolvedApprover(
                toLong(row[0]),
                step.getStepOrder(),
                step.getStepType(),
                targetOrganizationId,
                toLong(row[1]));
    }

    private List<ResolvedApprover> deduplicateApprovers(List<ResolvedApprover> approvers) {
        Map<Long, ResolvedApprover> uniqueApprovers = new LinkedHashMap<>();
        for (ResolvedApprover approver : approvers) {
            uniqueApprovers.putIfAbsent(approver.userId(), approver);
        }

        return List.copyOf(uniqueApprovers.values());
    }

    private Long resolveOrganizationScope(String organizationScope, long applicantOrganizationId) {
        String scope = organizationScope == null || organizationScope.isBlank() ? "APPLICANT_ORG" : organizationScope;
        if ("APPLICANT_ORG".equals(scope)) {
            return applicantOrganizationId;
        }
        if ("PARENT_ORG".equals(scope)) {
            return findParentOrganizationIdOrSelf(applicantOrganizationId);
        }
        if ("ROOT_ORG".equals(scope)) {
            return findRootOrganizationId(applicantOrganizationId);
        }

        throw new IllegalStateException("Unsupported organization scope: " + organizationScope);
    }

    private Long findParentOrganizationIdOrSelf(long organizationId) {
        List<?> organizationIds = entityManager.createNativeQuery(
                        """
                        select coalesce(parent_id, id)
                        from organizations
                        where id = ?
                          and active = true
                        """)
                .setParameter(1, organizationId)
                .getResultList();

        if (organizationIds.isEmpty()) {
            throw new IllegalStateException("Active organization not found: " + organizationId);
        }

        return toLong(organizationIds.getFirst());
    }

    private Long findRootOrganizationId(long organizationId) {
        List<?> organizationIds = entityManager.createNativeQuery(
                        """
                        with recursive ancestors as (
                            select id, parent_id, level_no
                            from organizations
                            where id = ?
                              and active = true
                            union all
                            select parent.id, parent.parent_id, parent.level_no
                            from organizations parent
                            join ancestors child on child.parent_id = parent.id
                            where parent.active = true
                        )
                        select id
                        from ancestors
                        order by level_no asc, id asc
                        limit 1
                        """)
                .setParameter(1, organizationId)
                .getResultList();

        if (organizationIds.isEmpty()) {
            throw new IllegalStateException("Active root organization not found: " + organizationId);
        }

        return toLong(organizationIds.getFirst());
    }

    private UserAssignment findMembershipPositionIdOrUserMirror(long userId, long organizationId) {
        List<?> rows = entityManager.createNativeQuery(
                        """
                        select uo.organization_id, uo.position_id
                        from user_organizations uo
                        where uo.user_id = ?
                          and uo.organization_id = ?
                          and uo.active = true
                        order by uo.primary_flag desc, uo.sort_order asc, uo.id asc
                        limit 1
                        """)
                .setParameter(1, userId)
                .setParameter(2, organizationId)
                .getResultList();
        if (!rows.isEmpty()) {
            Object[] row = (Object[]) rows.getFirst();
            return new UserAssignment(toLong(row[0]), toLong(row[1]));
        }
        return findUserMirrorAssignment(userId);
    }

    private UserAssignment findUserMirrorAssignment(long userId) {
        List<?> rows = entityManager.createNativeQuery(
                        """
                        select organization_id, position_id
                        from users
                        where id = ?
                          and active = true
                        """)
                .setParameter(1, userId)
                .getResultList();
        if (rows.isEmpty()) {
            throw new IllegalStateException("Active approver not found: " + userId);
        }
        Object[] row = (Object[]) rows.getFirst();
        return new UserAssignment(toLong(row[0]), toLong(row[1]));
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        throw new IllegalStateException("Expected numeric database value but got: " + value);
    }

    private record UserAssignment(Long organizationId, Long positionId) {
    }

    public record ResolvedApprover(
            Long userId,
            int stepOrder,
            ApprovalStepType stepType,
            Long organizationId,
            Long positionId) {

        public ResolvedApprover(Long userId, int stepOrder, ApprovalStepType stepType) {
            this(userId, stepOrder, stepType, null, null);
        }
    }
}
