package com.theieum.approval.notification;

import org.springframework.stereotype.Component;

@Component
public class KakaoNotificationSender implements NotificationSender {

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.KAKAO;
    }

    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public void send(NotificationEvent event) {
    }
}
