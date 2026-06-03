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
                "결재 요청이 도착했습니다",
                application.getVendor() + " 영수증 신청서 결재가 요청되었습니다."));
    }
}
