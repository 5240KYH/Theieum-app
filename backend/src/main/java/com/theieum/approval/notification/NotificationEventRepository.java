package com.theieum.approval.notification;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, Long> {

    List<NotificationEvent> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);
}
