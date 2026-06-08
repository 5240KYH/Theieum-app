import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const applicationResponse = {
  id: 100,
  applicant: { id: 3, name: '직원01' },
  approvalTypeId: 1,
  approvalOrganizationId: 3,
  approvalOrganizationName: '개발팀',
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
    },
    {
      id: 502,
      originalFilename: 'receipt-2.png',
      mimeType: 'image/png',
      fileSize: 9
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

      if (url === '/api/applications/100/attachments/502/content') {
        return new Response(new Blob(['receipt-2'], { type: 'image/png' }), {
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
    expect(screen.getByText('receipt-2.png')).toBeInTheDocument();
    expect(screen.getByText('결재 기준 조직')).toBeInTheDocument();
    expect(screen.getByText('개발팀')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/applications/100/attachments/501/content',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      );
    });
  });

  it('첨부 썸네일을 클릭하면 확대 미리보기를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify(applicationResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('/attachments/') && url.endsWith('/content')) {
        return new Response(new Blob(['receipt'], { type: 'image/png' }), {
          status: 200,
          headers: { 'Content-Type': 'image/png' }
        });
      }

      return new Response(null, { status: 404 });
    }));

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'receipt.png 크게 보기' }));

    const dialog = screen.getByRole('dialog', { name: '첨부 이미지 확대 보기' });
    expect(dialog).toHaveTextContent('receipt.png');
    expect(within(dialog).getByAltText('receipt.png 확대 미리보기')).toHaveAttribute('src', 'blob:receipt-preview');
  });

  it('임시저장 신청서를 취소한다', async () => {
    const draftResponse = {
      ...applicationResponse,
      status: 'DRAFT',
      submittedAt: null,
      attachments: []
    };
    const canceledResponse = {
      ...draftResponse,
      status: 'CANCELED',
      completedAt: '2026-06-03T02:00:00Z'
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications/100/cancel' && init?.method === 'POST') {
        return new Response(JSON.stringify(canceledResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify(draftResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { name: '신청서 상세' });
    await screen.findByText('임시저장');
    screen.getByRole('button', { name: '신청 취소' }).click();

    expect(await screen.findByText('취소')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/cancel', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('작성자는 임시저장 신청서를 완전 삭제할 수 있다', async () => {
    const draftResponse = {
      ...applicationResponse,
      status: 'DRAFT',
      submittedAt: null,
      attachments: []
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications/100/hard-delete' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify(draftResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { name: '신청서 상세' });
    await userEvent.click(screen.getByRole('button', { name: '신청서 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '신청서 삭제' });
    expect(dialog).toHaveTextContent('복구할 수 없습니다');

    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/hard-delete', expect.objectContaining({
        method: 'DELETE'
      }));
    });
    expect(window.location.pathname).toBe('/applications/my');
  });

  it('취소된 신청서는 다시 수정할 수 있지만 결재 진행중 신청서는 수정할 수 없다', async () => {
    const canceledResponse = {
      ...applicationResponse,
      id: 101,
      status: 'CANCELED',
      completedAt: '2026-06-03T01:10:00Z',
      attachments: []
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/applications/101') {
        return new Response(JSON.stringify(canceledResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (String(input) === '/api/applications/100') {
        return new Response(JSON.stringify({
          ...applicationResponse,
          attachments: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.pushState({}, '', '/applications/101');
    render(<App />);

    expect(await screen.findByRole('link', { name: '수정' })).toHaveAttribute('href', '/applications/101/edit');

    cleanup();
    window.history.pushState({}, '', '/applications/100');
    render(<App />);

    expect(await screen.findByText('결재중')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
  });

  it('결재 이력에서 실제 처리자와 관리자 예외 사유를 표시한다', async () => {
    const auditedResponse = {
      ...applicationResponse,
      attachments: [],
      approvalHistories: [
        {
          id: 801,
          stepOrder: 1,
          action: 'ADMIN_APPROVED',
          originalApprover: { id: 18, name: '개발팀장' },
          actor: { id: 1, name: '관리자' },
          adminOverride: true,
          adminReason: '결재자 부재로 관리자 예외 승인',
          comment: null,
          actedAt: '2026-06-03T02:00:00Z'
        }
      ]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/applications/100') {
          return new Response(JSON.stringify(auditedResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    expect(await screen.findAllByText('관리자')).not.toHaveLength(0);
    expect(screen.getAllByText('개발팀장')).not.toHaveLength(0);
    expect(screen.getAllByText('관리자 승인')).not.toHaveLength(0);
    expect(screen.getAllByText('결재자 부재로 관리자 예외 승인')).not.toHaveLength(0);
  });

  it('결재 진행 상태에서 산정 당시 조직과 직위를 함께 표시한다', async () => {
    const steppedResponse = {
      ...applicationResponse,
      attachments: [],
      approvalSteps: [
        {
          id: 701,
          stepOrder: 1,
          originalApprover: { id: 18, name: '개발팀장' },
          organizationName: '개발팀',
          positionName: '팀장',
          status: 'PENDING',
          actedAt: null
        }
      ]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/applications/100') {
          return new Response(JSON.stringify(steppedResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    expect(screen.getAllByText('개발팀장')).not.toHaveLength(0);
    expect(screen.getAllByText('개발팀')).not.toHaveLength(0);
    expect(screen.getByText('팀장')).toBeInTheDocument();
  });

  it('모바일에서 상세 액션과 결재 이력을 카드 구조로 제공한다', async () => {
    const auditedResponse = {
      ...applicationResponse,
      attachments: [],
      approvalHistories: [
        {
          id: 801,
          stepOrder: 1,
          action: 'APPROVED',
          originalApprover: { id: 18, name: '개발팀장' },
          actor: { id: 18, name: '개발팀장' },
          adminOverride: false,
          adminReason: null,
          comment: '확인했습니다.',
          actedAt: '2026-06-03T02:00:00Z'
        }
      ]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/applications/100') {
          return new Response(JSON.stringify(auditedResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' }).closest('.mobile-detail-actions')).not.toBeNull();
    const mobileHistory = screen.getByRole('list', { name: '모바일 결재 이력' });
    expect(mobileHistory).toBeInTheDocument();
    expect(within(mobileHistory).getByText('확인했습니다.')).toBeInTheDocument();
  });
});
