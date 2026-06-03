import { Check, Eye, RefreshCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { applicationStatusLabel } from '../applications/applicationTypes';
import { formatDate, formatDateTime, formatMoney } from '../applications/formatters';
import { ApiError } from '../shared/api';
import { approveStep, getApprovalInbox, rejectStep } from './approvalApi';
import { ApprovalInboxItem } from './approvalTypes';

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return '결재함을 불러오지 못했습니다.';
}

function attachmentLabel(value: boolean | null | undefined) {
  if (value === true) {
    return '있음';
  }

  if (value === false) {
    return '없음';
  }

  return '-';
}

export function ApprovalsInboxPage() {
  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [isLoading, setLoading] = useState(true);
  const [processingStepId, setProcessingStepId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function loadInbox() {
    setLoading(true);
    setError('');

    try {
      setItems(await getApprovalInbox());
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
  }, []);

  async function handleApprove(stepId: number) {
    setProcessingStepId(stepId);
    setError('');

    try {
      await approveStep(stepId, comments[stepId] ?? '');
      await loadInbox();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setProcessingStepId(null);
    }
  }

  async function handleReject(stepId: number) {
    const comment = comments[stepId]?.trim() ?? '';
    if (!comment) {
      setError('반려 의견을 입력해주세요.');
      return;
    }

    setProcessingStepId(stepId);
    setError('');

    try {
      await rejectStep(stepId, comment);
      await loadInbox();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setProcessingStepId(null);
    }
  }

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">결재 업무</p>
          <h1 id="page-title">결재함</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadInbox}>
          <RefreshCcw aria-hidden="true" size={16} />
          새로고침
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>결재 대기 목록</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>접수일</th>
                <th>신청자</th>
                <th>조직</th>
                <th>영수증 일자</th>
                <th>사용처</th>
                <th>금액</th>
                <th>첨부 여부</th>
                <th>상태</th>
                <th>의견</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10}>불러오는 중</td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.stepId}>
                    <td>{item.receivedAt ? formatDateTime(item.receivedAt) : '-'}</td>
                    <td>{item.applicantName}</td>
                    <td>{item.organizationName ?? '-'}</td>
                    <td>{formatDate(item.receiptDate)}</td>
                    <td>{item.vendor}</td>
                    <td>{formatMoney(item.amount)}</td>
                    <td>{attachmentLabel(item.hasAttachment)}</td>
                    <td><span className="status-pill compact">{applicationStatusLabel(item.applicationStatus)}</span></td>
                    <td>
                      <label className="sr-only" htmlFor={`comment-${item.stepId}`}>결재 의견</label>
                      <input
                        id={`comment-${item.stepId}`}
                        className="comment-input"
                        value={comments[item.stepId] ?? ''}
                        onChange={(event) => setComments((current) => ({
                          ...current,
                          [item.stepId]: event.target.value
                        }))}
                        placeholder="의견"
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          disabled={processingStepId === item.stepId}
                          type="button"
                          onClick={() => void handleApprove(item.stepId)}
                        >
                          <Check aria-hidden="true" size={16} />
                          승인
                        </button>
                        <button
                          className="secondary-button danger-button"
                          disabled={processingStepId === item.stepId}
                          type="button"
                          onClick={() => void handleReject(item.stepId)}
                        >
                          <X aria-hidden="true" size={16} />
                          반려
                        </button>
                        <Link className="icon-button" to={`/applications/${item.applicationId}`} aria-label={`신청서 ${item.applicationId} 상세`}>
                          <Eye aria-hidden="true" size={16} />
                        </Link>
                        <button className="secondary-button" disabled type="button">
                          첨부 확대 보기
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>결재 대기 없음</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
