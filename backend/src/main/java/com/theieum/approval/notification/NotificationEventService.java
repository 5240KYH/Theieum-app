package com.theieum.approval.notification;

import java.util.List;

import org.springframework.stereotype.Service;

import com.theieum.approval.application.Application;
import com.theieum.approval.user.User;

@Service
public class NotificationEventService {

    private final NotificationEventRepository notificationEventRepository;
    private final List<NotificationSender> notificationSenders;

    public NotificationEventService(
            NotificationEventRepository notificationEventRepository,
            List<NotificationSender> notificationSenders) {
        this.notificationEventRepository = notificationEventRepository;
        this.notificationSenders = notificationSenders;
    }

    public NotificationEvent createApprovalRequested(Application application, User firstApprover) {
        return saveAndDispatch(new NotificationEvent(
                firstApprover,
                application,
                NotificationType.APPROVAL_REQUESTED,
                "결재 요청이 도착했습니다",
                application.getVendor() + " 영수증 신청서 결재가 요청되었습니다."));
    }

    public NotificationEvent createApplicationApproved(Application application) {
        return saveAndDispatch(new NotificationEvent(
                application.getApplicant(),
                application,
                NotificationType.APPLICATION_APPROVED,
                "신청서 결재가 완료되었습니다",
                application.getVendor() + " 영수증 신청서가 승인되었습니다."));
    }

    public NotificationEvent createApplicationRejected(Application application) {
        return saveAndDispatch(new NotificationEvent(
                application.getApplicant(),
                application,
                NotificationType.APPLICATION_REJECTED,
                "신청서가 반려되었습니다",
                application.getVendor() + " 영수증 신청서가 반려되었습니다."));
    }

    public NotificationEvent createAdminApproved(Application application) {
        return saveAndDispatch(new NotificationEvent(
                application.getApplicant(),
                application,
                NotificationType.ADMIN_APPROVED,
                "관리자 예외 결재가 처리되었습니다",
                application.getVendor() + " 영수증 신청서가 관리자 예외 결재로 처리되었습니다."));
    }

    private NotificationEvent saveAndDispatch(NotificationEvent event) {
        NotificationEvent savedEvent = notificationEventRepository.save(event);
        notificationSenders.stream()
                .filter(NotificationSender::enabled)
                .filter(sender -> sender.channel() == savedEvent.getChannel())
                .forEach(sender -> sender.send(savedEvent));
        return savedEvent;
    }
}
