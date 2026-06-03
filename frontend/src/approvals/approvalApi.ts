import { api } from '../shared/api';
import { ApprovalActionResponse, ApprovalInboxItem } from './approvalTypes';

export function getApprovalInbox() {
  return api<ApprovalInboxItem[]>('/approvals/inbox');
}

export function approveStep(stepId: number, comment: string) {
  return api<ApprovalActionResponse>(`/approvals/steps/${stepId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  });
}

export function rejectStep(stepId: number, comment: string) {
  return api<ApprovalActionResponse>(`/approvals/steps/${stepId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  });
}
