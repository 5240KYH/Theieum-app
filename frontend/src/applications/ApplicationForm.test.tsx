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

  it('임시저장 후 내용을 수정해 제출하면 수정된 값으로 새 신청서를 제출한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const id = body.vendor === '문구점' ? 100 : 101;
        return new Response(JSON.stringify({
          ...draftResponse,
          id,
          vendor: body.vendor,
          amount: body.amount,
          description: body.description
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/100/attachments' || url === '/api/applications/101/attachments') {
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

      if (url === '/api/applications/101/submit' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          ...submittedResponse,
          id: 101,
          vendor: '카페',
          amount: 15000,
          description: '수정된 회의 다과'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/applications/101') {
        return new Response(JSON.stringify({
          ...submittedResponse,
          id: 101,
          vendor: '카페',
          amount: 15000,
          description: '수정된 회의 다과'
        }), {
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
      expect(window.location.pathname).toBe('/applications/101');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/101/submit', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('지원하지 않는 이미지 형식이나 5MB 초과 파일은 첨부하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App />);

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
});
