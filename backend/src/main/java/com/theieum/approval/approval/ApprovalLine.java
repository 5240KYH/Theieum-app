package com.theieum.approval.approval;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "approval_lines")
public class ApprovalLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_type_id", nullable = false)
    private ApprovalType approvalType;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean active;

    @OneToMany(mappedBy = "approvalLine")
    @OrderBy("stepOrder asc")
    private List<ApprovalLineStep> steps = new ArrayList<>();

    protected ApprovalLine() {
    }

    public Long getId() {
        return id;
    }

    public ApprovalType getApprovalType() {
        return approvalType;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public List<ApprovalLineStep> getSteps() {
        return steps;
    }
}
