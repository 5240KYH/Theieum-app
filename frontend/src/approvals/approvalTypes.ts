import { ApplicationStatus, ApprovalStepStatus } from '../applications/applicationTypes';

export interface ApprovalInboxItem {
  stepId: number;
  stepOrder: number;
  stepStatus: ApprovalStepStatus;
  applicationId: number;
  receiptDate: string;
  vendor: string;
  amount: number | string;
  applicationStatus: ApplicationStatus;
  applicantId: number;
  applicantName: string;
  organizationName?: string | null;
  hasAttachment?: boolean | null;
  receivedAt?: string | null;
}

export interface ApprovalActionResponse {
  id: number;
  status: ApplicationStatus;
}
