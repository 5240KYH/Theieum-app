package com.theieum.approval.notification;

import org.springframework.stereotype.Service;

import com.theieum.approval.application.Application;
import com.theieum.approval.user.User;

@Service
public class NotificationEventService {

    private final NotificationEventRepository notificationEventRepository;

    public NotificationEventService(NotificationEventRepository notificationEventRepository) {
        this.notificationEventRepository = notificationEventRepository;
    }

    public NotificationEvent createApprovalRequested(Application application, User firstApprover) {
        return notificationEventRepository.save(new NotificationEvent(
                firstApprover,
                application,
                NotificationType.APPROVAL_REQUESTED,
                "결재 요청이 도착했습니다",
                application.getVendor() + " 영수증 신청서 결재가 요청되었습니다."));
    }

    public NotificationEvent createApplicationApproved(Application application) {
        return notificationEventRepository.save(new NotificationEvent(
                application.getApplicant(),
                application,
                NotificationType.APPLICATION_APPROVED,
                "신청서 결재가 완료되었습니다",
                application.getVendor() + " 영수증 신청서가 승인되었습니다."));
    }

    public NotificationEvent createApplicationRejected(Application application) {
        return notificationEventRepository.save(new NotificationEvent(
                application.getApplicant(),
                application,
                NotificationType.APPLICATION_REJECTED,
                "신청서가 반려되었습니다",
                application.getVendor() + " 영수증 신청서가 반려되었습니다."));
    }
}
