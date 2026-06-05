import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../app/App';

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

const eventResponse = {
  id: 1,
  title: '월간 마감',
  description: '영수증 제출 마감',
  location: '본사',
  startAt: '2026-06-10T09:00:00+09:00',
  endAt: '2026-06-10T10:00:00+09:00',
  allDay: false,
  createdBy: { id: 1, loginId: 'admin', name: '관리자', roles: ['ADMIN'] },
  updatedBy: { id: 1, loginId: 'admin', name: '관리자', roles: ['ADMIN'] },
  createdAt: '2026-06-04T09:00:00+09:00',
  updatedAt: '2026-06-04T09:00:00+09:00'
};

const overnightEventResponse = {
  ...eventResponse,
  id: 3,
  title: '야간 점검',
  startAt: '2026-06-10T22:00:00+09:00',
  endAt: '2026-06-11T08:30:00+09:00'
};

const multiDayAllDayEventResponse = {
  ...eventResponse,
  id: 4,
  title: '워크숍',
  startAt: '2026-06-10T00:00:00+09:00',
  endAt: '2026-06-13T00:00:00+09:00',
  allDay: true
};

describe('CalendarPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/calendar');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('일반 사용자는 공용 일정을 조회하고 관리 버튼은 보지 못한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return new Response(localStorage.getItem('authUser'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([eventResponse, overnightEventResponse, multiDayAllDayEventResponse]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '공용 캘린더' })).toBeInTheDocument();
    expect((await screen.findAllByText('월간 마감')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '일정 등록' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.queryByRole('button', { name: /월간 마감 상세/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('영수증 제출 마감').length).toBeGreaterThan(0);
  });

  it('월/주/목록 보기와 날짜 셀 일정 칩으로 일정을 빠르게 확인한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return new Response(localStorage.getItem('authUser'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([eventResponse, overnightEventResponse, multiDayAllDayEventResponse]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    }));

    render(<App />);

    expect(await screen.findByRole('button', { name: '월 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '주 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록 보기' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /09:00-10:00 월간 마감/ })).toBeInTheDocument();
    expect(await screen.findByLabelText('모바일 축약: 09:00')).toBeInTheDocument();
    expect((await screen.findAllByLabelText('모바일 축약: 6/10-6/12')).length).toBeGreaterThan(2);
    expect((await screen.findAllByRole('button', { name: /6\/10 22:00-6\/11 08:30 야간 점검/ })).length).toBeGreaterThan(1);
    expect((await screen.findAllByRole('button', { name: /6\/10-6\/12 종일 워크숍/ })).length).toBeGreaterThan(2);

    await userEvent.click(screen.getByRole('button', { name: '2026-06-11 선택' }));

    expect(screen.getByLabelText('선택 날짜 일정')).toHaveTextContent('워크숍');
    expect(screen.getByLabelText('선택 날짜 일정')).toHaveTextContent('2026-06-10 ~ 2026-06-12 종일');

    await userEvent.click(screen.getByRole('button', { name: '주 보기' }));

    expect(screen.getByRole('button', { name: '주 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('주간 일정')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /09:00-10:00 월간 마감/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /월간 마감 상세/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('월간 목록')).toBeInTheDocument();
  });

  it('주 보기의 이전/다음 버튼은 주 단위로 이동한다', async () => {
    vi.setSystemTime(new Date('2026-06-04T09:00:00+09:00'));
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return new Response(localStorage.getItem('authUser'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    }));

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '주 보기' }));
    expect(screen.getByRole('button', { name: '2026-05-31 선택' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다음 주' }));

    expect(screen.getByRole('button', { name: '2026-06-07 선택' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2026-05-31 선택' })).not.toBeInTheDocument();
  });

  it('일정 시간을 from~to로 명확히 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return new Response(localStorage.getItem('authUser'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([eventResponse, overnightEventResponse]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    }));

    render(<App />);

    expect(await screen.findByText('2026-06-10 09:00~10:00')).toBeInTheDocument();
    expect(await screen.findByText('2026-06-10 22:00 ~ 2026-06-11 08:30')).toBeInTheDocument();
  });

  it('매니저는 일정을 등록하고 목록을 갱신한다', async () => {
    localStorage.setItem('authUser', JSON.stringify({
      id: 21,
      loginId: 'calendar-manager',
      name: '캘린더 매니저',
      roles: ['MANAGER', 'APPLICANT']
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') {
        return new Response(localStorage.getItem('authUser'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/calendar/events' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          ...eventResponse,
          id: 2,
          title: JSON.parse(String(init.body)).title
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([eventResponse]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '일정 등록' }));
    await userEvent.type(screen.getByLabelText('제목'), '월간 마감');
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByLabelText('시작 시간'), { target: { value: '13:30' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByLabelText('종료 시간'), { target: { value: '15:45' } });
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/calendar/events', expect.objectContaining({
        method: 'POST'
      }));
    });
    const request = fetchMock.mock.calls.find(([url, init]) => url === '/api/calendar/events' && init?.method === 'POST');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual(expect.objectContaining({
      startAt: '2026-06-10T13:30:00+09:00',
      endAt: '2026-06-10T15:45:00+09:00',
      allDay: false
    }));
  });
});
