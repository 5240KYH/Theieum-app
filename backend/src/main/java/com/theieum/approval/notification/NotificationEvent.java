package com.theieum.approval.notification;

import java.time.Instant;

import com.theieum.approval.application.Application;
import com.theieum.approval.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_events")
public class NotificationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 50)
    private NotificationType notificationType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NotificationChannel channel;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NotificationEventStatus status;

    @Column(name = "read_flag", nullable = false)
    private boolean readFlag;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "failed_reason")
    private String failedReason;

    @Column(name = "template_code", length = 100)
    private String templateCode;

    @Column(name = "external_message_id")
    private String externalMessageId;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected NotificationEvent() {
    }

    public NotificationEvent(User recipient, Application application, String title, String body) {
        this(recipient, application, NotificationType.APPROVAL_REQUESTED, title, body);
    }

    public NotificationEvent(
            User recipient,
            Application application,
            NotificationType notificationType,
            String title,
            String body) {
        this.recipient = recipient;
        this.application = application;
        this.notificationType = notificationType;
        this.channel = NotificationChannel.IN_APP;
        this.title = title;
        this.body = body;
        this.status = NotificationEventStatus.CREATED;
        this.readFlag = false;
    }

    public Long getId() {
        return id;
    }

    public User getRecipient() {
        return recipient;
    }

    public Application getApplication() {
        return application;
    }

    public NotificationType getNotificationType() {
        return notificationType;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public NotificationEventStatus getStatus() {
        return status;
    }

    public boolean isReadFlag() {
        return readFlag;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public String getFailedReason() {
        return failedReason;
    }

    public String getTemplateCode() {
        return templateCode;
    }

    public String getExternalMessageId() {
        return externalMessageId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void markRead() {
        this.readFlag = true;
    }
}
