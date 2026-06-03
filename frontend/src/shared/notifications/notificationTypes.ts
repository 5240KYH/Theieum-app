export interface NotificationItem {
  id: number;
  applicationId: number | null;
  notificationType: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  read: boolean;
  createdAt: string;
}

export const notificationTypeLabels: Record<string, string> = {
  APPROVAL_REQUESTED: '결재 요청',
  APPLICATION_APPROVED: '최종 결재 완료',
  APPLICATION_REJECTED: '반려',
  ADMIN_APPROVED: '관리자 예외 승인'
};

export const notificationChannelLabels: Record<string, string> = {
  IN_APP: '인앱',
  EMAIL: '이메일',
  KAKAO: '카카오'
};

export const notificationStatusLabels: Record<string, string> = {
  CREATED: '생성',
  SENT: '발송완료',
  FAILED: '실패'
};
