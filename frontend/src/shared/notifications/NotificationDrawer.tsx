import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api';
import { getNotifications, markNotificationRead } from './notificationApi';
import { NotificationItem, notificationTypeLabels } from './notificationTypes';

interface NotificationDrawerProps {
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '알림을 불러오지 못했습니다.';
}

function countUnread(items: NotificationItem[]) {
  return items.filter((item) => !item.read).length;
}

export function NotificationDrawer({ onClose, onUnreadCountChange }: NotificationDrawerProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await getNotifications();
        if (!ignore) {
          setNotifications(data);
          onUnreadCountChange(countUnread(data));
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
  }, [onUnreadCountChange]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      const focusableElements = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((element) => !element.hasAttribute('disabled'));
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  async function handleOpen(notification: NotificationItem) {
    let nextNotifications = notifications;

    if (!notification.read) {
      try {
        const updated = await markNotificationRead(notification.id);
        nextNotifications = notifications.map((item) => item.id === updated.id ? updated : item);
        setNotifications(nextNotifications);
        onUnreadCountChange(countUnread(nextNotifications));
      } catch (requestError) {
        setError(errorMessage(requestError));
        return;
      }
    }

    if (notification.applicationId) {
      navigate(`/applications/${notification.applicationId}`);
      onClose();
    }
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label="알림함" onKeyDown={handleKeyDown}>
      <aside className="notification-drawer">
        <div className="table-toolbar">
          <strong>알림함</strong>
          <button className="icon-button" type="button" aria-label="닫기" ref={closeButtonRef} onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {error ? <p className="form-error panel-message" role="alert">{error}</p> : null}

        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              className="notification-item"
              type="button"
              onClick={() => void handleOpen(notification)}
            >
              <span className={notification.read ? 'read-dot muted-dot' : 'read-dot'} aria-hidden="true" />
              <span>
                <strong>{notification.title}</strong>
                <small>{notificationTypeLabels[notification.notificationType] ?? notification.notificationType}</small>
                <span>{notification.body}</span>
              </span>
              {notification.applicationId ? <ExternalLink aria-hidden="true" size={16} /> : null}
            </button>
          ))}

          {!isLoading && notifications.length === 0 ? (
            <p className="panel-message">알림이 없습니다.</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
