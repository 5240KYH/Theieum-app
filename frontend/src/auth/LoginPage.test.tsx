import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
