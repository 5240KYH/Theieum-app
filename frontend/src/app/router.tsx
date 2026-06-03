import { Navigate, Route, Routes } from 'react-router-dom';

import { ApplicationDetailPage } from '../applications/ApplicationDetailPage';
import { ApplicationForm } from '../applications/ApplicationForm';
import { MyApplicationsPage } from '../applications/MyApplicationsPage';
import { ApprovalsInboxPage } from '../approvals/ApprovalsInboxPage';
import { LoginPage } from '../auth/LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppLayout } from '../shared/layout/AppLayout';
import { PlaceholderPage } from '../shared/layout/PlaceholderPage';

const pages = {
  dashboard: {
    title: '대시보드',
    description: '내 신청 현황, 결재 대기 건수, 최근 알림을 확인합니다.'
  },
  adminUsers: {
    title: '사용자 관리',
    description: '사용자 계정, 역할, 조직, 직위 정보를 관리합니다.'
  },
  adminOrganizations: {
    title: '조직 관리',
    description: '상위 조직을 포함한 조직 구조를 관리합니다.'
  },
  adminPositions: {
    title: '직위 관리',
    description: '결재자 산정에 사용하는 직위 정보를 관리합니다.'
  },
  adminApprovalLines: {
    title: '결재선 관리',
    description: '전자결재 유형별 결재 단계와 대상자를 관리합니다.'
  },
  adminApplications: {
    title: '전체 신청서 관리',
    description: '전체 신청서 목록과 관리자 예외 처리를 관리합니다.'
  },
  adminNotifications: {
    title: '알림 로그 관리',
    description: '결재 이벤트와 인앱 알림 처리 로그를 확인합니다.'
  }
};

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="/dashboard" element={<PlaceholderPage {...pages.dashboard} />} />
          <Route element={<ProtectedRoute requiredRole="APPLICANT" />}>
            <Route path="/applications/new" element={<ApplicationForm />} />
            <Route path="/applications/my" element={<MyApplicationsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredAnyRole={['APPLICANT', 'APPROVER', 'ADMIN']} />}>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole="APPROVER" />}>
            <Route path="/approvals" element={<ApprovalsInboxPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
            <Route path="/admin/users" element={<PlaceholderPage {...pages.adminUsers} />} />
            <Route path="/admin/organizations" element={<PlaceholderPage {...pages.adminOrganizations} />} />
            <Route path="/admin/positions" element={<PlaceholderPage {...pages.adminPositions} />} />
            <Route path="/admin/approval-lines" element={<PlaceholderPage {...pages.adminApprovalLines} />} />
            <Route path="/admin/applications" element={<PlaceholderPage {...pages.adminApplications} />} />
            <Route path="/admin/notifications" element={<PlaceholderPage {...pages.adminNotifications} />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
