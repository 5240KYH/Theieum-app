import { api, apiBlob } from '../shared/api';
import { ApplicationResponse, AttachmentResponse, CreateApplicationPayload } from './applicationTypes';

export function createApplication(payload: CreateApplicationPayload) {
  return api<ApplicationResponse>('/applications', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateApplication(applicationId: number, payload: CreateApplicationPayload) {
  return api<ApplicationResponse>(`/applications/${applicationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function attachReceiptImage(applicationId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return api<AttachmentResponse>(`/applications/${applicationId}/attachments`, {
    method: 'POST',
    body: formData
  });
}

export function submitApplication(applicationId: number) {
  return api<ApplicationResponse>(`/applications/${applicationId}/submit`, {
    method: 'POST'
  });
}

export function cancelApplication(applicationId: number) {
  return api<ApplicationResponse>(`/applications/${applicationId}/cancel`, {
    method: 'POST'
  });
}

export function getMyApplications() {
  return api<ApplicationResponse[]>('/applications/my');
}

export function getApplication(applicationId: string | number) {
  return api<ApplicationResponse>(`/applications/${applicationId}`);
}

export function getAttachmentContent(applicationId: string | number, attachmentId: string | number) {
  return apiBlob(`/applications/${applicationId}/attachments/${attachmentId}/content`);
}
