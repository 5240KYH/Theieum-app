package com.theieum.approval.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.approval.ApprovalLineResolver;
import com.theieum.approval.approval.ApprovalLineResolver.ResolvedApprover;
import com.theieum.approval.approval.ApprovalType;
import com.theieum.approval.attachment.Attachment;
import com.theieum.approval.attachment.AttachmentRepository;
import com.theieum.approval.attachment.FileStorage;
import com.theieum.approval.attachment.StoredFile;
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
            throw new IllegalStateException("Active approval type not found: " + command.approvalTypeId());
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

    public Attachment attachReceiptImage(
            long applicationId,
            long uploaderId,
            String originalFilename,
            String contentType,
            byte[] bytes) {
        Application application = findApplication(applicationId);
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("Only draft applications can receive attachments");
        }
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Receipt attachment must be an image");
        }

        User uploader = findActiveUser(uploaderId);
        StoredFile storedFile = fileStorage.store(originalFilename, contentType, bytes);
        return attachmentRepository.save(new Attachment(application, originalFilename, storedFile, uploader));
    }

    public Application submit(long applicationId, long actorId) {
        Application application = findApplication(applicationId);
        User actor = findActiveUser(actorId);
        if (!application.getApplicant().getId().equals(actor.getId())) {
            throw new IllegalStateException("Only the applicant can submit this application");
        }
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("Only draft applications can be submitted");
        }
        if (!attachmentRepository.existsByApplicationIdAndMimeTypeStartingWith(applicationId, "image/")) {
            throw new IllegalStateException("Receipt image attachment is required");
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
                .orElseThrow(() -> new IllegalStateException("Approval line has no approvers"));
        notificationEventService.createApprovalRequested(submitted, firstStep.getOriginalApprover());

        return submitted;
    }

    private Application findApplication(long applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalStateException("Application not found: " + applicationId));
    }

    private User findActiveUser(long userId) {
        return userRepository.findByIdAndActiveTrue(userId)
                .orElseThrow(() -> new IllegalStateException("Active user not found: " + userId));
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
}
