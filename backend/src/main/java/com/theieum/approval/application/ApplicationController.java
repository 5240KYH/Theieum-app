package com.theieum.approval.application;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.approval.ApprovalStepStatus;
import com.theieum.approval.attachment.Attachment;
import com.theieum.approval.auth.AuthenticatedUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private static final long MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;
    private final ApplicationApprovalStepRepository approvalStepRepository;

    public ApplicationController(
            ApplicationService applicationService,
            ApplicationRepository applicationRepository,
            ApplicationApprovalStepRepository approvalStepRepository) {
        this.applicationService = applicationService;
        this.applicationRepository = applicationRepository;
        this.approvalStepRepository = approvalStepRepository;
    }

    @GetMapping("/my")
    @Transactional(readOnly = true)
    public List<ApplicationResponse> myApplications(@AuthenticationPrincipal AuthenticatedUser user) {
        requireRole(user, "APPLICANT");
        return applicationRepository.findByApplicantIdOrderByCreatedAtDesc(user.id())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PostMapping
    @Transactional
    public ApplicationResponse create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateApplicationRequest request) {
        requireRole(user, "APPLICANT");
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                user.id(),
                request.approvalTypeId == null ? 1L : request.approvalTypeId,
                request.applicationDate == null ? LocalDate.now() : request.applicationDate,
                request.receiptDate,
                request.vendor,
                request.amount,
                request.description));
        return toResponse(application);
    }

    @PostMapping("/{id}/attachments")
    @Transactional
    public AttachmentResponse attach(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @RequestPart("file") MultipartFile file) throws IOException {
        requireRole(user, "APPLICANT");
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Receipt attachment must be an image");
        }
        if (file.getSize() > MAX_RECEIPT_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Receipt attachment must be 5MB or smaller");
        }
        Attachment attachment = applicationService.attachReceiptImage(
                id,
                user.id(),
                file.getOriginalFilename(),
                contentType,
                file.getBytes());
        return AttachmentResponse.from(attachment);
    }

    @PostMapping("/{id}/submit")
    @Transactional
    public ApplicationResponse submit(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireRole(user, "APPLICANT");
        return toResponse(applicationService.submit(id, user.id()));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ApplicationResponse get(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!canRead(user, application)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return toResponse(application);
    }

    private ApplicationResponse toResponse(Application application) {
        List<ApprovalStepResponse> steps = approvalStepRepository
                .findByApplicationIdOrderByStepOrderAsc(application.getId())
                .stream()
                .map(ApprovalStepResponse::from)
                .toList();
        return ApplicationResponse.from(application, steps);
    }

    private boolean canRead(AuthenticatedUser user, Application application) {
        if (user == null) {
            return false;
        }
        return hasRole(user, "ADMIN")
                || application.getApplicant().getId().equals(user.id())
                || approvalStepRepository.existsReadableByApplicationIdAndApproverId(application.getId(), user.id());
    }

    private void requireRole(AuthenticatedUser user, String role) {
        if (!hasRole(user, role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    private boolean hasRole(AuthenticatedUser user, String role) {
        return user != null && user.roles().contains(role);
    }

    public record CreateApplicationRequest(
            Long approvalTypeId,
            LocalDate applicationDate,
            @NotNull LocalDate receiptDate,
            @NotBlank String vendor,
            @NotNull @Positive BigDecimal amount,
            @NotBlank String description) {
    }

    public record ApplicationResponse(
            Long id,
            UserSummary applicant,
            Long approvalTypeId,
            LocalDate applicationDate,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            String description,
            ApplicationStatus status,
            Instant submittedAt,
            Instant completedAt,
            Instant createdAt,
            List<ApprovalStepResponse> approvalSteps) {

        static ApplicationResponse from(Application application, List<ApprovalStepResponse> steps) {
            return new ApplicationResponse(
                    application.getId(),
                    UserSummary.from(application.getApplicant()),
                    application.getApprovalType().getId(),
                    application.getApplicationDate(),
                    application.getReceiptDate(),
                    application.getVendor(),
                    application.getAmount(),
                    application.getDescription(),
                    application.getStatus(),
                    application.getSubmittedAt(),
                    application.getCompletedAt(),
                    application.getCreatedAt(),
                    steps);
        }
    }

    public record ApprovalStepResponse(
            Long id,
            int stepOrder,
            UserSummary originalApprover,
            ApprovalStepStatus status,
            Instant actedAt) {

        static ApprovalStepResponse from(ApplicationApprovalStep step) {
            return new ApprovalStepResponse(
                    step.getId(),
                    step.getStepOrder(),
                    UserSummary.from(step.getOriginalApprover()),
                    step.getStatus(),
                    step.getActedAt());
        }
    }

    public record UserSummary(Long id, String name) {

        static UserSummary from(com.theieum.approval.user.User user) {
            return new UserSummary(user.getId(), user.getName());
        }
    }

    public record AttachmentResponse(
            Long id,
            String originalFilename,
            String mimeType,
            long fileSize) {

        static AttachmentResponse from(Attachment attachment) {
            return new AttachmentResponse(
                    attachment.getId(),
                    attachment.getOriginalFilename(),
                    attachment.getMimeType(),
                    attachment.getFileSize());
        }
    }
}
