package com.theieum.approval.calendar;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.auth.AuthenticatedUser;

@RestController
@RequestMapping("/api/calendar/events")
public class CalendarController {

    private final CalendarEventService calendarEventService;

    public CalendarController(CalendarEventService calendarEventService) {
        this.calendarEventService = calendarEventService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<CalendarEventService.CalendarEventResponse> events(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam OffsetDateTime from,
            @RequestParam OffsetDateTime to) {
        requireUser(user);
        return calendarEventService.list(from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarEventService.CalendarEventResponse create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody CalendarEventService.CalendarEventRequest request) {
        requireUser(user);
        return calendarEventService.create(user, request);
    }

    @PutMapping("/{id}")
    public CalendarEventService.CalendarEventResponse update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @RequestBody CalendarEventService.CalendarEventRequest request) {
        requireUser(user);
        return calendarEventService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireUser(user);
        calendarEventService.delete(user, id);
    }

    private void requireUser(AuthenticatedUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }
}
