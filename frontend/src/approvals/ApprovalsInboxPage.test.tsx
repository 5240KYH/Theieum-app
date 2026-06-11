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

const inboxItem = {
  stepId: 900,
  stepOrder: 1,
  stepStatus: 'PENDING',
  applicationId: 100,
  receiptDate: '2026-06-02',
  vendor: '문구점',
  amount: 12000,
  applicationStatus: 'IN_APPROVAL',
  applicantId: 3,
  applicantName: '직원01',
  organizationName: '개발팀',
  hasAttachment: true,
  receivedAt: '2026-06-03T01:05:00Z'
};

const julyInboxItem = {
  ...inboxItem,
  stepId: 901,
  applicationId: 101,
  receiptDate: '2026-07-02',
  vendor: '카페',
  receivedAt: '2026-07-03T01:05:00Z'
};

describe('ApprovalsInboxPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'approver-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 18,
      loginId: 'lead-dev',
      name: '개발팀장',
      roles: ['APPROVER', 'APPLICANT']
    }));
    window.history.pushState({}, '', '/approvals');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('모바일 카드 목록에서 결재 정보를 확인하고 승인한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/approvals/inbox') {
        return new Response(JSON.stringify([inboxItem]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/approvals/steps/900/approve' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ comment: '확인했습니다.' });
        return new Response(JSON.stringify({ id: 100, status: 'APPROVED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const cardList = await screen.findByRole('region', { name: '모바일 결재 카드 목록' });
    const card = within(cardList).getByText('문구점').closest('article');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('직원01')).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('개발팀')).toBeInTheDocument();

    await userEvent.type(within(card as HTMLElement).getByLabelText('모바일 결재 의견'), '확인했습니다.');
    await userEvent.click(within(card as HTMLElement).getByRole('button', { name: '승인' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/approvals/steps/900/approve', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  it('결재 대기 목록을 접수기간으로 검색하고 전체기간으로 되돌린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/approvals/inbox') {
        return new Response(JSON.stringify([inboxItem, julyInboxItem]), {
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

    const searchRegion = await screen.findByRole('region', { name: '검색조건' });
    expect(searchRegion).toHaveClass('search-condition-panel');
    expect(searchRegion).toHaveTextContent('검색조건');
    expect((await screen.findAllByText('문구점')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('카페').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('접수기간 From'), '20260699');
    await userEvent.type(screen.getByLabelText('접수기간 To'), '202606');

    expect(screen.getByLabelText('접수기간 From')).toHaveValue('2026-06');
    expect(screen.getByLabelText('접수기간 To')).toHaveValue('2026-06');
    expect(screen.getAllByText('문구점').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('카페')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: '전체기간' }));

    expect(screen.getByLabelText('접수기간 From')).toHaveValue('');
    expect(screen.getByLabelText('접수기간 To')).toHaveValue('');
    expect(screen.getAllByText('카페').length).toBeGreaterThan(0);
  });
});
