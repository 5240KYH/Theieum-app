import { describe, expect, it } from 'vitest';

import {
  displayEventChipRange,
  displayEventMobileMarker,
  displayEventRange,
  toDateInputValue,
  toSeoulDateTimeFromParts,
  toTimeInputValue
} from './calendarUtils';

describe('calendarUtils', () => {
  it('같은 날짜 시간 일정은 년월일 from시간~to시간으로 표시한다', () => {
    expect(displayEventRange(
      '2026-06-10T09:00:00+09:00',
      '2026-06-10T10:30:00+09:00',
      false
    )).toBe('2026-06-10 09:00~10:30');
  });

  it('월/주 달력 칩은 종료 시간과 다일 기간을 짧게 표시한다', () => {
    expect(displayEventChipRange(
      '2026-06-10T09:00:00+09:00',
      '2026-06-10T10:30:00+09:00',
      false
    )).toBe('09:00-10:30');

    expect(displayEventChipRange(
      '2026-06-10T22:00:00+09:00',
      '2026-06-11T08:30:00+09:00',
      false
    )).toBe('6/10 22:00-6/11 08:30');

    expect(displayEventChipRange(
      '2026-06-10T00:00:00+09:00',
      '2026-06-13T00:00:00+09:00',
      true
    )).toBe('6/10-6/12 종일');
  });

  it('모바일 월/주 달력 칸은 날짜 안에서 읽히는 짧은 표식으로 표시한다', () => {
    expect(displayEventMobileMarker(
      '2026-06-10T09:00:00+09:00',
      '2026-06-10T10:30:00+09:00',
      false
    )).toBe('09:00');

    expect(displayEventMobileMarker(
      '2026-06-10T22:00:00+09:00',
      '2026-06-11T08:30:00+09:00',
      false
    )).toBe('6/10-6/11');

    expect(displayEventMobileMarker(
      '2026-06-10T00:00:00+09:00',
      '2026-06-13T00:00:00+09:00',
      true
    )).toBe('6/10-6/12');
  });

  it('날짜가 다른 시간 일정은 시작과 종료를 모두 표시한다', () => {
    expect(displayEventRange(
      '2026-06-10T22:00:00+09:00',
      '2026-06-11T08:30:00+09:00',
      false
    )).toBe('2026-06-10 22:00 ~ 2026-06-11 08:30');
  });

  it('종일 일정은 사용자가 이해할 수 있도록 종일 범위로 표시한다', () => {
    expect(displayEventRange(
      '2026-06-10T00:00:00+09:00',
      '2026-06-11T00:00:00+09:00',
      true
    )).toBe('2026-06-10 종일');

    expect(displayEventRange(
      '2026-06-10T00:00:00+09:00',
      '2026-06-13T00:00:00+09:00',
      true
    )).toBe('2026-06-10 ~ 2026-06-12 종일');
  });

  it('서버 offset 값을 서울 날짜와 시간 입력값으로 변환한다', () => {
    expect(toDateInputValue('2026-06-10T00:30:00Z')).toBe('2026-06-10');
    expect(toTimeInputValue('2026-06-10T00:30:00Z')).toBe('09:30');
  });

  it('날짜와 시간 입력값을 서울 offset API 값으로 만든다', () => {
    expect(toSeoulDateTimeFromParts('2026-06-10', '13:45')).toBe('2026-06-10T13:45:00+09:00');
  });
});
