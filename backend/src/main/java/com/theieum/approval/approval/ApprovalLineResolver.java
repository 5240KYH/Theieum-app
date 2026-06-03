package com.theieum.approval.approval;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

@Service
@Transactional(readOnly = true)
public class ApprovalLineResolver {

    private final EntityManager entityManager;

    public ApprovalLineResolver(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId) {
        Long organizationId = findApplicantOrganizationId(applicantId);

        List<ResolvedApprover> exceptionApprovers = findOrganizationExceptionApprovers(approvalTypeId, organizationId);
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
            }
        }

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
                    return new ResolvedApprover(
                            exception.getApproverUser().getId(),
                            exception.getStepOrder(),
                            ApprovalStepType.DIRECT_USER);
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

        return new ResolvedApprover(step.getDirectUser().getId(), step.getStepOrder(), step.getStepType());
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
                        join positions on positions.id = users.position_id
                        where users.position_id = ?
                          and users.organization_id = ?
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
                .map(userId -> new ResolvedApprover(toLong(userId), step.getStepOrder(), step.getStepType()))
                .toList();
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

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        throw new IllegalStateException("Expected numeric database value but got: " + value);
    }

    public record ResolvedApprover(Long userId, int stepOrder, ApprovalStepType stepType) {
    }
}
