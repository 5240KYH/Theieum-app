package com.theieum.approval.application;

import java.time.Instant;

import com.theieum.approval.approval.ApprovalStepStatus;
import com.theieum.approval.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "application_approval_steps")
public class ApplicationApprovalStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_approver_id", nullable = false)
    private User originalApprover;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ApprovalStepStatus status;

    @Column(name = "acted_at")
    private Instant actedAt;

    protected ApplicationApprovalStep() {
    }

    public ApplicationApprovalStep(Application application, int stepOrder, User originalApprover) {
        this.application = application;
        this.stepOrder = stepOrder;
        this.originalApprover = originalApprover;
        this.status = ApprovalStepStatus.PENDING;
    }

    public Long getId() {
        return id;
    }

    public Application getApplication() {
        return application;
    }

    public int getStepOrder() {
        return stepOrder;
    }

    public User getOriginalApprover() {
        return originalApprover;
    }

    public ApprovalStepStatus getStatus() {
        return status;
    }

    public Instant getActedAt() {
        return actedAt;
    }
}
