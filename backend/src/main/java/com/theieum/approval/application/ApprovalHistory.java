package com.theieum.approval.application;

import java.time.Instant;

import com.theieum.approval.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "approval_histories")
public class ApprovalHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_step_id")
    private ApplicationApprovalStep approvalStep;

    @Column(nullable = false, length = 50)
    private String action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_approver_id")
    private User originalApprover;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @Column(name = "admin_override", nullable = false)
    private boolean adminOverride;

    @Column(name = "admin_reason")
    private String adminReason;

    private String comment;

    @Column(name = "acted_at", nullable = false, insertable = false, updatable = false)
    private Instant actedAt;

    protected ApprovalHistory() {
    }

    public ApprovalHistory(
            Application application,
            ApplicationApprovalStep approvalStep,
            String action,
            User originalApprover,
            User actor,
            boolean adminOverride,
            String adminReason,
            String comment) {
        this.application = application;
        this.approvalStep = approvalStep;
        this.action = action;
        this.originalApprover = originalApprover;
        this.actor = actor;
        this.adminOverride = adminOverride;
        this.adminReason = adminReason;
        this.comment = comment;
    }

    public Long getId() {
        return id;
    }

    public Application getApplication() {
        return application;
    }

    public ApplicationApprovalStep getApprovalStep() {
        return approvalStep;
    }

    public String getAction() {
        return action;
    }

    public User getOriginalApprover() {
        return originalApprover;
    }

    public User getActor() {
        return actor;
    }

    public boolean isAdminOverride() {
        return adminOverride;
    }

    public String getAdminReason() {
        return adminReason;
    }

    public String getComment() {
        return comment;
    }

    public Instant getActedAt() {
        return actedAt;
    }
}
