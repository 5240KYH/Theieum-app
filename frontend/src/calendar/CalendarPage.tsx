import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent
} from './calendarApi';
import { CalendarBoard, CalendarViewMode, EventList } from './CalendarBoard';
import { CalendarEvent, CalendarEventInput } from './calendarTypes';
import {
  addDaysToDateKey,
  dateKey,
  eventsByDate,
  monthRange,
  toAllDayEndDateInputValue,
  toDateInputValue,
  toSeoulAllDayEnd,
  toSeoulAllDayStart,
  toSeoulDateTimeFromParts,
  toTimeInputValue
} from './calendarUtils';

interface CalendarFormState {
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
}

const emptyInput: CalendarFormState = {
  title: '',
  description: '',
  location: '',
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  allDay: false
};

function apiMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return '일정을 처리하지 못했습니다.';
}

export function CalendarPage() {
  const auth = useAuth();
  const canManage = auth.hasRole('ADMIN') || auth.hasRole('MANAGER');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<CalendarFormState>(emptyInput);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSaving, setSaving] = useState(false);

  const range = useMemo(() => monthRange(currentMonth), [currentMonth]);
  const groupedEvents = useMemo(() => eventsByDate(events), [events]);
  const selectedEvents = useMemo(
    () => groupedEvents.get(selectedDate) ?? [],
    [groupedEvents, selectedDate]
  );
  const sortedEvents = useMemo(
    () => [...events].sort((first, second) => first.startAt.localeCompare(second.startAt)),
    [events]
  );

  async function loadEvents() {
    setError('');
    try {
      const data = await getCalendarEvents(range.from, range.to);
      setEvents(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(apiMessage(requestError));
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [range.from, range.to]);

  function movePeriod(direction: number) {
    if (viewMode === 'week') {
      const nextSelected = addDaysToDateKey(selectedDate, direction * 7);
      const nextDate = new Date(`${nextSelected}T00:00:00`);
      setSelectedDate(nextSelected);
      setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      return;
    }
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + direction, 1));
  }

  function openCreateModal(date = selectedDate) {
    setEditingEvent(null);
    setForm({
      ...emptyInput,
      startDate: date,
      endDate: date
    });
    setModalError('');
    setModalOpen(true);
  }

  function openEditModal(event: CalendarEvent) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      startDate: toDateInputValue(event.startAt),
      startTime: toTimeInputValue(event.startAt),
      endDate: event.allDay ? toAllDayEndDateInputValue(event.endAt) : toDateInputValue(event.endAt),
      endTime: toTimeInputValue(event.endAt),
      allDay: event.allDay
    });
    setModalError('');
    setModalOpen(true);
  }

  function goToday() {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(dateKey(today));
  }

  function closeModal() {
    if (isSaving) {
      return;
    }
    setModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setModalError('');

    try {
      const input = toCalendarEventInput(form);
      if (editingEvent) {
        await updateCalendarEvent(editingEvent.id, input);
      } else {
        await createCalendarEvent(input);
      }
      setModalOpen(false);
      await loadEvents();
    } catch (requestError) {
      setModalError(apiMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent || !window.confirm('이 일정을 완전 삭제할까요? 복구할 수 없습니다.')) {
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      await deleteCalendarEvent(editingEvent.id);
      setModalOpen(false);
      await loadEvents();
    } catch (requestError) {
      setModalError(apiMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const isReadOnlyModal = Boolean(editingEvent && !canManage);

  return (
    <section className="page-section calendar-page" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">공유 일정</p>
          <h1 id="page-title">공용 캘린더</h1>
          <p className="muted-copy">모든 로그인 사용자가 함께 확인하는 일정입니다.</p>
        </div>
        {canManage ? (
          <button className="primary-button" type="button" onClick={() => openCreateModal()}>
            <Plus aria-hidden="true" size={18} />
            일정 등록
          </button>
        ) : null}
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="calendar-layout">
        <CalendarBoard
          events={events}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          viewMode={viewMode}
          canManage={canManage}
          onMovePeriod={movePeriod}
          onToday={goToday}
          onViewModeChange={setViewMode}
          onSelectDate={setSelectedDate}
          onCreate={openCreateModal}
          onOpenEvent={openEditModal}
        />

        <aside className="calendar-agenda" aria-label="선택 날짜 일정">
          <div className="table-toolbar borderless-panel">
            <strong>{selectedDate} 일정</strong>
          </div>
          <EventList events={selectedEvents} canManage={canManage} onEdit={openEditModal} emptyText="선택한 날짜의 일정이 없습니다." />
        </aside>
      </div>

      <section className="table-panel">
        <div className="table-toolbar">
          <strong>이번 달 전체 일정</strong>
        </div>
        <EventList events={sortedEvents} canManage={canManage} onEdit={openEditModal} emptyText="이번 달 일정이 없습니다." />
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
            <div className="modal-header">
              <h2 id="calendar-modal-title">
                {editingEvent ? (canManage ? '일정 수정' : '일정 상세') : '일정 등록'}
              </h2>
              <button className="icon-button" type="button" aria-label="닫기" onClick={closeModal}>
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                제목
                <input
                  value={form.title}
                  placeholder="제목 추가"
                  onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                  required
                  disabled={isReadOnlyModal}
                />
              </label>
              <label>
                시작일
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((value) => ({
                    ...value,
                    startDate: event.target.value,
                    endDate: value.endDate || event.target.value
                  }))}
                  required
                  disabled={isReadOnlyModal}
                />
              </label>
              <label>
                시작 시간
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => setForm((value) => ({ ...value, startTime: event.target.value }))}
                  required
                  disabled={isReadOnlyModal || form.allDay}
                />
              </label>
              <label>
                종료일
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((value) => ({ ...value, endDate: event.target.value }))}
                  required
                  disabled={isReadOnlyModal}
                />
              </label>
              <label>
                종료 시간
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => setForm((value) => ({ ...value, endTime: event.target.value }))}
                  required
                  disabled={isReadOnlyModal || form.allDay}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(event) => setForm((value) => ({ ...value, allDay: event.target.checked }))}
                  disabled={isReadOnlyModal}
                />
                종일
              </label>
              <label>
                장소
                <input
                  value={form.location}
                  onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))}
                  disabled={isReadOnlyModal}
                />
              </label>
              <label className="full-span">
                상세 내용
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                  rows={4}
                  disabled={isReadOnlyModal}
                />
              </label>
              {modalError ? <p className="form-error full-span" role="alert">{modalError}</p> : null}
              <div className="modal-actions full-span">
                {editingEvent && canManage ? (
                  <button className="danger-button" type="button" onClick={handleDelete} disabled={isSaving}>
                    <Trash2 aria-hidden="true" size={18} />
                    삭제
                  </button>
                ) : null}
                <button className="secondary-button" type="button" onClick={closeModal} disabled={isSaving}>
                  {isReadOnlyModal ? '닫기' : '취소'}
                </button>
                {canManage ? (
                  <button className="primary-button" type="submit" disabled={isSaving}>
                    저장
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function toCalendarEventInput(form: CalendarFormState): CalendarEventInput {
  if (form.allDay) {
    return {
      title: form.title,
      description: form.description,
      location: form.location,
      startAt: toSeoulAllDayStart(form.startDate),
      endAt: toSeoulAllDayEnd(form.endDate),
      allDay: true
    };
  }

  return {
    title: form.title,
    description: form.description,
    location: form.location,
    startAt: toSeoulDateTimeFromParts(form.startDate, form.startTime),
    endAt: toSeoulDateTimeFromParts(form.endDate, form.endTime),
    allDay: false
  };
}
