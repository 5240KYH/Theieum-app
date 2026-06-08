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
  },
  {
    id: 12,
    applicantId: 6,
    applicantName: '직원04',
    status: 'DRAFT',
    vendor: '택시'
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
      organizationName: '개발팀',
      positionName: '팀장',
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

  it('관리자는 임시저장 신청서를 확인 후 완전 삭제할 수 있다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/admin/applications/12/hard-delete' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      if (url === '/api/admin/applications') {
        return new Response(JSON.stringify(adminApplications), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const row = await screen.findByRole('row', { name: /택시/ });
    await userEvent.click(within(row).getByRole('button', { name: '완전 삭제' }));

    const dialog = screen.getByRole('dialog', { name: '신청서 완전 삭제' });
    expect(dialog).toHaveTextContent('#12');
    await userEvent.click(within(dialog).getByRole('button', { name: '완전 삭제' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/applications/12/hard-delete', expect.objectContaining({
        method: 'DELETE'
      }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('신청서가 완전 삭제되었습니다.');
    expect(screen.queryByText('택시')).not.toBeInTheDocument();
  });

  it('관리자는 월별 첨부 ZIP을 다운로드할 수 있다', async () => {
    const createObjectUrl = vi.fn(() => 'blob:monthly-attachments');
    const revokeObjectUrl = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/admin/applications') {
        return new Response(JSON.stringify(adminApplications), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/admin/attachments/monthly-download?month=2026-06') {
        return new Response(new Blob(['zip'], { type: 'application/zip' }), {
          status: 200,
          headers: { 'Content-Type': 'application/zip' }
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { name: '전체 신청서 관리' });
    await userEvent.clear(screen.getByLabelText('첨부 다운로드 월'));
    await userEvent.type(screen.getByLabelText('첨부 다운로드 월'), '2026-06');
    await userEvent.click(screen.getByRole('button', { name: '월별 첨부 다운로드' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/attachments/monthly-download?month=2026-06',
        expect.objectContaining({ headers: expect.any(Headers) })
      );
    });
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:monthly-attachments');
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

  it('조직별 예외 결재자 목록을 표시한다', async () => {
    window.history.pushState({}, '', '/admin/approval-org-exceptions');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/admin/approval-org-exceptions') {
          return new Response(JSON.stringify([
            {
              id: 1,
              approvalTypeId: 1,
              organizationId: 3,
              organizationName: '개발팀',
              approverUserId: 18,
              approverName: '개발팀장',
              stepOrder: 2,
              active: true
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

    expect(await screen.findByRole('heading', { name: '조직별 예외 결재자 관리' })).toBeInTheDocument();
    expect(await screen.findByText('개발팀')).toBeInTheDocument();
    expect(screen.getByText('개발팀장')).toBeInTheDocument();
  });
});
