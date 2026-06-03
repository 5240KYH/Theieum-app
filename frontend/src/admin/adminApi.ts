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

export function createAdminUser(payload: unknown) {
  return api<AdminUser>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminUser(id: number, payload: unknown) {
  return api<AdminUser>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminUser(id: number) {
  return api<void>(`/admin/users/${id}`, { method: 'DELETE' });
}

export function updateAdminUserPassword(id: number, newPassword: string) {
  return api<void>(`/admin/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ newPassword })
  });
}

export function getAdminOrganizations() {
  return api<AdminOrganization[]>('/admin/organizations');
}

export function createAdminOrganization(payload: unknown) {
  return api<AdminOrganization>('/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminOrganization(id: number, payload: unknown) {
  return api<AdminOrganization>(`/admin/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminOrganization(id: number) {
  return api<void>(`/admin/organizations/${id}`, { method: 'DELETE' });
}

export function getAdminPositions() {
  return api<AdminPosition[]>('/admin/positions');
}

export function createAdminPosition(payload: unknown) {
  return api<AdminPosition>('/admin/positions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminPosition(id: number, payload: unknown) {
  return api<AdminPosition>(`/admin/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminPosition(id: number) {
  return api<void>(`/admin/positions/${id}`, { method: 'DELETE' });
}

export function getAdminApprovalLines() {
  return api<AdminApprovalLine[]>('/admin/approval-lines');
}

export function createAdminApprovalLine(payload: unknown) {
  return api<AdminApprovalLine>('/admin/approval-lines', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminApprovalLine(id: number, payload: unknown) {
  return api<AdminApprovalLine>(`/admin/approval-lines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminApprovalLine(id: number) {
  return api<void>(`/admin/approval-lines/${id}`, { method: 'DELETE' });
}

export function getAdminApprovalOrgExceptions() {
  return api<AdminApprovalOrgException[]>('/admin/approval-org-exceptions');
}

export function createAdminApprovalOrgException(payload: unknown) {
  return api<AdminApprovalOrgException>('/admin/approval-org-exceptions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAdminApprovalOrgException(id: number, payload: unknown) {
  return api<AdminApprovalOrgException>(`/admin/approval-org-exceptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminApprovalOrgException(id: number) {
  return api<void>(`/admin/approval-org-exceptions/${id}`, { method: 'DELETE' });
}

export { getApplication };
