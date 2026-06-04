import { AuthenticatedUser } from '../auth/authTypes';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdBy: AuthenticatedUser;
  updatedBy: AuthenticatedUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
}
