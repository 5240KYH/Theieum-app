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
        return entityManager.createQuery(
                        """
                        select new com.theieum.approval.approval.ApprovalLineResolver$ResolvedApprover(
                            exception.approverUser.id,
                            exception.stepOrder,
                            com.theieum.approval.approval.ApprovalStepType.DIRECT_USER
                        )
                        from ApprovalOrgException exception
                        where exception.approvalType.id = :approvalTypeId
                          and exception.organization.id = :organizationId
                          and exception.active = true
                        order by exception.stepOrder asc, exception.id asc
                        """,
                        ResolvedApprover.class)
                .setParameter("approvalTypeId", approvalTypeId)
                .setParameter("organizationId", organizationId)
                .getResultList();
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

        return lines.getFirst();
    }

    private ResolvedApprover resolveDirectUser(ApprovalLineStep step) {
        if (step.getDirectUser() == null) {
            throw new IllegalStateException("DIRECT_USER step has no direct user: " + step.getId());
        }

        return new ResolvedApprover(step.getDirectUser().getId(), step.getStepOrder(), step.getStepType());
    }

    private List<ResolvedApprover> resolveOrganizationPosition(ApprovalLineStep step, long organizationId) {
        if (step.getPosition() == null) {
            throw new IllegalStateException("ORG_POSITION step has no position condition: " + step.getId());
        }

        List<?> userIds = entityManager.createNativeQuery(
                        """
                        select users.id
                        from users
                        join positions on positions.id = users.position_id
                        join positions required_positions on required_positions.id = ?
                        where users.organization_id = ?
                          and users.active = true
                          and positions.rank_order >= required_positions.rank_order
                        order by positions.rank_order asc, users.id asc
                        """)
                .setParameter(1, step.getPosition().getId())
                .setParameter(2, organizationId)
                .getResultList();

        return userIds.stream()
                .map(userId -> new ResolvedApprover(toLong(userId), step.getStepOrder(), step.getStepType()))
                .toList();
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
