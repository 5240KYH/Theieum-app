package com.theieum.approval.approval;

import com.theieum.approval.organization.Position;
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
@Table(name = "approval_line_steps")
public class ApprovalLineStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_line_id", nullable = false)
    private ApprovalLine approvalLine;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false, length = 50)
    private ApprovalStepType stepType;

    @Column(name = "organization_scope", length = 50)
    private String organizationScope;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "direct_user_id")
    private User directUser;

    @Column(name = "sort_policy", nullable = false, length = 50)
    private String sortPolicy;

    protected ApprovalLineStep() {
    }

    public Long getId() {
        return id;
    }

    public ApprovalLine getApprovalLine() {
        return approvalLine;
    }

    public int getStepOrder() {
        return stepOrder;
    }

    public ApprovalStepType getStepType() {
        return stepType;
    }

    public String getOrganizationScope() {
        return organizationScope;
    }

    public Position getPosition() {
        return position;
    }

    public User getDirectUser() {
        return directUser;
    }

    public String getSortPolicy() {
        return sortPolicy;
    }
}
