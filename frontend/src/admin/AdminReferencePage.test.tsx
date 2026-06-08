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
  { id: 2, name: '대리', rank_order: 20, sort_order: 20, active: true },
  { id: 4, name: '팀장', rank_order: 40, sort_order: 40, active: true }
];

const organizations = [
  { id: 1, name: '더이음', parent_id: null, level_no: 1, sort_order: 10, active: true },
  { id: 2, name: '경영지원팀', parent_id: 1, level_no: 2, sort_order: 15, active: true },
  { id: 3, name: '개발팀', parent_id: 1, level_no: 2, sort_order: 20, active: true }
];

const users = [
  {
    id: 2,
    login_id: 'approver01',
    name: '결재자01',
    email: 'approver01@theieum.local',
    organization_id: 2,
    organization_name: '경영지원팀',
    position_id: 4,
    position_name: '팀장',
    roles: 'APPROVER',
    active: true
  },
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
  },
  {
    id: 18,
    login_id: 'lead-dev',
    name: '개발팀장',
    email: 'lead-dev@theieum.local',
    organization_id: 3,
    organization_name: '개발팀',
    position_id: 4,
    position_name: '팀장',
    roles: 'APPROVER,APPLICANT',
    active: true
  }
];

const multiOrganizationUsers = [
  {
    ...users[2],
    organizationMemberships: [
      { organizationId: 3, organizationName: '개발팀', primary: true, active: true, sortOrder: 10 },
      { organizationId: 1, organizationName: '더이음', primary: false, active: true, sortOrder: 20 },
      { organizationId: 2, organizationName: '경영지원팀', primary: false, active: false, sortOrder: 30 }
    ]
  }
];

const approvalTypes = [
  { id: 1, name: '영수증 첨부 신청', description: '영수증 신청', active: true }
];

