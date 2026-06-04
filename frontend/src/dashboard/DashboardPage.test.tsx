import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

describe('DashboardPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/dashboard');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('신청자 대시보드는 결재함 API를 호출하지 않는다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/applications/my' || url === '/api/notifications') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.startsWith('/api/calendar/events')) {
        return new Response(JSON.stringify([{
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
        }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/approvals/inbox') {
        return new Response('', { status: 401 });
      }

      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    });

    expect(screen.getByText('직원01님')).toBeInTheDocument();
    expect(await screen.findByText('공용 캘린더')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '월 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '주 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록 보기' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /09:00 월간 마감/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '주 보기' }));

    expect(screen.getByRole('button', { name: '주 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('주간 일정')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }));

    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('월간 목록')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '전체 캘린더' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/approvals/inbox',
      expect.anything()
    );
    expect(localStorage.getItem('accessToken')).toBe('employee-token');
  });
});
