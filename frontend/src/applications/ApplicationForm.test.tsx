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

const draftResponse = {
  id: 100,
  applicant: { id: 3, name: '직원01' },
  approvalTypeId: 1,
  applicationDate: '2026-06-03',
  receiptDate: '2026-06-02',
  vendor: '문구점',
  amount: 12000,
  description: '회의 준비 문구류 구입',
  status: 'DRAFT',
  submittedAt: null,
  completedAt: null,
  createdAt: '2026-06-03T01:00:00Z',
  approvalSteps: []
};

const submittedResponse = {
  ...draftResponse,
  status: 'IN_APPROVAL',
  submittedAt: '2026-06-03T01:05:00Z',
  approvalSteps: [
    {
      id: 77,
      stepOrder: 1,
      originalApprover: { id: 4, name: '팀장01' },
      status: 'PENDING',
      actedAt: null
    }
  ]
};

describe('ApplicationForm', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '직원01',
      roles: ['APPLICANT', 'APPROVER']
    }));
    window.history.pushState({}, '', '/applications/new');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('필수 항목이 비어 있으면 제출할 수 없다', async () => {
    vi.stubGlobal('fetch', vi.fn());

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(screen.getByText('필수 항목을 입력하면 제출할 수 있습니다.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('이미지 첨부 후 썸네일과 삭제 버튼을 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App />);

    const file = new File(['receipt'], 'receipt.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('영수증 이미지 첨부'), file);

    expect(screen.getByAltText('receipt.png 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '첨부 삭제' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '첨부 삭제' }));

    expect(screen.queryByAltText('receipt.png 미리보기')).not.toBeInTheDocument();
  });

  it('제출 성공 후 내 신청서 상세로 이동한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications' && init?.method === 'POST') {
        return new Response(JSON.stringify(draftResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/attachments' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get('file')).toBeInstanceOf(File);
        return new Response(JSON.stringify({
          id: 501,
          originalFilename: 'receipt.png',
          mimeType: 'image/png',
          fileSize: 7
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/submit' && init?.method === 'POST') {
        return new Response(JSON.stringify(submittedResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify(submittedResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    await userEvent.clear(screen.getByLabelText('신청일자'));
    await userEvent.type(screen.getByLabelText('신청일자'), '2026-06-03');
    await userEvent.type(screen.getByLabelText('영수증 일자'), '2026-06-02');
    await userEvent.type(screen.getByLabelText('사용처'), '문구점');
    await userEvent.type(screen.getByLabelText('금액'), '12000');
    await userEvent.type(screen.getByLabelText('신청 내용'), '회의 준비 문구류 구입');
    await userEvent.upload(
      screen.getByLabelText('영수증 이미지 첨부'),
      new File(['receipt'], 'receipt.png', { type: 'image/png' })
    );

    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/applications/100');
    });
    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/submit', expect.objectContaining({
      method: 'POST'
    }));
  });
});
