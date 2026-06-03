import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api } from './api';

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

describe('api', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('FormData 요청에는 JSON Content-Type을 강제로 넣지 않는다', async () => {
    localStorage.setItem('accessToken', 'upload-token');
    const formData = new FormData();
    formData.append('file', new Blob(['receipt']), 'receipt.png');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    );

    await api<{ id: number }>('/applications/1/attachments', {
      method: 'POST',
      body: formData
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer upload-token');
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('401 응답이면 인증 만료 이벤트를 발생시킨다', async () => {
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: '인증이 만료되었습니다.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    );

    await expect(api('/notifications')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('auth:unauthorized', listener);
  });

  it('403 응답은 인증 만료 이벤트로 처리하지 않는다', async () => {
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: '권한이 없습니다.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }))
    );

    await expect(api('/approvals/inbox')).rejects.toBeInstanceOf(ApiError);

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', listener);
  });
});
