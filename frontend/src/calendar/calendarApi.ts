import { api } from '../shared/api';
import { CalendarEvent, CalendarEventInput } from './calendarTypes';

export function getCalendarEvents(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return api<CalendarEvent[]>(`/calendar/events?${query.toString()}`);
}

export function createCalendarEvent(input: CalendarEventInput) {
  return api<CalendarEvent>('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateCalendarEvent(id: number, input: CalendarEventInput) {
  return api<CalendarEvent>(`/calendar/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export function deleteCalendarEvent(id: number) {
  return api<void>(`/calendar/events/${id}`, {
    method: 'DELETE'
  });
}
