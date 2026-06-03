import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

const positions = [
  { id: 1, name: '사원', rank_order: 10, sort_order: 10, active: true },
  { id: 2, name: '대리', rank_order: 20, sort_order: 20, active: true }
];

const users = [
  {
    id: 3,
    login_id: 'employee01',
    name: '직원01',
    email: 'employee01@theieum.local',
    organization_id: 3,
    organization_name: '개발팀',
    position_id: 1,
    position_name: '사원',
    roles: 'APPLICANT',
    active: true
  }
];

const approvalLines = [
  {
    id: 1,
    approvalTypeId: 1,
    name: '영수증 첨부 신청 기본 결재선',
    active: true,
    steps: [
      {
        id: 1,
        stepOrder: 1,
        stepType: 'DIRECT_USER',
        organizationScope: null,
        positionId: null,
        directUserId: 2,
        sortPolicy: 'POSITION_ORDER'
      }
    ]
  }
];

function setAuth(roles: string[]) {
  localStorage.setItem('accessToken', 'token');
  localStorage.setItem('authUser', JSON.stringify({
    id: roles.includes('ADMIN') ? 1 : 3,
    loginId: roles.includes('ADMIN') ? 'admin' : 'employee01',
    name: roles.includes('ADMIN') ? '관리자' : '직원01',
    roles
  }));
}

function mockReferenceFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/admin/users' && !init?.method) {
      return new Response(JSON.stringify(users), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/admin/positions' && !init?.method) {
      return new Response(JSON.stringify(positions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/admin/organizations' && !init?.method) {
      return new Response(JSON.stringify([
        { id: 1, name: '더이음', parent_id: null, level_no: 1, sort_order: 10, active: true }
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === '/api/admin/approval-lines' && !init?.method) {
      return new Response(JSON.stringify(approvalLines), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

describe('AdminReferencePage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('일반 사용자는 기준정보 관리 화면에 접근할 수 없다', async () => {
    setAuth(['APPLICANT']);
    window.history.pushState({}, '', '/admin/positions');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '직위 관리' })).not.toBeInTheDocument();
  });

  it('매니저는 직위 값을 수정하고 삭제할 수 있다', async () => {
    setAuth(['MANAGER', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/positions');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/positions' && !init?.method) {
        return new Response(JSON.stringify(positions), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/positions/1' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({
          name: '주임',
          rankOrder: 15,
          sortOrder: 15,
          active: true
        });
        return new Response(JSON.stringify({
          id: 1,
          name: '주임',
          rank_order: 15,
          sort_order: 15,
          active: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/positions/1' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const row = await screen.findByRole('row', { name: /#1 사원/ });
    await userEvent.click(within(row).getByRole('button', { name: '수정' }));
    await userEvent.clear(screen.getByLabelText('직위명'));
    await userEvent.type(screen.getByLabelText('직위명'), '주임');
    await userEvent.clear(screen.getByLabelText('직위 순서'));
    await userEvent.type(screen.getByLabelText('직위 순서'), '15');
    await userEvent.clear(screen.getByLabelText('정렬'));
    await userEvent.type(screen.getByLabelText('정렬'), '15');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('status')).toHaveTextContent('저장되었습니다.');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/positions/1', expect.objectContaining({
      method: 'PUT'
    }));

    await userEvent.click(within(await screen.findByRole('row', { name: /#1 사원/ })).getByRole('button', { name: '삭제' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/positions/1', expect.objectContaining({
      method: 'DELETE'
    }));
  });

  it('매니저는 사용자 관리를 조회만 할 수 있다', async () => {
    setAuth(['MANAGER', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/users');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    expect(await screen.findByRole('heading', { name: '사용자 관리' })).toBeInTheDocument();
    expect(screen.getByText('employee01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '새 항목' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).not.toBeInTheDocument();
  });

  it('매니저는 결재선 관리 화면에 직접 진입해 결재선을 조회할 수 있다', async () => {
    setAuth(['MANAGER']);
    window.history.pushState({}, '', '/admin/approval-lines');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    expect(await screen.findByRole('heading', { name: '결재선 관리' })).toBeInTheDocument();
    expect(screen.getByText('영수증 첨부 신청 기본 결재선')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 항목' })).toBeInTheDocument();
  });

  it('관리자는 사용자 관리에서 대상자 비밀번호를 변경할 수 있다', async () => {
    setAuth(['ADMIN', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/users');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/users' && !init?.method) {
        return new Response(JSON.stringify(users), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/users/3/password' && init?.method === 'PUT') {
        expect(JSON.parse(String(init.body))).toEqual({ newPassword: 'changed-password' });
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByRole('heading', { name: '사용자 관리' });
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'changed-password');
    await userEvent.click(screen.getByRole('button', { name: '변경 저장' }));

    expect(await screen.findByRole('status')).toHaveTextContent('비밀번호가 변경되었습니다.');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/3/password', expect.objectContaining({
      method: 'PUT'
    }));
  });

  it('다른 관리 화면으로 이동하면 입력 상태가 초기화된다', async () => {
    setAuth(['MANAGER', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/positions');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    expect(await screen.findByRole('heading', { name: '직위 관리' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '새 항목' }));
    expect(screen.getByText('새 항목 입력')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('직위명'), '임시 직위');

    await userEvent.click(screen.getByRole('link', { name: /조직 관리/ }));

    expect(await screen.findByRole('heading', { name: '조직 관리' })).toBeInTheDocument();
    expect(screen.queryByText('새 항목 입력')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('임시 직위')).not.toBeInTheDocument();
  });

  it('이전 관리 화면의 늦은 응답이 결재선 관리 화면을 덮어쓰지 않는다', async () => {
    setAuth(['MANAGER']);
    window.history.pushState({}, '', '/admin/positions');
    const positionsRequest: { resolve?: (response: Response) => void } = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/admin/positions') {
        return new Promise<Response>((resolve) => {
          positionsRequest.resolve = resolve;
        });
      }
      if (url === '/api/admin/approval-lines') {
        return new Response(JSON.stringify(approvalLines), {
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
    await userEvent.click(await screen.findByRole('link', { name: /결재선 관리/ }));
    expect(await screen.findByRole('heading', { name: '결재선 관리' })).toBeInTheDocument();
    expect(screen.getByText('영수증 첨부 신청 기본 결재선')).toBeInTheDocument();

    positionsRequest.resolve?.(new Response(JSON.stringify(positions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    expect(await screen.findByText('영수증 첨부 신청 기본 결재선')).toBeInTheDocument();
  });
});
