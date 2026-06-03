package com.theieum.approval.approval;

import com.theieum.approval.organization.Organization;
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
@Table(name = "approval_org_exceptions")
public class ApprovalOrgException {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_type_id", nullable = false)
    private ApprovalType approvalType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_user_id", nullable = false)
    private User approverUser;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(nullable = false)
    private boolean active;

    protected ApprovalOrgException() {
    }

    public Long getId() {
        return id;
    }

    public ApprovalType getApprovalType() {
        return approvalType;
    }

    public Organization getOrganization() {
        return organization;
    }

    public User getApproverUser() {
        return approverUser;
    }

    public int getStepOrder() {
        return stepOrder;
    }

    public boolean isActive() {
        return active;
    }
}
