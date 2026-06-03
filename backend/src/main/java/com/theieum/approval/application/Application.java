package com.theieum.approval.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.theieum.approval.approval.ApprovalType;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "applications")
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_type_id", nullable = false)
    private ApprovalType approvalType;

    @Column(name = "application_date", nullable = false)
    private LocalDate applicationDate;

    @Column(name = "receipt_date", nullable = false)
    private LocalDate receiptDate;

    @Column(nullable = false, length = 200)
    private String vendor;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ApplicationStatus status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Application() {
    }

    public Application(
            User applicant,
            ApprovalType approvalType,
            LocalDate applicationDate,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            String description) {
        this.applicant = applicant;
        this.approvalType = approvalType;
        this.applicationDate = applicationDate;
        this.receiptDate = receiptDate;
        this.vendor = vendor;
        this.amount = amount;
        this.description = description;
        this.status = ApplicationStatus.DRAFT;
        this.updatedAt = Instant.now();
    }

    public void submit(Instant submittedAt) {
        if (status != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("Only draft applications can be submitted");
        }
        this.status = ApplicationStatus.IN_APPROVAL;
        this.submittedAt = submittedAt;
        this.updatedAt = submittedAt;
    }

    public void approve(Instant completedAt) {
        if (status != ApplicationStatus.IN_APPROVAL) {
            throw new IllegalStateException("Only in-approval applications can be approved");
        }
        this.status = ApplicationStatus.APPROVED;
        this.completedAt = completedAt;
        this.updatedAt = completedAt;
    }

    public void reject(Instant completedAt) {
        if (status != ApplicationStatus.IN_APPROVAL) {
            throw new IllegalStateException("Only in-approval applications can be rejected");
        }
        this.status = ApplicationStatus.REJECTED;
        this.completedAt = completedAt;
        this.updatedAt = completedAt;
    }

    @PreUpdate
    void updateTimestamp() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getApplicant() {
        return applicant;
    }

    public ApprovalType getApprovalType() {
        return approvalType;
    }

    public LocalDate getApplicationDate() {
        return applicationDate;
    }

    public LocalDate getReceiptDate() {
        return receiptDate;
    }

    public String getVendor() {
        return vendor;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getDescription() {
        return description;
    }

    public ApplicationStatus getStatus() {
        return status;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
