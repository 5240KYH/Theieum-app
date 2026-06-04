package com.theieum.approval.calendar;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.auth.AuthenticatedUser;
import com.theieum.approval.auth.UserSummary;
import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.user.User;
import com.theieum.approval.user.UserRepository;

@Service
public class CalendarEventService {

    private final CalendarEventRepository calendarEventRepository;
    private final UserRepository userRepository;

    public CalendarEventService(
            CalendarEventRepository calendarEventRepository,
            UserRepository userRepository) {
        this.calendarEventRepository = calendarEventRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<CalendarEventResponse> list(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        return calendarEventRepository.findByStartAtBeforeAndEndAtAfterOrderByStartAtAsc(to, from)
                .stream()
                .map(CalendarEventResponse::from)
                .toList();
    }

    @Transactional
    public CalendarEventResponse create(AuthenticatedUser currentUser, CalendarEventRequest request) {
        requireManagePermission(currentUser);
        validateRequest(request);
        User actor = findActiveUser(currentUser.id());
        CalendarEvent event = CalendarEvent.create(
                cleanRequired(request.title(), "제목을 입력해주세요."),
                cleanOptional(request.description()),
                cleanOptional(request.location()),
                request.startAt(),
                request.endAt(),
                request.allDay(),
                actor);
        return CalendarEventResponse.from(calendarEventRepository.save(event));
    }

    @Transactional
    public CalendarEventResponse update(AuthenticatedUser currentUser, long id, CalendarEventRequest request) {
        requireManagePermission(currentUser);
        validateRequest(request);
        User actor = findActiveUser(currentUser.id());
        CalendarEvent event = calendarEventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar event not found"));
        event.update(
                cleanRequired(request.title(), "제목을 입력해주세요."),
                cleanOptional(request.description()),
                cleanOptional(request.location()),
                request.startAt(),
                request.endAt(),
                request.allDay(),
                actor);
        return CalendarEventResponse.from(event);
    }

    @Transactional
    public void delete(AuthenticatedUser currentUser, long id) {
        requireManagePermission(currentUser);
        if (!calendarEventRepository.existsById(id)) {
            throw new ResourceNotFoundException("Calendar event not found");
        }
        calendarEventRepository.deleteById(id);
    }

    private void requireManagePermission(AuthenticatedUser user) {
        if (user == null || user.roles().stream().noneMatch(role -> role.equals("ADMIN") || role.equals("MANAGER"))) {
            throw new ForbiddenOperationException("일정 관리 권한이 없습니다.");
        }
    }

    private void validateRequest(CalendarEventRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("일정 정보를 입력해주세요.");
        }
        cleanRequired(request.title(), "제목을 입력해주세요.");
        validateRange(request.startAt(), request.endAt());
    }

    private void validateRange(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("시작 일시와 종료 일시를 입력해주세요.");
        }
        if (!to.isAfter(from)) {
            throw new IllegalArgumentException("종료 일시는 시작 일시보다 늦어야 합니다.");
        }
    }

    private User findActiveUser(Long id) {
        return userRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private String cleanRequired(String value, String message) {
        String cleaned = cleanOptional(value);
        if (cleaned == null) {
            throw new IllegalArgumentException(message);
        }
        return cleaned;
    }

    private String cleanOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public record CalendarEventRequest(
            String title,
            String description,
            String location,
            OffsetDateTime startAt,
            OffsetDateTime endAt,
            boolean allDay) {
    }

    public record CalendarEventResponse(
            Long id,
            String title,
            String description,
            String location,
            OffsetDateTime startAt,
            OffsetDateTime endAt,
            boolean allDay,
            UserSummary createdBy,
            UserSummary updatedBy,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {

        static CalendarEventResponse from(CalendarEvent event) {
            return new CalendarEventResponse(
                    event.getId(),
                    event.getTitle(),
                    event.getDescription(),
                    event.getLocation(),
                    event.getStartAt(),
                    event.getEndAt(),
                    event.isAllDay(),
                    UserSummary.from(event.getCreatedBy()),
                    event.getUpdatedBy() == null ? null : UserSummary.from(event.getUpdatedBy()),
                    event.getCreatedAt(),
                    event.getUpdatedAt());
        }
    }
}
