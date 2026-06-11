import {
  Bell,
  Building2,
  CalendarDays,
  FileClock,
  FilePlus2,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  PanelLeft,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { ApiError, api } from '../api';
import { getNotifications } from '../notifications/notificationApi';
import { NotificationDrawer } from '../notifications/NotificationDrawer';

const workNavItems = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { to: '/applications/new', label: '새 신청', icon: FilePlus2 },
  { to: '/applications/my', label: '내 신청서', icon: FileClock },
  { to: '/approvals', label: '결재함', icon: ListChecks }
];

const referenceNavItems = [
  { to: '/admin/calendar', label: '캘린더', icon: CalendarDays },
  { to: '/admin/users', label: '사용자 관리', icon: UsersRound },
  { to: '/admin/organizations', label: '조직 관리', icon: Building2 },
  { to: '/admin/positions', label: '직위 관리', icon: ShieldCheck },
  { to: '/admin/approval-lines', label: '결재선 관리', icon: Network },
  { to: '/admin/approval-org-exceptions', label: '예외 결재자', icon: ShieldCheck }
];

const adminOnlyNavItems = [
  { to: '/admin/applications', label: '전체 신청서', icon: FileText },
  { to: '/admin/notifications', label: '알림 로그', icon: Bell }
];

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

export function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const isAdmin = auth.hasRole('ADMIN');
  const canManage = isAdmin || auth.hasRole('MANAGER');
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isMobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadUnreadCount() {
      try {
        const notifications = await getNotifications();
        if (!ignore && Array.isArray(notifications)) {
          setUnreadCount(notifications.filter((notification) => !notification.read).length);
        }
      } catch {
        if (!ignore) {
          setUnreadCount(0);
        }
      }
    }

    void loadUnreadCount();

    return () => {
      ignore = true;
    };
  }, []);

  function handleLogout() {
    if (!window.confirm('로그아웃 하시겠습니까?')) {
      return;
    }
    auth.logout();
    navigate('/login', { replace: true });
  }

  function closeNotifications() {
    setNotificationOpen(false);
    window.requestAnimationFrame(() => notificationButtonRef.current?.focus());
  }

  function closeMobileMore() {
    setMobileMoreOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div className="sidebar-header">
          <PanelLeft aria-hidden="true" size={22} />
          <div>
            <strong>더이음 결재</strong>
            <span>Receipt Approval</span>
          </div>
        </div>

        <nav className="nav-section">
          <p>업무</p>
          {workNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {canManage ? (
          <nav className="nav-section">
            <p>관리</p>
            {referenceNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
            {adminOnlyNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar-label">로그인 사용자</span>
            <strong>{auth.user?.name}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="알림함"
              ref={notificationButtonRef}
              onClick={() => setNotificationOpen(true)}
            >
              <Bell aria-hidden="true" size={18} />
              {unreadCount > 0 ? <span className="notification-badge">{unreadCount}</span> : null}
            </button>
            <button className="secondary-button" type="button" onClick={() => setPasswordOpen(true)}>
              <KeyRound aria-hidden="true" size={18} />
              내 비밀번호 변경
            </button>
            <button className="secondary-button" type="button" onClick={handleLogout}>
              <LogOut aria-hidden="true" size={18} />
              로그아웃
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
      <nav className="mobile-tabbar" aria-label="모바일 주요 메뉴">
        {workNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={closeMobileMore}>
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          aria-label="더보기 메뉴 열기"
          aria-expanded={isMobileMoreOpen}
          onClick={() => setMobileMoreOpen((value) => !value)}
        >
          <MoreHorizontal aria-hidden="true" size={18} />
          <span>더보기</span>
        </button>
      </nav>
      {isMobileMoreOpen ? (
        <div className="mobile-more-panel" role="dialog" aria-label="모바일 더보기 메뉴">
          <div className="table-toolbar borderless-panel">
            <strong>더보기</strong>
            <button className="icon-button" type="button" aria-label="더보기 메뉴 닫기" onClick={closeMobileMore}>
              <Menu aria-hidden="true" size={18} />
            </button>
          </div>
          <nav className="mobile-more-links" aria-label="모바일 관리 메뉴">
            {canManage ? (
              <>
                {[...referenceNavItems, ...adminOnlyNavItems].map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={closeMobileMore}>
                    <Icon aria-hidden="true" size={18} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </>
            ) : (
              <p className="panel-message">관리 메뉴 권한이 없습니다.</p>
            )}
          </nav>
        </div>
      ) : null}
      {isNotificationOpen ? (
        <NotificationDrawer
          onClose={closeNotifications}
          onUnreadCountChange={handleUnreadCountChange}
        />
      ) : null}
      {isPasswordOpen ? <PasswordChangeModal onClose={() => setPasswordOpen(false)} /> : null}
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await api<void>('/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('비밀번호가 변경되었습니다.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <form className="preview-modal compact-modal form-panel" onSubmit={handleSubmit}>
        <div className="table-toolbar borderless-panel">
          <strong id="password-modal-title">내 비밀번호 변경</strong>
          <button className="icon-button" type="button" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <label>
          현재 비밀번호
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          새 비밀번호
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="form-success" role="status">{message}</p> : null}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>취소</button>
          <button className="primary-button" type="submit" disabled={isSaving}>변경 저장</button>
        </div>
      </form>
    </div>
  );
}
