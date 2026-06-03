package com.theieum.approval.notification;

import org.springframework.stereotype.Component;

@Component
public class InAppNotificationSender implements NotificationSender {

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.IN_APP;
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public void send(NotificationEvent event) {
        // In-app delivery is represented by the persisted notification_events row.
    }
}
