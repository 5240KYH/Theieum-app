package com.theieum.approval.notification;

import org.springframework.stereotype.Component;

@Component
public class EmailNotificationSender implements NotificationSender {

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.EMAIL;
    }

    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public void send(NotificationEvent event) {
    }
}
