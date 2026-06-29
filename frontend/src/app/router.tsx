import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminApplicationsPage } from '../admin/AdminApplicationsPage';
import { AdminNotificationsPage } from '../admin/AdminNotificationsPage';
import { AdminReferencePage } from '../admin/AdminReferencePage';
import { ApplicationDetailPage } from '../applications/ApplicationDetailPage';
import { ApplicationForm } from '../applications/ApplicationForm';
import { MyApplicationsPage } from '../applications/MyApplicationsPage';
import { ApprovalsInboxPage } from '../approvals/ApprovalsInboxPage';
import { LoginPage } from '../auth/LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { CalendarPage } from '../calendar/CalendarPage';
import { DashboardPage } from '../dashboard/DashboardPage';
import { AppLayout } from '../shared/layout/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<Navigate replace to="/dashboard" />} />
          <Route element={<ProtectedRoute requiredRole="APPLICANT" />}>
            <Route path="/applications/new" element={<ApplicationForm />} />
            <Route path="/applications/:id/edit" element={<ApplicationForm />} />
            <Route path="/applications/my" element={<MyApplicationsPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredAnyRole={['APPLICANT', 'APPROVER', 'ADMIN', 'MANAGER']} />}>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole="APPROVER" />}>
            <Route path="/approvals" element={<ApprovalsInboxPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredAnyRole={['ADMIN', 'MANAGER']} />}>
            <Route path="/admin/users" element={<AdminReferencePage kind="users" />} />
            <Route path="/admin/organizations" element={<AdminReferencePage kind="organizations" />} />
            <Route path="/admin/positions" element={<AdminReferencePage kind="positions" />} />
            <Route path="/admin/approval-lines" element={<AdminReferencePage kind="approvalLines" />} />
            <Route path="/admin/approval-org-exceptions" element={<AdminReferencePage kind="approvalOrgExceptions" />} />
            <Route path="/admin/calendar" element={<CalendarPage />} />
            <Route path="/admin/applications" element={<AdminApplicationsPage />} />
            <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