const approvalLines = [
  {
    id: 1,
    approvalTypeId: 1,
    approvalTypeName: '영수증 첨부 신청',
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
      return new Response(JSON.stringify(organizations), {
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
    if (url === '/api/admin/approval-types' && !init?.method) {
      return new Response(JSON.stringify(approvalTypes), {
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

    await userEvent.click(within(await screen.findByRole('row', { name: /#1 사원/ })).getByRole('button', { name: '비활성화' }));
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
    expect(screen.queryByRole('button', { name: '비활성화' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '완전 삭제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).not.toBeInTheDocument();
  });

  it('관리자 기준정보 화면은 모바일 보조 컨테이너를 렌더링한다', async () => {
    setAuth(['MANAGER', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/users');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    const heading = await screen.findByRole('heading', { name: '사용자 관리' });
    expect(heading.closest('.admin-reference-page')).not.toBeNull();
    expect(screen.getByRole('table').closest('.admin-mobile-table-shell')).not.toBeNull();
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

    const row = await screen.findByRole('row', { name: /#3 employee01/ });
    await userEvent.click(within(row).getByRole('button', { name: '비밀번호 변경' }));
    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'changed-password');
    await userEvent.click(screen.getByRole('button', { name: '변경 저장' }));

    expect(await screen.findByRole('status')).toHaveTextContent('비밀번호가 변경되었습니다.');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/3/password', expect.objectContaining({
      method: 'PUT'
    }));
  });

  it('관리자는 기준정보를 확인 후 완전 삭제할 수 있다', async () => {
    setAuth(['ADMIN', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/positions');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/positions/1/hard-delete' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (url === '/api/admin/positions' && !init?.method) {
        return new Response(JSON.stringify(positions), {
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

    const row = await screen.findByRole('row', { name: /#1 사원/ });
    await userEvent.click(within(row).getByRole('button', { name: '완전 삭제' }));

    const dialog = screen.getByRole('dialog', { name: '완전 삭제' });
    expect(dialog).toHaveTextContent('복구할 수 없습니다');
    await userEvent.click(within(dialog).getByRole('button', { name: '완전 삭제' }));

    expect(await screen.findByRole('status')).toHaveTextContent('완전 삭제되었습니다.');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/positions/1/hard-delete', expect.objectContaining({
      method: 'DELETE'
    }));
  });

  it('관리자는 사용자 역할을 체크박스로 선택해 매니저 권한을 저장한다', async () => {
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
      if (url === '/api/admin/users/3' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body.roles).toBe('MANAGER,APPLICANT');
        return new Response(JSON.stringify({
          ...users[0],
          roles: body.roles
        }), {
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

    const row = await screen.findByRole('row', { name: /#3 employee01/ });
    await userEvent.click(within(row).getByRole('button', { name: '수정' }));

    expect(screen.getByLabelText('아이디').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('이름').parentElement).toHaveTextContent('*');
    expect(screen.getByRole('checkbox', { name: 'MANAGER' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'MANAGER' }));
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/3', expect.objectContaining({
      method: 'PUT'
    }));
  });

  it('관리자는 기존 단일 조직 응답을 기본 소속 목록으로 보정해 저장한다', async () => {
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
      if (url === '/api/admin/organizations' && !init?.method) {
        return new Response(JSON.stringify(organizations), {
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
      if (url === '/api/admin/users/3' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body.organizationId).toBe(2);
        expect(body.organizationMemberships).toEqual([
          { organizationId: 3, primary: false, active: true, sortOrder: 10 },
          { organizationId: 2, primary: true, active: true, sortOrder: 20 }
        ]);
        expect(body.positionId).toBe(4);
        return new Response(JSON.stringify({
          ...users[0],
          organization_id: body.organizationId,
          position_id: body.positionId,
          organizationMemberships: body.organizationMemberships
        }), {
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

    const row = await screen.findByRole('row', { name: /#3 employee01/ });
    await userEvent.click(within(row).getByRole('button', { name: '수정' }));

    expect(screen.getByRole('combobox', { name: '1번째 조직' })).toHaveDisplayValue('개발팀');
    expect(screen.getByRole('radio', { name: '개발팀 대표 소속' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '개발팀 활성 소속' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '직위' })).toHaveDisplayValue('사원');

    await userEvent.click(screen.getByRole('button', { name: '소속 추가' }));
    expect(screen.getByRole('combobox', { name: '2번째 조직' })).toHaveDisplayValue('더이음');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '2번째 조직' }), '2');
    await userEvent.click(screen.getByRole('radio', { name: '경영지원팀 대표 소속' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '직위' }), '4');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/3', expect.objectContaining({
      method: 'PUT'
    }));
  });

  it('관리자는 사용자 수정 폼에서 여러 조직 소속을 편집하고 대표 소속을 하나만 저장한다', async () => {
    setAuth(['ADMIN', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/users');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/users' && !init?.method) {
        return new Response(JSON.stringify(multiOrganizationUsers), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/organizations' && !init?.method) {
        return new Response(JSON.stringify(organizations), {
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
      if (url === '/api/admin/users/18' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body.organizationId).toBe(1);
        expect(body.organizationMemberships).toEqual([
          { organizationId: 3, primary: false, active: true, sortOrder: 10 },
          { organizationId: 1, primary: true, active: true, sortOrder: 20 },
          { organizationId: 2, primary: false, active: false, sortOrder: 30 }
        ]);
        return new Response(JSON.stringify({
          ...multiOrganizationUsers[0],
          organization_id: body.organizationId,
          organization_name: '더이음',
          organizationMemberships: body.organizationMemberships.map((membership: { organizationId: number }) => ({
            ...membership,
            organizationName: membership.organizationId === 1 ? '더이음' : '개발팀'
          }))
        }), {
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

    const row = await screen.findByRole('row', { name: /#18 lead-dev/ });
    expect(within(row).getByText('대표: 개발팀')).toBeInTheDocument();
    expect(within(row).getByText('활성: 더이음')).toBeInTheDocument();
    expect(within(row).getByText('비활성: 경영지원팀')).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: '수정' }));

    expect(screen.getByRole('radio', { name: '개발팀 대표 소속' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '더이음 대표 소속' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '개발팀 활성 소속' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '더이음 활성 소속' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '경영지원팀 활성 소속' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: '더이음 대표 소속' }));
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/18', expect.objectContaining({
      method: 'PUT'
    }));
  });

  it('예외 결재자는 조직과 대상자를 콤보로 선택해 저장한다', async () => {
    setAuth(['MANAGER']);
    window.history.pushState({}, '', '/admin/approval-org-exceptions');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/approval-org-exceptions' && !init?.method) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/organizations' && !init?.method) {
        return new Response(JSON.stringify(organizations), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/users' && !init?.method) {
        return new Response(JSON.stringify(users), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/approval-org-exceptions' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.organizationId).toBe(3);
        expect(body.approverUserId).toBe(3);
        return new Response(JSON.stringify({
          id: 9,
          approvalTypeId: 1,
          organizationId: body.organizationId,
          organizationName: '개발팀',
          approverUserId: body.approverUserId,
          approverName: '직원01',
          stepOrder: body.stepOrder,
          active: true
        }), {
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

    await screen.findByRole('heading', { name: '조직별 예외 결재자 관리' });
    await userEvent.click(screen.getByRole('button', { name: '새 항목' }));

    expect(screen.getByRole('combobox', { name: '조직' })).toHaveDisplayValue('더이음');
    expect(screen.getByRole('combobox', { name: '예외 결재자' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '조직' }), '3');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '예외 결재자' }), '3');
    expect(screen.getByRole('combobox', { name: '예외 결재자' })).toHaveDisplayValue('직원01');
    await userEvent.clear(screen.getByLabelText('단계'));
    await userEvent.type(screen.getByLabelText('단계'), '2');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/approval-org-exceptions', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('결재선 단계는 행 단위 편집기로 수정해 저장한다', async () => {
    setAuth(['MANAGER']);
    window.history.pushState({}, '', '/admin/approval-lines');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/admin/approval-lines' && !init?.method) {
        return new Response(JSON.stringify(approvalLines), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/admin/approval-types' && !init?.method) {
        return new Response(JSON.stringify(approvalTypes), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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
      if (url === '/api/admin/approval-lines/1' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body.approvalTypeId).toBe(1);
        expect(body.steps).toEqual([
          {
            stepOrder: 1,
            stepType: 'DIRECT_USER',
            organizationScope: null,
            positionId: null,
            directUserId: 18,
            sortPolicy: 'POSITION_ORDER'
          },
          {
            stepOrder: 2,
            stepType: 'ORG_POSITION',
            organizationScope: 'PARENT_ORG',
            positionId: 4,
            directUserId: null,
            sortPolicy: 'POSITION_ORDER'
          }
        ]);
        return new Response(JSON.stringify({
          ...approvalLines[0],
          steps: body.steps
        }), {
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

    const row = await screen.findByRole('row', { name: /영수증 첨부 신청 기본 결재선/ });
    await userEvent.click(within(row).getByRole('button', { name: '수정' }));

    expect(screen.queryByLabelText('단계')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '결재 유형' })).toHaveDisplayValue('영수증 첨부 신청');
    expect(screen.getByText('결재선 설정 안내')).toBeInTheDocument();
    expect(screen.getByText(/신청서 유형별로 활성 결재선은 하나만 사용합니다/)).toBeInTheDocument();
    expect(screen.getByText('직접 사용자')).toBeInTheDocument();
    expect(screen.getByText('조직/직위')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '1단계 사용자' })).toHaveDisplayValue('#2 결재자01');
    expect(screen.queryByLabelText('1단계 조직범위')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('1단계 직위')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '1단계 사용자' }), '18');
    await userEvent.click(screen.getByRole('button', { name: '단계 추가' }));
    await userEvent.selectOptions(screen.getByLabelText('2단계 유형'), 'ORG_POSITION');
    expect(screen.queryByLabelText('2단계 사용자')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '요청자 부서' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '상위 조직' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '최상위 조직' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('2단계 조직범위'), 'PARENT_ORG');
    await userEvent.selectOptions(screen.getByLabelText('2단계 직위'), '4');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/approval-lines/1', expect.objectContaining({
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
