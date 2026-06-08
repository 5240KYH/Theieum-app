export type ApplicationStatus = 'DRAFT' | 'IN_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELED' | string;
export type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ADMIN_APPROVED' | string;

export interface UserSummary {
  id: number;
  name: string;
}

export interface ApprovalStepResponse {
  id: number;
  stepOrder: number;
  originalApprover: UserSummary;
  status: ApprovalStepStatus;
  actedAt: string | null;
}

export interface ApprovalPreviewStep {
  stepOrder: number;
  approver: UserSummary;
}

export interface ApprovalOrganizationSummary {
  id: number;
  name: string;
  parentId: number | null;
  levelNo: number;
  primary: boolean;
}

export interface ApprovalHistoryResponse {
  id: number;
  stepOrder: number | null;
  action: ApprovalStepStatus;
  originalApprover: UserSummary | null;
  actor: UserSummary;
  adminOverride: boolean;
  adminReason: string | null;
  comment: string | null;
  actedAt: string | null;
}

export interface ApplicationResponse {
  id: number;
  applicant: UserSummary;
  approvalTypeId: number;
  approvalOrganizationId: number;
  approvalOrganizationName: string;
  applicationDate: string;
  receiptDate: string;
  vendor: string;
  amount: number | string;
  description: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  approvalSteps: ApprovalStepResponse[];
  attachments?: AttachmentResponse[];
  approvalHistories?: ApprovalHistoryResponse[];
  adminOverride?: boolean;
  adminException?: boolean;
}

export interface AttachmentResponse {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

export interface CreateApplicationPayload {
  approvalTypeId?: number;
  approvalOrganizationId: number;
  applicationDate: string;
  receiptDate: string;
  vendor: string;
  amount: number;
  description: string;
}

export function applicationStatusLabel(status: ApplicationStatus) {
  const labels: Record<string, string> = {
    DRAFT: '임시저장',
    IN_APPROVAL: '결재중',
    APPROVED: '승인완료',
    REJECTED: '반려',
    CANCELED: '취소'
  };

  return labels[status] ?? status;
}

export function canEditApplication(status: ApplicationStatus) {
  return status !== 'IN_APPROVAL' && status !== 'APPROVED' && status !== 'REJECTED';
}

export function approvalStepStatusLabel(status: ApprovalStepStatus) {
  const labels: Record<string, string> = {
    PENDING: '대기',
    APPROVED: '승인',
    REJECTED: '반려',
    ADMIN_APPROVED: '관리자 승인'
  };

  return labels[status] ?? status;
}

export function currentApprover(application: ApplicationResponse) {
  return application.approvalSteps.find((step) => step.status === 'PENDING')?.originalApprover.name ?? '-';
}

export function hasAdminException(application: ApplicationResponse) {
  return Boolean(application.adminOverride || application.adminException)
    || application.approvalSteps.some((step) => step.status === 'ADMIN_APPROVED')
    || Boolean(application.approvalHistories?.some((history) => history.adminOverride));
}
