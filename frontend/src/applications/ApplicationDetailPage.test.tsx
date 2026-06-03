import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

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

const applicationResponse = {
  id: 100,
  applicant: { id: 3, name: '직원01' },
  approvalTypeId: 1,
  applicationDate: '2026-06-03',
  receiptDate: '2026-06-02',
  vendor: '문구점',
  amount: 12000,
  description: '회의 준비 문구류 구입',
  status: 'IN_APPROVAL',
  submittedAt: '2026-06-03T01:05:00Z',
  completedAt: null,
  createdAt: '2026-06-03T01:00:00Z',
  approvalSteps: [],
  attachments: [
    {
      id: 501,
      originalFilename: 'receipt.png',
      mimeType: 'image/png',
      fileSize: 8
    }
  ]
};

describe('ApplicationDetailPage', () => {
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
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:receipt-preview')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
    window.history.pushState({}, '', '/applications/100');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('첨부 이미지 content API를 토큰으로 호출해 미리보기를 표시한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify(applicationResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/attachments/501/content') {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer employee-token');
        return new Response(new Blob(['receipt'], { type: 'image/png' }), {
          status: 200,
          headers: { 'Content-Type': 'image/png' }
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const preview = await screen.findByAltText('receipt.png 미리보기');
    expect(preview).toHaveAttribute('src', 'blob:receipt-preview');
    expect(screen.getByText('receipt.png')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/applications/100/attachments/501/content',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      );
    });
  });
});
