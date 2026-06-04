package com.theieum.approval.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import com.theieum.approval.auth.AuthenticatedUser;
import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.TestDatabaseHarness;
import com.theieum.approval.common.ResourceNotFoundException;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
})
class CalendarEventServiceTest {

    @Autowired
    private CalendarEventService service;

    @Test
    void managerCreatesAndListsEventsInOverlappingRange() {
        CalendarEventService.CalendarEventResponse created = service.create(manager(), validRequest());

        List<CalendarEventService.CalendarEventResponse> events = service.list(
                OffsetDateTime.parse("2026-06-01T00:00:00+09:00"),
                OffsetDateTime.parse("2026-07-01T00:00:00+09:00"));

        assertThat(events).extracting(CalendarEventService.CalendarEventResponse::id)
                .contains(created.id());
        assertThat(events).extracting(CalendarEventService.CalendarEventResponse::title)
                .contains("월간 마감");
    }

    @Test
    void applicantCannotCreateEvent() {
        assertThatThrownBy(() -> service.create(applicant(), validRequest()))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("일정 관리 권한");
    }

    @Test
    void rejectsEndAtBeforeStartAt() {
        CalendarEventService.CalendarEventRequest request = new CalendarEventService.CalendarEventRequest(
                "시간 오류",
                "",
                "",
                OffsetDateTime.parse("2026-06-10T10:00:00+09:00"),
                OffsetDateTime.parse("2026-06-10T09:00:00+09:00"),
                false);

        assertThatThrownBy(() -> service.create(manager(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("종료 일시는 시작 일시보다 늦어야 합니다");
    }

    @Test
    void managerUpdatesAndDeletesEvent() {
        CalendarEventService.CalendarEventResponse created = service.create(manager(), validRequest());
        CalendarEventService.CalendarEventResponse updated = service.update(
                manager(),
                created.id(),
                new CalendarEventService.CalendarEventRequest(
                        "수정된 일정",
                        "수정된 설명",
                        "회의실 A",
                        OffsetDateTime.parse("2026-06-11T09:00:00+09:00"),
                        OffsetDateTime.parse("2026-06-11T11:00:00+09:00"),
                        false));

        assertThat(updated.title()).isEqualTo("수정된 일정");
        assertThat(updated.updatedBy().name()).isEqualTo("대표");

        service.delete(manager(), created.id());

        assertThatThrownBy(() -> service.update(manager(), created.id(), validRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private CalendarEventService.CalendarEventRequest validRequest() {
        return new CalendarEventService.CalendarEventRequest(
                "월간 마감",
                "영수증 제출 마감",
                "본사",
                OffsetDateTime.parse("2026-06-10T09:00:00+09:00"),
                OffsetDateTime.parse("2026-06-10T10:00:00+09:00"),
                false);
    }

    private AuthenticatedUser manager() {
        return new AuthenticatedUser(20L, "ceo", "대표", List.of("APPROVER", "MANAGER"));
    }

    private AuthenticatedUser applicant() {
        return new AuthenticatedUser(3L, "employee01", "직원01", List.of("APPLICANT"));
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
