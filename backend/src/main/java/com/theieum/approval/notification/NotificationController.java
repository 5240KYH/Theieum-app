package com.theieum.approval.notification;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.auth.AuthenticatedUser;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationEventRepository notificationEventRepository;

    public NotificationController(NotificationEventRepository notificationEventRepository) {
        this.notificationEventRepository = notificationEventRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<NotificationResponse> notifications(@AuthenticationPrincipal AuthenticatedUser user) {
        requireUser(user);
        return notificationEventRepository.findByRecipientIdOrderByCreatedAtDesc(user.id())
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public NotificationResponse markRead(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireUser(user);
        NotificationEvent event = notificationEventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!event.getRecipient().getId().equals(user.id())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        event.markRead();
        return NotificationResponse.from(event);
    }

    private void requireUser(AuthenticatedUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }

    public record NotificationResponse(
            Long id,
            Long applicationId,
            String notificationType,
            String channel,
            String title,
            String body,
            String status,
            boolean read,
            Instant createdAt) {

        static NotificationResponse from(NotificationEvent event) {
            return new NotificationResponse(
                    event.getId(),
                    event.getApplication() == null ? null : event.getApplication().getId(),
                    event.getNotificationType().name(),
                    event.getChannel().name(),
                    event.getTitle(),
                    event.getBody(),
                    event.getStatus().name(),
                    event.isReadFlag(),
                    event.getCreatedAt());
        }
    }
}
