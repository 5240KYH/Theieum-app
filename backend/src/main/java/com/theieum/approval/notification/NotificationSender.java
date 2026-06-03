package com.theieum.approval.notification;

public interface NotificationSender {

    NotificationChannel channel();

    boolean enabled();

    void send(NotificationEvent event);
}
