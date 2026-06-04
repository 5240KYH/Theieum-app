package com.theieum.approval.calendar;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    List<CalendarEvent> findByStartAtBeforeAndEndAtAfterOrderByStartAtAsc(OffsetDateTime to, OffsetDateTime from);
}
