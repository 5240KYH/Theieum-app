package com.theieum.approval.application;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalHistoryRepository extends JpaRepository<ApprovalHistory, Long> {

    @EntityGraph(attributePaths = {"approvalStep", "originalApprover", "actor"})
    List<ApprovalHistory> findByApplicationIdOrderByIdAsc(Long applicationId);
}
