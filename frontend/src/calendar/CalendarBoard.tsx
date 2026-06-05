import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Pencil, Plus } from 'lucide-react';

import { CalendarEvent } from './calendarTypes';
import {
  dateKey,
  displayEventChipRange,
  displayEventMobileMarker,
  displayEventRange,
  eventsByDate,
  monthDays,
  monthLabel,
  weekDays,
  weekLabel
} from './calendarUtils';

export type CalendarViewMode = 'month' | 'week' | 'list';

const viewModes: Array<{ label: string; value: CalendarViewMode; ariaLabel: string }> = [
  { label: '월', value: 'month', ariaLabel: '월 보기' },
  { label: '주', value: 'week', ariaLabel: '주 보기' },
  { label: '목록', value: 'list', ariaLabel: '목록 보기' }
];

export function CalendarBoard({
  events,
  currentMonth,
  selectedDate,
  viewMode,
  canManage = false,
  onMovePeriod,
  onToday,
  onViewModeChange,
  onSelectDate,
  onCreate,
  onOpenEvent,
  className = ''
}: {
  events: CalendarEvent[];
  currentMonth: Date;
  selectedDate: string;
  viewMode: CalendarViewMode;
  canManage?: boolean;
  onMovePeriod: (direction: number) => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onSelectDate: (date: string) => void;
  onCreate?: (date: string) => void;
  onOpenEvent?: (event: CalendarEvent) => void;
  className?: string;
}) {
  const groupedEvents = eventsByDate(events);
  const selectedEvents = groupedEvents.get(selectedDate) ?? [];
  const selectedDateValue = new Date(`${selectedDate}T00:00:00`);
  const sortedEvents = [...events].sort((first, second) => first.startAt.localeCompare(second.startAt));
  const days = viewMode === 'week' ? weekDays(selectedDateValue) : monthDays(currentMonth);
  const periodLabel = viewMode === 'week' ? weekLabel(selectedDateValue) : monthLabel(currentMonth);
  const previousLabel = viewMode === 'week' ? '이전 주' : '이전 달';
  const nextLabel = viewMode === 'week' ? '다음 주' : '다음 달';

  function renderCalendarDay(day: Date) {
    const key = dateKey(day);
    const dayEvents = groupedEvents.get(key) ?? [];
    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
    const isSelected = key === selectedDate;
    const isToday = key === dateKey(new Date());

    return (
      <div
        className={[
          'calendar-day',
          isSelected ? 'selected' : '',
          isToday ? 'today' : '',
          isCurrentMonth ? '' : 'outside-month'
        ].filter(Boolean).join(' ')}
        key={key}
      >
        <button
          className="calendar-day-select-hitbox"
          type="button"
          aria-label={`${key} 날짜 영역 선택`}
          onClick={() => onSelectDate(key)}
        />
        <div className="calendar-day-topline">
          <button
            className="calendar-date-button"
            type="button"
            aria-label={`${key} 선택`}
            onClick={() => onSelectDate(key)}
          >
            {day.getDate()}
          </button>
          {canManage && onCreate ? (
            <button
              className="calendar-day-add"
              type="button"
              aria-label={`${key} 일정 추가`}
              onClick={() => {
                onSelectDate(key);
                onCreate(key);
              }}
            >
              <Plus aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>
        <div className="calendar-chip-list">
          {dayEvents.slice(0, 3).map((event) => {
            const chipRange = displayEventChipRange(event.startAt, event.endAt, event.allDay);
            const mobileMarker = displayEventMobileMarker(event.startAt, event.endAt, event.allDay);
            const chipLabel = `${chipRange} ${event.title}`;
            return onOpenEvent ? (
              <button
                className="calendar-event-chip"
                type="button"
                key={event.id}
                aria-label={chipLabel}
                onClick={() => {
                  onSelectDate(key);
                  onOpenEvent(event);
                }}
              >
                <span className="calendar-event-time calendar-event-time-full">{chipRange}</span>
                <span className="calendar-event-time calendar-event-time-compact" aria-label={`모바일 축약: ${mobileMarker}`}>
                  {mobileMarker}
                </span>
                <span className="calendar-event-title">{event.title}</span>
              </button>
            ) : (
              <button
                className="calendar-event-chip static-chip"
                type="button"
                key={event.id}
                aria-label={chipLabel}
                onClick={() => onSelectDate(key)}
              >
                <span className="calendar-event-time calendar-event-time-full">{chipRange}</span>
                <span className="calendar-event-time calendar-event-time-compact" aria-label={`모바일 축약: ${mobileMarker}`}>
                  {mobileMarker}
                </span>
                <span className="calendar-event-title">{event.title}</span>
              </button>
            );
          })}
          {dayEvents.length > 3 ? <small>+{dayEvents.length - 3}</small> : null}
        </div>
      </div>
    );
  }

  return (
    <section
      className={['calendar-board', `calendar-board-${viewMode}`, className].filter(Boolean).join(' ')}
      aria-label="공용 캘린더"
    >
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <button className="secondary-button compact-button" type="button" onClick={onToday}>
            오늘
          </button>
          <button className="icon-button" type="button" aria-label={previousLabel} onClick={() => onMovePeriod(-1)}>
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button className="icon-button" type="button" aria-label={nextLabel} onClick={() => onMovePeriod(1)}>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          <strong>{periodLabel}</strong>
        </div>
        <div className="segmented-control" aria-label="캘린더 보기 방식">
          {viewModes.map((mode) => (
            <button
              type="button"
              key={mode.value}
              aria-label={mode.ariaLabel}
              aria-pressed={viewMode === mode.value}
              onClick={() => onViewModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="calendar-list-view">
          <div className="table-toolbar borderless-panel">
            <strong>월간 목록</strong>
          </div>
          <EventList
            events={sortedEvents}
            canManage={canManage}
            onEdit={onOpenEvent}
            emptyText="이번 달 일정이 없습니다."
          />
        </div>
      ) : (
        <>
          {viewMode === 'week' ? (
            <div className="calendar-subtitle">주간 일정</div>
          ) : null}
          <div className="calendar-weekdays" aria-hidden="true">
            {['일', '월', '화', '수', '목', '금', '토'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className={viewMode === 'week' ? 'calendar-grid week-grid' : 'calendar-grid'}>
            {days.map(renderCalendarDay)}
          </div>
          <aside className="calendar-mobile-agenda" aria-label="모바일 선택 날짜 일정">
            <div className="table-toolbar borderless-panel">
              <strong>{selectedDate} 일정</strong>
            </div>
            <EventList
              events={selectedEvents}
              canManage={canManage}
              onEdit={onOpenEvent}
              emptyText="선택한 날짜의 일정이 없습니다."
            />
          </aside>
        </>
      )}
    </section>
  );
}

export function EventList({
  events,
  canManage,
  onEdit,
  emptyText
}: {
  events: CalendarEvent[];
  canManage: boolean;
  onEdit?: (event: CalendarEvent) => void;
  emptyText: string;
}) {
  if (events.length === 0) {
    return <p className="panel-message">{emptyText}</p>;
  }

  return (
    <div className="calendar-event-list">
      {events.map((event) => (
        <article className="calendar-event-card" key={event.id}>
          <CalendarDays aria-hidden="true" size={18} />
          <div>
            <strong>{event.title}</strong>
            <span>{displayEventRange(event.startAt, event.endAt, event.allDay)}</span>
            {event.location ? (
              <small>
                <MapPin aria-hidden="true" size={14} />
                {event.location}
              </small>
            ) : null}
            {event.description ? <p>{event.description}</p> : null}
          </div>
          {canManage && onEdit ? (
            <button
              className="icon-button"
              type="button"
              aria-label={`${event.title} 수정`}
              onClick={() => onEdit(event)}
            >
              <Pencil aria-hidden="true" size={16} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
