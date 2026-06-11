import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

const myApplications = [
  {
    id: 100,
    applicant: { id: 3, name: '채동훈' },
    approvalTypeId: 1,
    approvalOrganizationId: 3,
    approvalOrganizationName: '미디어팀',
    applicationDate: '2026-06-08',
    receiptDate: '2026-06-08',
    vendor: '문구점',
    amount: 100000,
    description: '6월 행사 준비',
    status: 'IN_APPROVAL',
    submittedAt: '2026-06-08T01:00:00Z',
    completedAt: null,
    createdAt: '2026-06-08T00:30:00Z',
    approvalSteps: []
  },
  {
    id: 101,
    applicant: { id: 3, name: '채동훈' },
    approvalTypeId: 1,
    approvalOrganizationId: 3,
    approvalOrganizationName: '미디어팀',
    applicationDate: '2026-07-01',
    receiptDate: '2026-07-01',
    vendor: '택시',
    amount: 25000,
    description: '7월 이동비',
    status: 'APPROVED',
    submittedAt: '2026-07-01T01:00:00Z',
    completedAt: '2026-07-01T02:00:00Z',
    createdAt: '2026-07-01T00:30:00Z',
    approvalSteps: []
  }
];

describe('MyApplicationsPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'employee-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 3,
      loginId: 'employee01',
      name: '채동훈',
      roles: ['APPLICANT']
    }));
    window.history.pushState({}, '', '/applications/my');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('내 신청서를 영수증 월 범위로 필터링하고 전체기간으로 되돌린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/applications/my') {
          return new Response(JSON.stringify(myApplications), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    render(<App />);

    const searchRegion = await screen.findByRole('region', { name: '검색조건' });
    expect(searchRegion).toHaveClass('search-condition-panel');
    expect(searchRegion).toHaveTextContent('검색조건');
    expect(await screen.findByText('문구점')).toBeInTheDocument();
    expect(screen.getByText('택시')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('영수증 월 From'), '20260699');
    await userEvent.type(screen.getByLabelText('영수증 월 To'), '202606');

    expect(screen.getByLabelText('영수증 월 From')).toHaveValue('2026-06');
    expect(screen.getByLabelText('영수증 월 To')).toHaveValue('2026-06');

    expect(screen.getByText('문구점')).toBeInTheDocument();
    expect(screen.queryByText('택시')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '전체기간' }));

    expect(screen.getByLabelText('영수증 월 From')).toHaveValue('');
    expect(screen.getByLabelText('영수증 월 To')).toHaveValue('');
    expect(screen.getByText('문구점')).toBeInTheDocument();
    expect(screen.getByText('택시')).toBeInTheDocument();
  });
});
