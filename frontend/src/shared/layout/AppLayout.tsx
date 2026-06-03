import {
  Bell,
  Building2,
  FileClock,
  FilePlus2,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  PanelLeft,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';

const workNavItems = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { to: '/applications/new', label: '새 신청', icon: FilePlus2 },
  { to: '/applications/my', label: '내 신청서', icon: FileClock },
  { to: '/approvals', label: '결재함', icon: ListChecks }
];

const adminNavItems = [
  { to: '/admin/users', label: '사용자 관리', icon: UsersRound },
  { to: '/admin/organizations', label: '조직 관리', icon: Building2 },
  { to: '/admin/positions', label: '직위 관리', icon: ShieldCheck },
  { to: '/admin/approval-lines', label: '결재선 관리', icon: Network },
  { to: '/admin/applications', label: '전체 신청서', icon: FileText },
  { to: '/admin/notifications', label: '알림 로그', icon: Bell }
];

export function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const isAdmin = auth.hasRole('ADMIN');

  function handleLogout() {
    auth.logout();
    navigate('/login', { replace: true });
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

        {isAdmin ? (
          <nav className="nav-section">
            <p>관리</p>
            {adminNavItems.map(({ to, label, icon: Icon }) => (
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
            <button className="icon-button" type="button" aria-label="알림함">
              <Bell aria-hidden="true" size={18} />
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
    </div>
  );
}
