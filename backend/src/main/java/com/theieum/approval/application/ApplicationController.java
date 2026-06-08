package com.theieum.approval.application;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.approval.ApprovalStepStatus;
import com.theieum.approval.attachment.Attachment;
import com.theieum.approval.attachment.AttachmentRepository;
import com.theieum.approval.attachment.FileStorage;
import com.theieum.approval.auth.AuthenticatedUser;
import com.theieum.approval.user.UserOrganizationService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;
    private final ApplicationApprovalStepRepository approvalStepRepository;
    private final ApprovalHistoryRepository approvalHistoryRepository;
    private final AttachmentRepository attachmentRepository;
    private final FileStorage fileStorage;
    private final ApplicationHardDeleteService applicationHardDeleteService;
    private final UserOrganizationService userOrganizationService;
    private final long maxReceiptImageBytes;

    public ApplicationController(
            ApplicationService applicationService,
            ApplicationRepository applicationRepository,
            ApplicationApprovalStepRepository approvalStepRepository,
            ApprovalHistoryRepository approvalHistoryRepository,
            AttachmentRepository attachmentRepository,
            FileStorage fileStorage,
            ApplicationHardDeleteService applicationHardDeleteService,
            UserOrganizationService userOrganizationService,
            @Value("${app.attachments.max-image-bytes:5242880}") long maxReceiptImageBytes) {
        this.applicationService = applicationService;
        this.applicationRepository = applicationRepository;
        this.approvalStepRepository = approvalStepRepository;
        this.approvalHistoryRepository = approvalHistoryRepository;
        this.attachmentRepository = attachmentRepository;
        this.fileStorage = fileStorage;
        this.applicationHardDeleteService = applicationHardDeleteService;
        this.userOrganizationService = userOrganizationService;
        this.maxReceiptImageBytes = maxReceiptImageBytes;
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

    @GetMapping("/approval-preview")
    @Transactional(readOnly = true)
    public List<ApprovalPreviewStepResponse> approvalPreview(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "1") long approvalTypeId,
            @RequestParam long approvalOrganizationId) {
        requireRole(user, "APPLICANT");
        return applicationService.previewApprovalLine(approvalTypeId, user.id(), approvalOrganizationId)
                .stream()
                .map(ApprovalPreviewStepResponse::from)
                .toList();
    }

    @GetMapping("/approval-organizations")
    @Transactional(readOnly = true)
    public List<ApprovalOrganizationResponse> approvalOrganizations(@AuthenticationPrincipal AuthenticatedUser user) {
        requireRole(user, "APPLICANT");
        return userOrganizationService.findActiveApprovalOrganizations(user.id())
                .stream()
                .map(ApprovalOrganizationResponse::from)
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
                request.approvalOrganizationId,
                request.applicationDate == null ? LocalDate.now() : request.applicationDate,
                request.receiptDate,
                request.vendor,
                request.amount,
                request.description));
        return toResponse(application);
    }

    @PutMapping("/{id}")
    @Transactional
    public ApplicationResponse update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody CreateApplicationRequest request) {
        requireRole(user, "APPLICANT");
        Application application = applicationService.updateDraft(new ApplicationService.UpdateDraftCommand(
                id,
                user.id(),
                request.approvalTypeId == null ? 1L : request.approvalTypeId,
                request.approvalOrganizationId,
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
        if (file.getSize() > maxReceiptImageBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Receipt attachment exceeds configured size limit");
        }
        Attachment attachment = applicationService.attachReceiptImage(
                id,
                user.id(),
                file.getOriginalFilename(),
                contentType,
                file.getBytes());
        return AttachmentResponse.from(attachment);
    }

    @GetMapping("/{id}/attachments/{attachmentId}/content")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> attachmentContent(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @PathVariable long attachmentId) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!canRead(user, application)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Attachment attachment = attachmentRepository.findByIdAndApplicationId(attachmentId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getMimeType()))
                .body(fileStorage.read(attachment.getFilePath()));
    }

    @PostMapping("/{id}/submit")
    @Transactional
    public ApplicationResponse submit(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireRole(user, "APPLICANT");
        return toResponse(applicationService.submit(id, user.id()));
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public ApplicationResponse cancel(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireRole(user, "APPLICANT");
        return toResponse(applicationService.cancelDraft(id, user.id()));
    }

    @DeleteMapping("/{id}/hard-delete")
    @Transactional
    public ResponseEntity<Void> hardDelete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireRole(user, "APPLICANT");
        applicationHardDeleteService.hardDeleteByApplicant(id, user.id());
        return ResponseEntity.noContent().build();
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
        List<AttachmentResponse> attachments = attachmentRepository
                .findByApplicationIdOrderByIdAsc(application.getId())
                .stream()
                .map(AttachmentResponse::from)
                .toList();
        List<ApprovalHistoryResponse> histories = approvalHistoryRepository
                .findByApplicationIdOrderByIdAsc(application.getId())
                .stream()
                .map(ApprovalHistoryResponse::from)
                .toList();
        return ApplicationResponse.from(application, steps, attachments, histories);
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
            @NotNull Long approvalOrganizationId,
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
            Long approvalOrganizationId,
            String approvalOrganizationName,
            LocalDate applicationDate,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            String description,
            ApplicationStatus status,
            Instant submittedAt,
            Instant completedAt,
            Instant createdAt,
            List<ApprovalStepResponse> approvalSteps,
            List<AttachmentResponse> attachments,
            List<ApprovalHistoryResponse> approvalHistories) {

        static ApplicationResponse from(
                Application application,
                List<ApprovalStepResponse> steps,
                List<AttachmentResponse> attachments,
                List<ApprovalHistoryResponse> histories) {
            return new ApplicationResponse(
                    application.getId(),
                    UserSummary.from(application.getApplicant()),
                    application.getApprovalType().getId(),
                    application.getApprovalOrganization().getId(),
                    application.getApprovalOrganization().getName(),
                    application.getApplicationDate(),
                    application.getReceiptDate(),
                    application.getVendor(),
                    application.getAmount(),
                    application.getDescription(),
                    application.getStatus(),
                    application.getSubmittedAt(),
                    application.getCompletedAt(),
                    application.getCreatedAt(),
                    steps,
                    attachments,
                    histories);
        }
    }

    public record ApprovalStepResponse(
            Long id,
            int stepOrder,
            UserSummary originalApprover,
            String organizationName,
            String positionName,
            ApprovalStepStatus status,
            Instant actedAt) {

        static ApprovalStepResponse from(ApplicationApprovalStep step) {
            return new ApprovalStepResponse(
                    step.getId(),
                    step.getStepOrder(),
                    UserSummary.from(step.getOriginalApprover()),
                    step.getApprovalOrganization().getName(),
                    step.getApprovalPosition().getName(),
                    step.getStatus(),
                    step.getActedAt());
        }
    }

    public record ApprovalPreviewStepResponse(
            int stepOrder,
            ApprovalPreviewApproverResponse approver,
            boolean autoApprovalExpected) {

        static ApprovalPreviewStepResponse from(ApplicationService.ApprovalPreviewStep step) {
            return new ApprovalPreviewStepResponse(
                    step.stepOrder(),
                    new ApprovalPreviewApproverResponse(
                            step.approverId(),
                            step.approverName(),
                            step.organizationName(),
                            step.positionName()),
                    step.autoApprovalExpected());
        }
    }

    public record ApprovalPreviewApproverResponse(
            Long id,
            String name,
            String organizationName,
            String positionName) {
    }

    public record UserSummary(Long id, String name) {

        static UserSummary from(com.theieum.approval.user.User user) {
            return new UserSummary(user.getId(), user.getName());
        }
    }

    public record ApprovalOrganizationResponse(
            Long id,
            String name,
            Long parentId,
            int levelNo,
            boolean primary) {

        static ApprovalOrganizationResponse from(UserOrganizationService.ApprovalOrganizationSummary organization) {
            return new ApprovalOrganizationResponse(
                    organization.organizationId(),
                    organization.organizationName(),
                    organization.parentId(),
                    organization.levelNo(),
                    organization.primary());
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

    public record ApprovalHistoryResponse(
            Long id,
            Integer stepOrder,
            String action,
            UserSummary originalApprover,
            UserSummary actor,
            boolean adminOverride,
            String adminReason,
            String comment,
            Instant actedAt) {

        static ApprovalHistoryResponse from(ApprovalHistory history) {
            ApplicationApprovalStep step = history.getApprovalStep();
            return new ApprovalHistoryResponse(
                    history.getId(),
                    step == null ? null : step.getStepOrder(),
                    history.getAction(),
                    history.getOriginalApprover() == null ? null : UserSummary.from(history.getOriginalApprover()),
                    UserSummary.from(history.getActor()),
                    history.isAdminOverride(),
                    history.getAdminReason(),
                    history.getComment(),
                    history.getActedAt());
        }
    }
}
