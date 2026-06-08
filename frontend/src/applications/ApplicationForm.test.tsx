import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  approvalOrganizationId: 3,
  approvalOrganizationName: '개발팀',
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
      organizationName: '개발팀',
      positionName: '팀장',
      status: 'PENDING',
      actedAt: null
    }
  ]
};

const approvalOrganizations = [
  { id: 3, name: '개발팀', parentId: 1, levelNo: 2, primary: true },
  { id: 4, name: '재무팀', parentId: 1, levelNo: 2, primary: false }
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function mockDefaultApprovalFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/applications/approval-organizations') {
      return jsonResponse(approvalOrganizations);
    }

    if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3') {
      return jsonResponse([
        {
          stepOrder: 1,
          approver: { id: 3, name: '채동훈', organizationName: '미디어팀', positionName: '팀장' },
          autoApprovalExpected: true
        },
        {
          stepOrder: 2,
          approver: { id: 20, name: '정은총', organizationName: '더이음사랑의교회', positionName: '대표' },
          autoApprovalExpected: false
        }
      ]);
    }

    return jsonResponse([]);
  });
}

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
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());

    render(<App />);
    vi.mocked(fetch).mockClear();

    expect(screen.getByLabelText('신청일자').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('영수증 일자').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('사용처').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('금액').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('신청 내용').parentElement).toHaveTextContent('*');
    expect(screen.getByLabelText('영수증 이미지 첨부').parentElement).toHaveTextContent('*');

    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(screen.getByText('필수 항목을 입력하면 제출할 수 있습니다.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/api/applications', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('신청 전에 예상 결재선을 표시한다', async () => {
    const fetchMock = mockDefaultApprovalFetch();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const organizationSelect = await screen.findByLabelText('결재 기준 조직');
    expect(organizationSelect).toHaveValue('3');
    expect(organizationSelect).toHaveDisplayValue('개발팀');
    expect(await screen.findByRole('heading', { name: '예상 결재선' })).toBeInTheDocument();
    expect(screen.getByText('1단계')).toBeInTheDocument();
    expect(screen.getByText('미디어팀')).toBeInTheDocument();
    expect(screen.getByText('채동훈')).toBeInTheDocument();
    expect(screen.getByText('팀장')).toBeInTheDocument();
    expect(screen.getByText('자동')).toBeInTheDocument();
    expect(screen.getByText('2단계')).toBeInTheDocument();
    expect(screen.getByText('더이음사랑의교회')).toBeInTheDocument();
    expect(screen.getByText('정은총')).toBeInTheDocument();
    expect(screen.getByText('대표')).toBeInTheDocument();
    expect(screen.queryByText('개발팀 (대표)')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '예상 결재선' }).compareDocumentPosition(screen.getByLabelText('신청일자'))
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3',
      expect.anything()
    );
  });

  it('조직 선택을 변경하면 선택 조직으로 예상 결재선을 다시 조회한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/applications/approval-organizations') {
        return jsonResponse(approvalOrganizations);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3') {
        return jsonResponse([
          { stepOrder: 1, approver: { id: 18, name: '개발팀장', organizationName: '개발팀', positionName: '팀장' }, autoApprovalExpected: false }
        ]);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=4') {
        return jsonResponse([
          { stepOrder: 1, approver: { id: 31, name: '재무팀장', organizationName: '재무팀', positionName: '팀장' }, autoApprovalExpected: false }
        ]);
      }

      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const organizationSelect = await screen.findByLabelText('결재 기준 조직');
    expect(await screen.findByText('개발팀장')).toBeInTheDocument();

    await userEvent.selectOptions(organizationSelect, '4');

    expect(await screen.findByText('재무팀장')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=4',
      expect.anything()
    );
  });

  it('영수증 이미지 첨부 필수 표시는 라벨 안에서 한 줄로 유지한다', () => {
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());

    render(<App />);

    const attachmentLabel = screen.getByText('영수증 이미지 첨부').closest('label');

    expect(attachmentLabel).toHaveClass('required-inline-label');
    expect(attachmentLabel).toHaveTextContent('영수증 이미지 첨부 *');
  });

  it('모바일에서 첨부 영역과 제출 액션을 고정형 구조로 제공한다', () => {
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());

    render(<App />);

    expect(screen.getByLabelText('영수증 이미지 첨부').closest('.mobile-attachment-uploader')).not.toBeNull();
    expect(screen.getByRole('button', { name: '제출' }).closest('.mobile-sticky-actions')).not.toBeNull();
  });

  it('여러 이미지 첨부 후 썸네일과 개별 삭제 버튼을 표시한다', async () => {
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());
    render(<App />);

    const firstFile = new File(['receipt'], 'receipt.png', { type: 'image/png' });
    const secondFile = new File(['receipt2'], 'receipt-2.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('영수증 이미지 첨부'), [firstFile, secondFile]);

    expect(screen.getByAltText('receipt.png 미리보기')).toBeInTheDocument();
    expect(screen.getByAltText('receipt-2.png 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'receipt.png 첨부 삭제' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'receipt.png 첨부 삭제' }));

    expect(screen.queryByAltText('receipt.png 미리보기')).not.toBeInTheDocument();
    expect(screen.getByAltText('receipt-2.png 미리보기')).toBeInTheDocument();
  });

  it('제출 성공 후 내 신청서 상세로 이동한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.approvalOrganizationId).toBe(3);
        return new Response(JSON.stringify(draftResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/attachments' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get('file')).toBeInstanceOf(File);
        const uploadedFile = (init.body as FormData).get('file') as File;
        return new Response(JSON.stringify({
          id: 501,
          originalFilename: uploadedFile.name,
          mimeType: 'image/png',
          fileSize: uploadedFile.size
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

      if (url === '/api/applications/approval-organizations') {
        return jsonResponse(approvalOrganizations);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3') {
        return jsonResponse([
          { stepOrder: 1, approver: { id: 18, name: '개발팀장', organizationName: '개발팀', positionName: '팀장' }, autoApprovalExpected: false }
        ]);
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
      [
        new File(['receipt'], 'receipt.png', { type: 'image/png' }),
        new File(['receipt-2'], 'receipt-2.png', { type: 'image/png' })
      ]
    );

    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/applications/100');
    });
    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    const attachmentCalls = fetchMock.mock.calls.filter(([input]) => String(input) === '/api/applications/100/attachments');
    expect(attachmentCalls).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/submit', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('임시저장 후 내용을 수정해 제출하면 같은 신청서를 갱신해 제출한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.approvalOrganizationId).toBe(3);
        return new Response(JSON.stringify({
          ...draftResponse,
          vendor: body.vendor,
          amount: body.amount,
          description: body.description
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/attachments') {
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

      if (url === '/api/applications/100' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        expect(body.vendor).toBe('카페');
        expect(body.approvalOrganizationId).toBe(3);
        return new Response(JSON.stringify({
          ...draftResponse,
          vendor: body.vendor,
          amount: body.amount,
          description: body.description
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/submit' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          ...submittedResponse,
          vendor: '카페',
          amount: 15000,
          description: '수정된 회의 다과'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100') {
        return new Response(JSON.stringify({
          ...submittedResponse,
          vendor: '카페',
          amount: 15000,
          description: '수정된 회의 다과'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/approval-organizations') {
        return jsonResponse(approvalOrganizations);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3') {
        return jsonResponse([
          { stepOrder: 1, approver: { id: 18, name: '개발팀장', organizationName: '개발팀', positionName: '팀장' }, autoApprovalExpected: false }
        ]);
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

    await userEvent.click(screen.getByRole('button', { name: '임시저장' }));
    await screen.findByText('임시저장 완료: 신청서 #100');

    await userEvent.clear(screen.getByLabelText('사용처'));
    await userEvent.type(screen.getByLabelText('사용처'), '카페');
    await userEvent.clear(screen.getByLabelText('금액'));
    await userEvent.type(screen.getByLabelText('금액'), '15000');
    await userEvent.clear(screen.getByLabelText('신청 내용'));
    await userEvent.type(screen.getByLabelText('신청 내용'), '수정된 회의 다과');
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/applications/100');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/100', expect.objectContaining({
      method: 'PUT'
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/submit', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('지원하지 않는 이미지 형식이나 5MB 초과 파일은 첨부하지 않는다', async () => {
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());
    render(<App />);
    vi.mocked(fetch).mockClear();

    const fileInput = screen.getByLabelText('영수증 이미지 첨부');
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/gif,image/webp');

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['receipt'], 'receipt.svg', { type: 'image/svg+xml' })]
      }
    });

    expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPG, GIF, WebP 이미지만 첨부할 수 있습니다.');
    expect(screen.queryByAltText('receipt.svg 미리보기')).not.toBeInTheDocument();

    const largeFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('영수증 이미지 첨부'), {
      target: {
        files: [largeFile]
      }
    });

    expect(screen.getByRole('alert')).toHaveTextContent('영수증 이미지는 5MB 이하로 첨부해주세요.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('수정 화면은 기존 신청서의 결재 기준 조직을 선택값으로 사용한다', async () => {
    window.history.pushState({}, '', '/applications/100/edit');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/applications/100') {
        return jsonResponse({
          ...draftResponse,
          approvalOrganizationId: 4,
          approvalOrganizationName: '재무팀',
          attachments: [{ id: 501, originalFilename: 'receipt.png', mimeType: 'image/png', fileSize: 7 }]
        });
      }

      if (url === '/api/applications/approval-organizations') {
        return jsonResponse(approvalOrganizations);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=4') {
        return jsonResponse([
          { stepOrder: 1, approver: { id: 31, name: '재무팀장', organizationName: '재무팀', positionName: '팀장' }, autoApprovalExpected: false }
        ]);
      }

      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const organizationSelect = await screen.findByLabelText('결재 기준 조직');

    expect(organizationSelect).toHaveValue('4');
    expect(await screen.findByText('재무팀장')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=4',
      expect.anything()
    );
  });
});
