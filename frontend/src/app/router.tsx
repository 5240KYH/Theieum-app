import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '../auth/LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppLayout } from '../shared/layout/AppLayout';
import { PlaceholderPage } from '../shared/layout/PlaceholderPage';

const pages = {
  dashboard: {
    title: '대시보드',
    description: '내 신청 현황, 결재 대기 건수, 최근 알림을 확인합니다.'
  },
  newApplication: {
    title: '신청서 작성',
    description: '영수증 첨부 신청서를 작성하고 임시저장 또는 제출합니다.'
  },
  myApplications: {
    title: '내 신청서',
    description: '내가 작성한 신청서의 상태와 처리 이력을 확인합니다.'
  },
  applicationDetail: {
    title: '신청서 상세',
    description: '신청 내용, 첨부 이미지, 결재 단계와 이력을 확인합니다.'
  },
  approvals: {
    title: '결재함',
    description: '나에게 배정된 결재 요청을 검토하고 승인 또는 반려합니다.'
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
          <Route path="/applications/new" element={<PlaceholderPage {...pages.newApplication} />} />
          <Route path="/applications/my" element={<PlaceholderPage {...pages.myApplications} />} />
          <Route path="/applications/:id" element={<PlaceholderPage {...pages.applicationDetail} />} />
          <Route path="/approvals" element={<PlaceholderPage {...pages.approvals} />} />
          <Route path="/admin/users" element={<PlaceholderPage {...pages.adminUsers} />} />
          <Route path="/admin/organizations" element={<PlaceholderPage {...pages.adminOrganizations} />} />
          <Route path="/admin/positions" element={<PlaceholderPage {...pages.adminPositions} />} />
          <Route path="/admin/approval-lines" element={<PlaceholderPage {...pages.adminApprovalLines} />} />
          <Route path="/admin/applications" element={<PlaceholderPage {...pages.adminApplications} />} />
          <Route path="/admin/notifications" element={<PlaceholderPage {...pages.adminNotifications} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
