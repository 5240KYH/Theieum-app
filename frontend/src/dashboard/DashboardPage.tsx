import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, ClipboardList, ListChecks } from 'lucide-react';

import { getMyApplications } from '../applications/applicationApi';
import { ApplicationResponse } from '../applications/applicationTypes';
import { getApprovalInbox } from '../approvals/approvalApi';
import { ApprovalInboxItem } from '../approvals/approvalTypes';
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
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [approvalInbox, setApprovalInbox] = useState<ApprovalInboxItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setError('');

      try {
        const [myApplications, inbox, myNotifications] = await Promise.all([
          loadOrEmpty(getMyApplications),
          loadOrEmpty(getApprovalInbox),
          loadOrEmpty(getNotifications)
        ]);
        if (!ignore) {
          setApplications(myApplications);
          setApprovalInbox(inbox);
          setNotifications(myNotifications);
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
  }, []);

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

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">업무 현황</p>
          <h1 id="page-title">대시보드</h1>
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
