import { CalendarEvent } from './calendarTypes';

const SEOUL_OFFSET = '+09:00';
const SEOUL_TIME_ZONE = 'Asia/Seoul';

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function eventDateKey(value: string) {
  return value.slice(0, 10);
}

export function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function weekLabel(date: Date) {
  const [start, , , , , , end] = weekDays(date);
  return `${dateKey(start)} ~ ${dateKey(end)}`;
}

export function monthRange(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return {
    from: `${dateKey(first)}T00:00:00${SEOUL_OFFSET}`,
    to: `${dateKey(next)}T00:00:00${SEOUL_OFFSET}`
  };
}

export function monthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function weekDays(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function eventsByDate(events: CalendarEvent[]) {
  const groups = events.reduce((currentGroups, event) => {
    eventDateKeys(event).forEach((key) => {
      const values = currentGroups.get(key) ?? [];
      values.push(event);
      currentGroups.set(key, values);
    });
    return currentGroups;
  }, new Map<string, CalendarEvent[]>());

  groups.forEach((values) => {
    values.sort((first, second) => first.startAt.localeCompare(second.startAt));
  });

  return groups;
}

export function displayEventChipRange(startAt: string, endAt: string, allDay = false) {
  const startDate = toDateInputValue(startAt);
  const endDate = allDay ? previousDateKey(toDateInputValue(endAt)) : toDateInputValue(endAt);

  if (allDay) {
    return startDate === endDate
      ? '종일'
      : `${shortDate(startDate)}-${shortDate(endDate)} 종일`;
  }

  const startTime = toTimeInputValue(startAt);
  const endTime = toTimeInputValue(endAt);
  if (startDate === endDate) {
    return `${startTime}-${endTime}`;
  }

  return `${shortDate(startDate)} ${startTime}-${shortDate(endDate)} ${endTime}`;
}

export function displayEventMobileMarker(startAt: string, endAt: string, allDay = false) {
  const startDate = toDateInputValue(startAt);
  const endDate = allDay ? previousDateKey(toDateInputValue(endAt)) : toDateInputValue(endAt);

  if (startDate !== endDate) {
    return `${shortDate(startDate)}-${shortDate(endDate)}`;
  }

  if (allDay) {
    return '종일';
  }

  return toTimeInputValue(startAt);
}

function eventDateKeys(event: CalendarEvent) {
  const startDate = toDateInputValue(event.startAt);
  const endDate = event.allDay
    ? previousDateKey(toDateInputValue(event.endAt))
    : toDateInputValue(event.endAt);
  const keys: string[] = [];
  let current = startDate;

  for (let dayCount = 0; dayCount < 370; dayCount += 1) {
    keys.push(current);
    if (current >= endDate) {
      break;
    }
    current = addDaysToDateKey(current, 1);
  }

  return keys;
}

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function displayDateTime(value: string, allDay = false) {
  if (allDay) {
    return toDateInputValue(value);
  }
  return `${toDateInputValue(value)} ${toTimeInputValue(value)}`;
}

export function displayTime(value: string, allDay = false) {
  if (allDay) {
    return '종일';
  }
  return toTimeInputValue(value);
}

export function displayEventRange(startAt: string, endAt: string, allDay = false) {
  const startDate = toDateInputValue(startAt);
  const endDate = allDay ? previousDateKey(toDateInputValue(endAt)) : toDateInputValue(endAt);

  if (allDay) {
    return startDate === endDate ? `${startDate} 종일` : `${startDate} ~ ${endDate} 종일`;
  }

  const startTime = toTimeInputValue(startAt);
  const endTime = toTimeInputValue(endAt);
  if (startDate === endDate) {
    return `${startDate} ${startTime}~${endTime}`;
  }
  return `${startDate} ${startTime} ~ ${endDate} ${endTime}`;
}

export function toSeoulDateTime(value: string) {
  if (!value) {
    return '';
  }
  return `${value}:00${SEOUL_OFFSET}`;
}

export function toDateTimeLocal(value: string) {
  return `${toDateInputValue(value)}T${toTimeInputValue(value)}`;
}

export function toDateInputValue(value: string) {
  return seoulParts(value).date;
}

export function toTimeInputValue(value: string) {
  return seoulParts(value).time;
}

export function toSeoulDateTimeFromParts(date: string, time: string) {
  return `${date}T${time}:00${SEOUL_OFFSET}`;
}

export function toSeoulAllDayStart(date: string) {
  return toSeoulDateTimeFromParts(date, '00:00');
}

export function toSeoulAllDayEnd(inclusiveEndDate: string) {
  return toSeoulDateTimeFromParts(addDaysToDateKey(inclusiveEndDate, 1), '00:00');
}

export function toAllDayEndDateInputValue(endAt: string) {
  return previousDateKey(toDateInputValue(endAt));
}

export function addDaysToDateKey(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00${SEOUL_OFFSET}`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function previousDateKey(value: string) {
  return addDaysToDateKey(value, -1);
}

function seoulParts(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`
  };
}
