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

describe('LoginPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            accessToken: 'test-token',
            user: {
              id: 1,
              loginId: 'admin',
              name: '관리자',
              roles: ['ADMIN']
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    window.history.pushState({}, '', '/login');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('관리자 계정으로 로그인하면 홈으로 이동한다', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText('아이디'), 'admin');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ loginId: 'admin', password: 'password' })
      })
    );
    expect(localStorage.getItem('accessToken')).toBe('test-token');
  });

  it('보호된 경로에서 로그인하면 요청했던 경로로 이동한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            accessToken: 'approver-token',
            user: {
              id: 2,
              loginId: 'approver01',
              name: '팀장01',
              roles: ['APPROVER']
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    window.history.pushState({}, '', '/approvals');

    render(<App />);

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('아이디'), 'admin');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '결재함' })).toBeInTheDocument();
    });
  });

  it('일반 사용자는 관리자 전용 경로에 직접 접근해도 대시보드로 이동한다', async () => {
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/admin/applications');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: '전체 신청서 관리' })).not.toBeInTheDocument();
  });

  it('일반 사용자는 기준정보 관리 경로에 직접 접근해도 대시보드로 이동한다', async () => {
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/admin/users');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: '사용자 관리' })).not.toBeInTheDocument();
  });

  it('역할이 없는 업무 경로에 접근해도 세션을 유지한 채 대시보드로 이동한다', async () => {
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/approvals');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    });
    expect(localStorage.getItem('accessToken')).toBe('employee-token');
  });

  it('저장된 인증 정보가 손상되면 로그인 상태를 초기화한다', async () => {
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: 'APPLICANT'
    }));
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('authUser')).toBeNull();
  });

  it('로그인 실패 메시지를 알림 영역으로 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText('아이디'), 'admin');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('아이디 또는 비밀번호가 올바르지 않습니다.');
  });
});
