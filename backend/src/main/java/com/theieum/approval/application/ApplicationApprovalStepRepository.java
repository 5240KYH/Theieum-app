package com.theieum.approval.application;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ApplicationApprovalStepRepository extends JpaRepository<ApplicationApprovalStep, Long> {

    List<ApplicationApprovalStep> findByApplicationIdOrderByStepOrderAsc(Long applicationId);

    List<ApplicationApprovalStep> findByOriginalApproverIdAndStatusOrderByApplicationCreatedAtDesc(
            Long originalApproverId,
            com.theieum.approval.approval.ApprovalStepStatus status);

    boolean existsByApplicationIdAndOriginalApproverId(Long applicationId, Long originalApproverId);

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
