import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CalendarDays, ClipboardList, ListChecks } from 'lucide-react';

import { getMyApplications } from '../applications/applicationApi';
import { ApplicationResponse } from '../applications/applicationTypes';
import { getApprovalInbox } from '../approvals/approvalApi';
import { ApprovalInboxItem } from '../approvals/approvalTypes';
import { useAuth } from '../auth/AuthContext';
import { getCalendarEvents } from '../calendar/calendarApi';
import { CalendarBoard, CalendarViewMode } from '../calendar/CalendarBoard';
import { CalendarEvent } from '../calendar/calendarTypes';
import { addDaysToDateKey, dateKey, monthRange } from '../calendar/calendarUtils';
import { ApiError } from '../shared/api';
import { getNotifications } from '../shared/notifications/notificationApi';
import { NotificationItem } from '../shared/notifications/notificationTypes';

function canIgnore(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

async function loadOrEmpty<T>(loader: () => Promise<T[]>) {
  try {
    const data = await loader();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (canIgnore(error)) {
      return [];
    }
    throw error;
  }
}

export function DashboardPage() {
  const auth = useAuth();
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [approvalInbox, setApprovalInbox] = useState<ApprovalInboxItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [error, setError] = useState('');
  const calendarRange = useMemo(() => monthRange(currentMonth), [currentMonth]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setError('');

      try {
        const [myApplications, inbox, myNotifications] = await Promise.all([
          loadOrEmpty(getMyApplications),
          auth.hasRole('APPROVER') ? loadOrEmpty(getApprovalInbox) : Promise.resolve([]),
          loadOrEmpty(getNotifications)
        ]);
        const sharedEvents = await loadOrEmpty(() => getCalendarEvents(calendarRange.from, calendarRange.to));
        if (!ignore) {
          setApplications(myApplications);
          setApprovalInbox(inbox);
          setNotifications(myNotifications);
          setCalendarEvents(sharedEvents);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError instanceof Error ? requestError.message : '대시보드를 불러오지 못했습니다.');
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [auth, calendarRange.from, calendarRange.to]);

  const metrics = useMemo(() => {
    const inProgress = applications.filter((application) => application.status === 'IN_APPROVAL').length;
    const rejected = applications.filter((application) => application.status === 'REJECTED').length;
    const unread = notifications.filter((notification) => !notification.read).length;

    return [
      { label: '내 신청 진행중', value: inProgress, icon: ClipboardList },
      { label: '결재 대기', value: approvalInbox.length, icon: ListChecks },
      { label: '반려/보완 필요', value: rejected, icon: AlertCircle },
      { label: '최근 알림', value: unread, icon: Bell }
    ];
  }, [applications, approvalInbox, notifications]);

  function moveCalendarPeriod(direction: number) {
    if (calendarView === 'week') {
      const nextSelected = addDaysToDateKey(selectedDate, direction * 7);
      const nextDate = new Date(`${nextSelected}T00:00:00`);
      setSelectedDate(nextSelected);
      setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      return;
    }
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + direction, 1));
  }

  function goToday() {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(dateKey(today));
  }

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">업무 현황</p>
          <h1 id="page-title">대시보드</h1>
          {auth.user?.name ? <p className="muted-copy">{auth.user.name}님</p> : null}
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="metric-grid">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div className="metric-tile" key={label}>
            <Icon aria-hidden="true" size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-calendar-panel table-panel">
        <div className="table-toolbar">
          <strong>
            <CalendarDays aria-hidden="true" size={18} />
            공용 캘린더
          </strong>
        </div>
        <CalendarBoard
          events={calendarEvents}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          viewMode={calendarView}
          onMovePeriod={moveCalendarPeriod}
          onToday={goToday}
          onViewModeChange={setCalendarView}
          onSelectDate={setSelectedDate}
          onOpenEvent={() => undefined}
          className="dashboard-calendar-board"
        />
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>최근 알림</strong>
        </div>
        <div className="notification-list compact-list">
          {notifications.slice(0, 5).map((notification) => (
            <div className="notification-item static-item" key={notification.id}>
              <span className={notification.read ? 'read-dot muted-dot' : 'read-dot'} aria-hidden="true" />
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.createdAt}</small>
                <span>{notification.body}</span>
              </span>
            </div>
          ))}
          {notifications.length === 0 ? <p className="panel-message">최근 알림이 없습니다.</p> : null}
        </div>
      </div>
    </section>
  );
}
