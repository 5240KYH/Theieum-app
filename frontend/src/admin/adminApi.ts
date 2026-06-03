import { getApplication } from '../applications/applicationApi';
import { api } from '../shared/api';
import {
  AdminApplication,
  AdminApprovalLine,
  AdminApprovalOrgException,
  AdminNotificationEvent,
  AdminOrganization,
  AdminOverrideResult,
  AdminPosition,
  AdminUser
} from './adminTypes';

export function getAdminApplications() {
  return api<AdminApplication[]>('/admin/applications');
}

export function adminApproveStep(stepId: number, reason: string) {
  return api<AdminOverrideResult>(`/admin/approvals/steps/${stepId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export function getAdminNotificationEvents() {
  return api<AdminNotificationEvent[]>('/admin/notification-events');
}

export function getAdminUsers() {
  return api<AdminUser[]>('/admin/users');
}

export function getAdminOrganizations() {
  return api<AdminOrganization[]>('/admin/organizations');
}

export function getAdminPositions() {
  return api<AdminPosition[]>('/admin/positions');
}

export function getAdminApprovalLines() {
  return api<AdminApprovalLine[]>('/admin/approval-lines');
}

export function getAdminApprovalOrgExceptions() {
  return api<AdminApprovalOrgException[]>('/admin/approval-org-exceptions');
}

export { getApplication };
