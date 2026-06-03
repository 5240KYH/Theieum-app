import { FileImage, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../shared/api';
import { getApplication, getAttachmentContent } from './applicationApi';
import {
  applicationStatusLabel,
  ApplicationResponse,
  AttachmentResponse,
  approvalStepStatusLabel,
  currentApprover,
  hasAdminException
} from './applicationTypes';
import { formatDate, formatDateTime, formatMoney } from './formatters';

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return '신청서 상세를 불러오지 못했습니다.';
}

export function ApplicationDetailPage() {
  const { id } = useParams();
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadApplication() {
    if (!id) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      setApplication(await getApplication(id));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApplication();
  }, [id]);

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">신청 업무</p>
          <h1 id="page-title">신청서 상세</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadApplication}>
          <RefreshCcw aria-hidden="true" size={16} />
          새로고침
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {isLoading ? (
        <div className="table-panel panel-message">불러오는 중</div>
      ) : application ? (
        <>
          <div className="detail-grid">
            <section className="info-panel" aria-labelledby="application-summary-title">
              <div className="section-title-row">
                <h2 id="application-summary-title">신청 내용</h2>
                <div className="badge-row">
                  <span className="status-pill compact">{applicationStatusLabel(application.status)}</span>
                  {hasAdminException(application) ? <span className="exception-badge">관리자 예외 처리</span> : null}
                </div>
              </div>
              <dl className="definition-grid">
                <div>
                  <dt>신청자</dt>
                  <dd>{application.applicant.name}</dd>
                </div>
                <div>
                  <dt>신청일</dt>
                  <dd>{formatDate(application.applicationDate)}</dd>
                </div>
                <div>
                  <dt>영수증 일자</dt>
                  <dd>{formatDate(application.receiptDate)}</dd>
                </div>
                <div>
                  <dt>사용처</dt>
                  <dd>{application.vendor}</dd>
                </div>
                <div>
                  <dt>금액</dt>
                  <dd>{formatMoney(application.amount)}</dd>
                </div>
                <div>
                  <dt>현재 결재자</dt>
                  <dd>{currentApprover(application)}</dd>
                </div>
              </dl>
              <p className="description-box">{application.description}</p>
            </section>

            <section className="info-panel" aria-labelledby="attachment-title">
              <h2 id="attachment-title">첨부 이미지</h2>
              {application.attachments && application.attachments.length > 0 ? (
                <div className="attachment-list">
                  {application.attachments.map((attachment) => (
                    <AttachmentPreview
                      key={attachment.id}
                      applicationId={application.id}
                      attachment={attachment}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state large">
                  <FileImage aria-hidden="true" size={28} />
                  <span>첨부 이미지 없음</span>
                </div>
              )}
            </section>
          </div>

          <section className="table-panel" aria-labelledby="approval-progress-title">
            <div className="table-toolbar">
              <strong id="approval-progress-title">결재 진행 상태</strong>
            </div>
            <div className="step-list">
              {application.approvalSteps.length > 0 ? application.approvalSteps.map((step) => (
                <div className="step-item" key={step.id}>
                  <span className="step-order">{step.stepOrder}</span>
                  <strong>{step.originalApprover.name}</strong>
                  <span className="status-pill compact">{approvalStepStatusLabel(step.status)}</span>
                  <span>{formatDateTime(step.actedAt)}</span>
                </div>
              )) : <p className="panel-message">결재 단계 없음</p>}
            </div>
          </section>

          <section className="table-panel" aria-labelledby="approval-history-title">
            <div className="table-toolbar">
              <strong id="approval-history-title">결재 이력</strong>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>결재자</th>
                    <th>처리</th>
                    <th>처리일</th>
                  </tr>
                </thead>
                <tbody>
                  {application.approvalSteps.length > 0 ? application.approvalSteps.map((step) => (
                    <tr key={step.id}>
                      <td>{step.stepOrder}</td>
                      <td>{step.originalApprover.name}</td>
                      <td>{approvalStepStatusLabel(step.status)}</td>
                      <td>{formatDateTime(step.actedAt)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4}>결재 이력 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}

function AttachmentPreview({
  applicationId,
  attachment
}: {
  applicationId: number;
  attachment: AttachmentResponse;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let isMounted = true;

    getAttachmentContent(applicationId, attachment.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setPreviewUrl(objectUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('첨부 이미지를 불러오지 못했습니다.');
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [applicationId, attachment.id]);

  return (
    <figure className="attachment-preview">
      <div className="attachment-thumb">
        {previewUrl ? (
          <img src={previewUrl} alt={`${attachment.originalFilename} 미리보기`} />
        ) : (
          <FileImage aria-hidden="true" size={28} />
        )}
      </div>
      <figcaption>
        <strong>{attachment.originalFilename}</strong>
        <span>{formatFileSize(attachment.fileSize)}</span>
        {error ? <span className="form-error">{error}</span> : null}
      </figcaption>
    </figure>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}
