import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../app/App';

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

describe('AppLayout', () => {
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
    window.history.pushState({}, '', '/dashboard');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('일반 사용자에게 관리 메뉴를 숨긴다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /사용자 관리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /조직 관리/ })).not.toBeInTheDocument();
  });

  it('저장된 역할이 최신 사용자 정보와 다르면 관리 메뉴를 숨긴다', async () => {
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['MANAGER', 'APPLICANT']
    }));
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/me') {
        return new Response(JSON.stringify({
          id: 3,
          loginId: 'employee01',
          name: '직원01',
          roles: ['APPLICANT']
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    await screen.findByRole('button', { name: '내 비밀번호 변경' });
    expect(screen.queryByRole('link', { name: /사용자 관리/ })).not.toBeInTheDocument();
  });

  it('매니저에게 관리 메뉴를 노출한다', async () => {
    localStorage.setItem('authUser', JSON.stringify({
      id: 10,
      loginId: 'manager01',
      name: '매니저01',
      roles: ['MANAGER', 'APPLICANT']
    }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    render(<App />);

    expect(await screen.findByRole('link', { name: /사용자 관리/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /조직 관리/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /전체 신청서/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /알림 로그/ })).toBeInTheDocument();
  });

  it('로그인 사용자가 본인 비밀번호를 팝업에서 변경한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me/password' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          currentPassword: 'password',
          newPassword: 'new-password'
        });
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '내 비밀번호 변경' }));
    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'password');
    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'new-password');
    await userEvent.click(screen.getByRole('button', { name: '변경 저장' }));

    expect(await screen.findByRole('status')).toHaveTextContent('비밀번호가 변경되었습니다.');
    expect(fetchMock).toHaveBeenCalledWith('/api/me/password', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('로그아웃 전에 확인하고 취소하면 세션을 유지한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(confirmMock).toHaveBeenCalledWith('로그아웃 하시겠습니까?');
    expect(localStorage.getItem('accessToken')).toBe('token');
    expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
  });

  it('로그아웃 확인 후 로그인 화면으로 이동한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  });
});
