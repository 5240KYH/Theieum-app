package com.theieum.approval.approval;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.application.Application;
import com.theieum.approval.application.ApplicationApprovalStep;
import com.theieum.approval.application.ApplicationApprovalStepRepository;
import com.theieum.approval.application.ApplicationService;
import com.theieum.approval.application.ApplicationStatus;
import com.theieum.approval.auth.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {

    private final ApplicationService applicationService;
    private final ApplicationApprovalStepRepository approvalStepRepository;

    public ApprovalController(
            ApplicationService applicationService,
            ApplicationApprovalStepRepository approvalStepRepository) {
        this.applicationService = applicationService;
        this.approvalStepRepository = approvalStepRepository;
    }

    @GetMapping("/inbox")
    @Transactional(readOnly = true)
    public List<ApprovalInboxItemResponse> inbox(@AuthenticationPrincipal AuthenticatedUser user) {
        requireRole(user, "APPROVER");
        return approvalStepRepository
                .findCurrentByOriginalApproverIdAndStatusOrderByApplicationCreatedAtDesc(
                        user.id(),
                        ApprovalStepStatus.PENDING)
                .stream()
                .map(ApprovalInboxItemResponse::from)
                .toList();
    }

    @PostMapping("/steps/{stepId}/approve")
    @Transactional
    public ApprovalActionResponse approve(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long stepId,
            @Valid @RequestBody ApprovalActionRequest request) {
        requireRole(user, "APPROVER");
        return ApprovalActionResponse.from(applicationService.approve(stepId, user.id(), request.comment()));
    }

    @PostMapping("/steps/{stepId}/reject")
    @Transactional
    public ApprovalActionResponse reject(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long stepId,
            @Valid @RequestBody ApprovalActionRequest request) {
        requireRole(user, "APPROVER");
        return ApprovalActionResponse.from(applicationService.reject(stepId, user.id(), request.comment()));
    }

    private void requireRole(AuthenticatedUser user, String role) {
        if (user == null || !user.roles().contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    public record ApprovalActionRequest(String comment) {
    }

    public record ApprovalActionResponse(Long id, ApplicationStatus status) {

        static ApprovalActionResponse from(Application application) {
            return new ApprovalActionResponse(application.getId(), application.getStatus());
        }
    }

    public record ApprovalInboxItemResponse(
            Long stepId,
            int stepOrder,
            ApprovalStepStatus stepStatus,
            Long applicationId,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            ApplicationStatus applicationStatus,
            Long applicantId,
            String applicantName) {

        static ApprovalInboxItemResponse from(ApplicationApprovalStep step) {
            Application application = step.getApplication();
            return new ApprovalInboxItemResponse(
                    step.getId(),
                    step.getStepOrder(),
                    step.getStatus(),
                    application.getId(),
                    application.getReceiptDate(),
                    application.getVendor(),
                    application.getAmount(),
                    application.getStatus(),
                    application.getApplicant().getId(),
                    application.getApplicant().getName());
        }
    }
}
