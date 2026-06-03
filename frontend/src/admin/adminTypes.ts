import { ApplicationResponse } from '../applications/applicationTypes';

export interface AdminApplication {
  id: number;
  applicantId: number;
  applicantName: string;
  status: string;
  vendor: string;
}

export interface AdminNotificationEvent {
  id: number;
  recipientId: number;
  applicationId: number | null;
  notificationType: string;
  channel: string;
  status: string;
  read: boolean;
}

export interface AdminUser {
  id: number;
  login_id: string;
  name: string;
  email: string;
  organization_id: number;
  organization_name: string;
  position_id: number;
  position_name: string;
  roles: string;
  active: boolean;
}

export interface AdminOrganization {
  id: number;
  name: string;
  parent_id: number | null;
  level_no: number;
  sort_order: number;
  active: boolean;
}

export interface AdminPosition {
  id: number;
  name: string;
  rank_order: number;
  sort_order: number;
  active: boolean;
}

export interface ApprovalLineStep {
  id: number;
  stepOrder: number;
  stepType: string;
  organizationScope: string | null;
  positionId: number | null;
  directUserId: number | null;
  sortPolicy: string;
}

export interface AdminApprovalLine {
  id: number;
  approvalTypeId: number;
  name: string;
  active: boolean;
  steps: ApprovalLineStep[];
}

export interface AdminOverrideResult {
  id: number;
  status: string;
}

export function findPendingStep(application: ApplicationResponse) {
  return application.approvalSteps.find((step) => step.status === 'PENDING') ?? null;
}
