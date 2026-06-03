package com.theieum.approval.application;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ApplicationApprovalStepRepository extends JpaRepository<ApplicationApprovalStep, Long> {

    List<ApplicationApprovalStep> findByApplicationIdOrderByStepOrderAsc(Long applicationId);

    @Query("""
            select step
            from ApplicationApprovalStep step
            where step.originalApprover.id = :originalApproverId
              and step.status = :status
              and step.application.status = com.theieum.approval.application.ApplicationStatus.IN_APPROVAL
              and step.stepOrder = (
                  select min(candidate.stepOrder)
                  from ApplicationApprovalStep candidate
                  where candidate.application.id = step.application.id
                    and candidate.status = :status
              )
            order by step.application.createdAt desc
            """)
    List<ApplicationApprovalStep> findCurrentByOriginalApproverIdAndStatusOrderByApplicationCreatedAtDesc(
            @Param("originalApproverId") Long originalApproverId,
            @Param("status") com.theieum.approval.approval.ApprovalStepStatus status);

    @Query("""
            select count(step) > 0
            from ApplicationApprovalStep step
            where step.application.id = :applicationId
              and step.originalApprover.id = :approverId
              and (
                  step.status <> com.theieum.approval.approval.ApprovalStepStatus.PENDING
                  or (
                      step.application.status = com.theieum.approval.application.ApplicationStatus.IN_APPROVAL
                      and step.stepOrder = (
                      select min(candidate.stepOrder)
                      from ApplicationApprovalStep candidate
                      where candidate.application.id = step.application.id
                        and candidate.status = com.theieum.approval.approval.ApprovalStepStatus.PENDING
                      )
                  )
              )
            """)
    boolean existsReadableByApplicationIdAndApproverId(
            @Param("applicationId") Long applicationId,
            @Param("approverId") Long approverId);

    @Query("select step.application.id from ApplicationApprovalStep step where step.id = :id")
    Long findApplicationIdByStepId(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select step
            from ApplicationApprovalStep step
            where step.application.id = :applicationId
            order by step.stepOrder asc
            """)
    List<ApplicationApprovalStep> findLockedByApplicationIdOrderByStepOrderAsc(@Param("applicationId") Long applicationId);
}
