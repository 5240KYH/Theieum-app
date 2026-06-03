import { api } from '../api';
import { NotificationItem } from './notificationTypes';

export function getNotifications() {
  return api<NotificationItem[]>('/notifications');
}

export function markNotificationRead(notificationId: number) {
  return api<NotificationItem>(`/notifications/${notificationId}/read`, {
    method: 'PATCH'
  });
}
