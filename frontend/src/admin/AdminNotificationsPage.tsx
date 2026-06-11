import { useEffect, useState } from 'react';

import { applicationStatusLabel } from '../applications/applicationTypes';
import { formatDateTime } from '../applications/formatters';
import { ApiError } from '../shared/api';
import {
  notificationChannelLabels,
  notificationStatusLabels,
  notificationTypeLabels
} from '../shared/notifications/notificationTypes';
import { getAdminNotificationEvents } from './adminApi';
import { AdminNotificationEvent } from './adminTypes';

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '알림 로그를 불러오지 못했습니다.';
}

function eventTitle(event: AdminNotificationEvent) {
  return event.title || notificationTypeLabels[event.notificationType] || event.notificationType;
}

function deliveryStatusLabel(status: string) {
  if (status === 'CREATED') {
    return '발송 전';
  }

  if (status === 'FAILED') {
    return '발송실패';
  }

  return notificationStatusLabels[status] ?? status;
}

export function AdminNotificationsPage() {
  const [events, setEvents] = useState<AdminNotificationEvent[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await getAdminNotificationEvents();
        if (!ignore) {
          setEvents(data);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(errorMessage(requestError));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">관리</p>
          <h1 id="page-title">알림 로그 관리</h1>
        </div>
        <span className="status-pill">{events.length}건</span>
      </div>

      <div className="table-panel">
        {error ? <p className="form-error panel-message" role="alert">{error}</p> : null}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>로그 ID</th>
                <th>알림 내용</th>
                <th>수신자</th>
                <th>사용처</th>
                <th>신청상태</th>
                <th>발송상태</th>
                <th>채널</th>
                <th>읽음</th>
                <th>처리 시각</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>#{event.id}</td>
                  <td>
                    <strong>{eventTitle(event)}</strong>
                    <p className="muted-copy notification-body-copy">{event.body || '-'}</p>
                  </td>
                  <td>
                    <strong>{event.recipientName || `#${event.recipientId}`}</strong>
                  </td>
                  <td>
                    {event.applicationVendor || '-'}
                  </td>
                  <td>
                    {event.applicationStatus ? applicationStatusLabel(event.applicationStatus) : '-'}
                  </td>
                  <td>
                    <div className="status-stack">
                      <span className="status-pill compact">{deliveryStatusLabel(event.status)}</span>
                      {event.failedReason ? <span className="danger-copy">{event.failedReason}</span> : null}
                    </div>
                  </td>
                  <td>{notificationChannelLabels[event.channel] ?? event.channel}</td>
                  <td>{event.read ? '읽음' : '미확인'}</td>
                  <td>
                    <span>{event.createdAt ? formatDateTime(event.createdAt) : '-'}</span>
                    <p className="muted-copy">발송 {event.sentAt ? formatDateTime(event.sentAt) : '-'}</p>
                  </td>
                </tr>
              ))}
              {!isLoading && events.length === 0 ? (
                <tr>
                  <td colSpan={9}>알림 로그가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
