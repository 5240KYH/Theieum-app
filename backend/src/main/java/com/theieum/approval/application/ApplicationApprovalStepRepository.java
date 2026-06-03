package com.theieum.approval.application;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationApprovalStepRepository extends JpaRepository<ApplicationApprovalStep, Long> {

    List<ApplicationApprovalStep> findByApplicationIdOrderByStepOrderAsc(Long applicationId);
}
