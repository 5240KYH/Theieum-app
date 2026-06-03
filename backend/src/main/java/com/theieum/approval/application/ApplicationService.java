package com.theieum.approval.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.approval.ApprovalLineResolver;
import com.theieum.approval.approval.ApprovalLineResolver.ResolvedApprover;
import com.theieum.approval.approval.ApprovalStepStatus;
import com.theieum.approval.approval.ApprovalType;
import com.theieum.approval.attachment.Attachment;
import com.theieum.approval.attachment.AttachmentRepository;
import com.theieum.approval.attachment.FileStorage;
import com.theieum.approval.attachment.StoredFile;
import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.common.WorkflowConflictException;
import com.theieum.approval.notification.NotificationEventService;
import com.theieum.approval.user.User;
import com.theieum.approval.user.UserRepository;

import jakarta.persistence.EntityManager;

@Service
@Transactional
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationApprovalStepRepository approvalStepRepository;
    private final AttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final ApprovalLineResolver approvalLineResolver;
    private final FileStorage fileStorage;
    private final NotificationEventService notificationEventService;
    private final EntityManager entityManager;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            ApplicationApprovalStepRepository approvalStepRepository,
            AttachmentRepository attachmentRepository,
            UserRepository userRepository,
            ApprovalLineResolver approvalLineResolver,
            FileStorage fileStorage,
            NotificationEventService notificationEventService,
            EntityManager entityManager) {
        this.applicationRepository = applicationRepository;
        this.approvalStepRepository = approvalStepRepository;
        this.attachmentRepository = attachmentRepository;
        this.userRepository = userRepository;
        this.approvalLineResolver = approvalLineResolver;
        this.fileStorage = fileStorage;
        this.notificationEventService = notificationEventService;
        this.entityManager = entityManager;
    }

    public Application createDraft(CreateDraftCommand command) {
        User applicant = findActiveUser(command.applicantId());
        ApprovalType approvalType = entityManager.find(ApprovalType.class, command.approvalTypeId());
        if (approvalType == null || !approvalType.isActive()) {
            throw new ResourceNotFoundException("Active approval type not found: " + command.approvalTypeId());
        }

        return applicationRepository.save(new Application(
                applicant,
                approvalType,
                command.applicationDate(),
                command.receiptDate(),
                command.vendor(),
                command.amount(),
                command.description()));
    }

    public Application updateDraft(UpdateDraftCommand command) {
        Application application = findApplication(command.applicationId());
        if (!application.getApplicant().getId().equals(command.actorId())) {
            throw new ForbiddenOperationException("Only the applicant can update this application");
        }
        if (application.getStatus() != ApplicationStatus.DRAFT
                && application.getStatus() != ApplicationStatus.CANCELED) {
            throw new WorkflowConflictException("Only editable applications can be updated");
        }
        ApprovalType approvalType = entityManager.find(ApprovalType.class, command.approvalTypeId());
        if (approvalType == null || !approvalType.isActive()) {
            throw new ResourceNotFoundException("Active approval type not found: " + command.approvalTypeId());
        }

        application.updateDraft(
                approvalType,
                command.applicationDate(),
                command.receiptDate(),
                command.vendor(),
                command.amount(),
                command.description(),
                Instant.now());
        return application;
    }

    public Application cancelDraft(long applicationId, long actorId) {
        Application application = findApplication(applicationId);
        if (!application.getApplicant().getId().equals(actorId)) {
            throw new ForbiddenOperationException("Only the applicant can cancel this application");
        }
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new WorkflowConflictException("Only draft applications can be canceled");
        }
        application.cancelDraft(Instant.now());
        return application;
    }

    @Transactional(readOnly = true)
    public List<ApprovalPreviewStep> previewApprovalLine(long approvalTypeId, long applicantId) {
        findActiveUser(applicantId);
        List<ResolvedApprover> approvers = approvalLineResolver.resolve(approvalTypeId, applicantId);
        Map<Long, User> usersById = userRepository.findAllById(
                        approvers.stream().map(ResolvedApprover::userId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return approvers.stream()
                .map(approver -> {
                    User user = usersById.get(approver.userId());
                    if (user == null || !user.isActive()) {
                        throw new ResourceNotFoundException("Active approver not found: " + approver.userId());
                    }
                    return new ApprovalPreviewStep(approver.stepOrder(), user.getId(), user.getName());
                })
                .toList();
    }

    public Attachment attachReceiptImage(
            long applicationId,
            long uploaderId,
            String originalFilename,
            String contentType,
            byte[] bytes) {
        Application application = findApplication(applicationId);
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new WorkflowConflictException("Only draft applications can receive attachments");
        }
        User uploader = findActiveUser(uploaderId);
        if (!application.getApplicant().getId().equals(uploader.getId())) {
            throw new ForbiddenOperationException("Only the applicant can attach receipts");
        }
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Receipt attachment must be an image");
        }
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Receipt attachment must not be empty");
        }
        if (!matchesImageSignature(contentType, bytes)) {
            throw new IllegalArgumentException("Receipt attachment content does not match image type");
        }

        StoredFile storedFile = fileStorage.store(originalFilename, contentType, bytes);
        return attachmentRepository.save(new Attachment(application, originalFilename, storedFile, uploader));
    }

    public Application submit(long applicationId, long actorId) {
        Application application = findApplication(applicationId);
        User actor = findActiveUser(actorId);
        if (!application.getApplicant().getId().equals(actor.getId())) {
            throw new ForbiddenOperationException("Only the applicant can submit this application");
        }
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new WorkflowConflictException("Only draft applications can be submitted");
        }
        if (!attachmentRepository.existsByApplicationIdAndMimeTypeStartingWith(applicationId, "image/")) {
            throw new WorkflowConflictException("Receipt image attachment is required");
        }

        List<ResolvedApprover> approvers = approvalLineResolver.resolve(
                application.getApprovalType().getId(),
                application.getApplicant().getId());
        List<ApplicationApprovalStep> approvalSteps = java.util.stream.IntStream.range(0, approvers.size())
                .mapToObj(index -> {
                    ResolvedApprover approver = approvers.get(index);
                    return new ApplicationApprovalStep(
                        application,
                            index + 1,
                            entityManager.getReference(User.class, approver.userId()));
                })
                .toList();
        approvalStepRepository.saveAll(approvalSteps);

        application.submit(Instant.now());
        Application submitted = applicationRepository.save(application);

        ApplicationApprovalStep firstStep = approvalSteps.stream()
                .min(Comparator.comparingInt(ApplicationApprovalStep::getStepOrder))
                .orElseThrow(() -> new WorkflowConflictException("Approval line has no approvers"));
        notificationEventService.createApprovalRequested(submitted, firstStep.getOriginalApprover());

        return submitted;
    }

    public Application approve(long stepId, long actorId, String comment) {
        ApplicationApprovalStep step = findApprovalStep(stepId);
        User actor = findActiveUser(actorId);
        Instant actedAt = Instant.now();
        validateApplicationInApproval(step.getApplication());
        validateCurrentPendingStep(step);
        if (!step.getOriginalApprover().getId().equals(actor.getId())) {
            throw new ForbiddenOperationException("Only the current approver can approve this step");
        }

        step.approve(actedAt);
        entityManager.persist(new ApprovalHistory(
                step.getApplication(),
                step,
                ApprovalStepStatus.APPROVED.name(),
                step.getOriginalApprover(),
                actor,
                false,
                null,
                normalizeOptional(comment),
                actedAt));
        advanceAfterApprovedStep(step.getApplication(), actedAt);
        return step.getApplication();
    }

    public Application reject(long stepId, long actorId, String comment) {
        String rejectionComment = requireText(comment, "Rejection comment is required");
        ApplicationApprovalStep step = findApprovalStep(stepId);
        User actor = findActiveUser(actorId);
        Instant actedAt = Instant.now();
        validateApplicationInApproval(step.getApplication());
        validateCurrentPendingStep(step);
        if (!step.getOriginalApprover().getId().equals(actor.getId())) {
            throw new ForbiddenOperationException("Only the current approver can reject this step");
        }

        step.reject(actedAt);
        step.getApplication().reject(actedAt);
        entityManager.persist(new ApprovalHistory(
                step.getApplication(),
                step,
                ApprovalStepStatus.REJECTED.name(),
                step.getOriginalApprover(),
                actor,
                false,
                null,
                rejectionComment,
                actedAt));
        notificationEventService.createApplicationRejected(step.getApplication());
        return step.getApplication();
    }

    public Application adminApprove(long stepId, long adminId, String reason) {
        String adminReason = requireText(reason, "Admin approval reason is required");
        ApplicationApprovalStep step = findApprovalStep(stepId);
        User admin = findActiveUser(adminId);
        Instant actedAt = Instant.now();
        if (!hasManagementRole(admin)) {
            throw new ForbiddenOperationException("Only admins or managers can perform admin approval");
        }
        validateApplicationInApproval(step.getApplication());
        validateCurrentPendingStep(step);

        step.adminApprove(actedAt);
        entityManager.persist(new ApprovalHistory(
                step.getApplication(),
                step,
                ApprovalStepStatus.ADMIN_APPROVED.name(),
                step.getOriginalApprover(),
                admin,
                true,
                adminReason,
                null,
                actedAt));
        notificationEventService.createAdminApproved(step.getApplication());
        advanceAfterApprovedStep(step.getApplication(), actedAt);
        return step.getApplication();
    }

    private boolean hasManagementRole(User user) {
        return user.getRoleList().stream()
                .map(role -> role.trim().toUpperCase())
                .anyMatch(role -> role.equals("ADMIN") || role.equals("MANAGER") || role.equals("MANGER"));
    }

    private Application findApplication(long applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + applicationId));
    }

    private ApplicationApprovalStep findApprovalStep(long stepId) {
        Long applicationId = approvalStepRepository.findApplicationIdByStepId(stepId);
        if (applicationId == null) {
            throw new ResourceNotFoundException("Approval step not found: " + stepId);
        }
        return approvalStepRepository.findLockedByApplicationIdOrderByStepOrderAsc(applicationId)
                .stream()
                .filter(step -> step.getId().equals(stepId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Approval step not found: " + stepId));
    }

    private User findActiveUser(long userId) {
        return userRepository.findByIdAndActiveTrue(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Active user not found: " + userId));
    }

    private void validateApplicationInApproval(Application application) {
        if (application.getStatus() != ApplicationStatus.IN_APPROVAL) {
            throw new WorkflowConflictException("Only in-approval applications can be approved");
        }
    }

    private void validateCurrentPendingStep(ApplicationApprovalStep step) {
        if (step.getStatus() != ApprovalStepStatus.PENDING) {
            throw new WorkflowConflictException("Only pending approval steps can be processed");
        }
        ApplicationApprovalStep currentStep = approvalStepRepository
                .findLockedByApplicationIdOrderByStepOrderAsc(step.getApplication().getId())
                .stream()
                .filter(candidate -> candidate.getStatus() == ApprovalStepStatus.PENDING)
                .findFirst()
                .orElseThrow(() -> new WorkflowConflictException("No pending approval step exists"));
        if (!Objects.equals(currentStep.getId(), step.getId())) {
            throw new WorkflowConflictException("Only the current approval step can be processed");
        }
    }

    private void advanceAfterApprovedStep(Application application, Instant actedAt) {
        approvalStepRepository.findLockedByApplicationIdOrderByStepOrderAsc(application.getId())
                .stream()
                .filter(step -> step.getStatus() == ApprovalStepStatus.PENDING)
                .findFirst()
                .ifPresentOrElse(
                        nextStep -> notificationEventService.createApprovalRequested(application, nextStep.getOriginalApprover()),
                        () -> {
                            application.approve(actedAt);
                            notificationEventService.createApplicationApproved(application);
                        });
    }

    private String requireText(String value, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private boolean matchesImageSignature(String contentType, byte[] bytes) {
        return switch (contentType) {
            case "image/png" -> startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
            case "image/jpeg" -> startsWith(bytes, 0xff, 0xd8, 0xff);
            case "image/gif" -> startsWith(bytes, 0x47, 0x49, 0x46, 0x38);
            case "image/webp" -> startsWith(bytes, 0x52, 0x49, 0x46, 0x46)
                    && bytes.length >= 12
                    && bytes[8] == 0x57
                    && bytes[9] == 0x45
                    && bytes[10] == 0x42
                    && bytes[11] == 0x50;
            default -> false;
        };
    }

    private boolean startsWith(byte[] bytes, int... signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        for (int index = 0; index < signature.length; index++) {
            if ((bytes[index] & 0xff) != signature[index]) {
                return false;
            }
        }
        return true;
    }

    public record CreateDraftCommand(
            Long applicantId,
            Long approvalTypeId,
            LocalDate applicationDate,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            String description) {
    }

    public record UpdateDraftCommand(
            Long applicationId,
            Long actorId,
            Long approvalTypeId,
            LocalDate applicationDate,
            LocalDate receiptDate,
            String vendor,
            BigDecimal amount,
            String description) {
    }

    public record ApprovalPreviewStep(int stepOrder, Long approverId, String approverName) {
    }
}
