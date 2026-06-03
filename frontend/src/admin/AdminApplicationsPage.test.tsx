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

const adminApplications = [
  {
    id: 10,
    applicantId: 3,
    applicantName: '직원01',
    status: 'IN_APPROVAL',
    vendor: '문구점'
  },
  {
    id: 11,
    applicantId: 5,
    applicantName: '직원03',
    status: 'APPROVED',
    vendor: '카페'
  }
];

const applicationDetail = {
  id: 10,
  applicant: { id: 3, name: '직원01' },
  approvalTypeId: 1,
  applicationDate: '2026-06-03',
  receiptDate: '2026-06-02',
  vendor: '문구점',
  amount: 12000,
  description: '회의 준비 문구류',
  status: 'IN_APPROVAL',
  submittedAt: '2026-06-03T01:00:00Z',
  completedAt: null,
  createdAt: '2026-06-03T00:50:00Z',
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

describe('AdminApplicationsPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'admin-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 1,
      loginId: 'admin',
      name: '관리자',
      roles: ['ADMIN']
    }));
    window.history.pushState({}, '', '/admin/applications');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('전체 신청서를 상태별로 필터링한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/admin/applications') {
          return new Response(JSON.stringify(adminApplications), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '전체 신청서 관리' })).toBeInTheDocument();
    expect(await screen.findByText('문구점')).toBeInTheDocument();
    expect(screen.getByText('카페')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('상태 필터'), 'IN_APPROVAL');

    expect(screen.getByText('문구점')).toBeInTheDocument();
    expect(screen.queryByText('카페')).not.toBeInTheDocument();
  });

  it('관리자 예외 결재 사유를 입력해야 처리된다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/admin/applications') {
        return new Response(JSON.stringify(adminApplications), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/10') {
        return new Response(JSON.stringify(applicationDetail), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/admin/approvals/steps/77/approve' && init?.method === 'POST') {
        expect(init.body).toBe(JSON.stringify({ reason: '팀장 출장으로 관리자 예외 처리' }));
        return new Response(JSON.stringify({ id: 10, status: 'APPROVED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const row = await screen.findByRole('row', { name: /문구점/ });
    await userEvent.click(within(row).getByRole('button', { name: '예외 결재' }));
    await userEvent.click(screen.getByRole('button', { name: '예외 승인' }));

    expect(screen.getByRole('alert')).toHaveTextContent('관리자 예외 결재 사유를 입력해주세요.');
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/approvals/steps/77/approve',
      expect.anything()
    );

    await userEvent.type(screen.getByLabelText('예외 결재 사유'), '팀장 출장으로 관리자 예외 처리');
    await userEvent.click(screen.getByRole('button', { name: '예외 승인' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/approvals/steps/77/approve', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: '팀장 출장으로 관리자 예외 처리' })
      }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('관리자 예외 결재가 완료되었습니다.');
  });

  it('알림 로그에서 채널과 발송 상태를 표시한다', async () => {
    window.history.pushState({}, '', '/admin/notifications');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/admin/notification-events') {
          return new Response(JSON.stringify([
            {
              id: 901,
              recipientId: 3,
              applicationId: 10,
              notificationType: 'APPROVAL_REQUESTED',
              channel: 'IN_APP',
              status: 'SENT',
              read: false
            }
          ]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '알림 로그 관리' })).toBeInTheDocument();
    expect(await screen.findByText('인앱')).toBeInTheDocument();
    expect(screen.getByText('발송완료')).toBeInTheDocument();
  });
});
