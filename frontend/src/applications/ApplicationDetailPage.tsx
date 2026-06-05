import { Edit3, FileImage, RefreshCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import { cancelApplication, getApplication, getAttachmentContent, hardDeleteApplication } from './applicationApi';
import {
  applicationStatusLabel,
  ApplicationResponse,
  AttachmentResponse,
  approvalStepStatusLabel,
  canEditApplication,
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
  const auth = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [error, setError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<{ attachment: AttachmentResponse; previewUrl: string } | null>(null);

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

  async function handleCancelApplication() {
    if (!application) {
      return;
    }

    setError('');

    try {
      setApplication(await cancelApplication(application.id));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function handleHardDeleteApplication() {
    if (!application) {
      return;
    }

    setDeleting(true);
    setDeleteError('');
    setError('');

    try {
      await hardDeleteApplication(application.id);
      navigate('/applications/my');
    } catch (requestError) {
      setDeleteError(errorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    void loadApplication();
  }, [id]);

  const canHardDelete = application
    ? (application.status === 'DRAFT' || application.status === 'CANCELED')
      && (auth.hasRole('ADMIN') || application.applicant.id === auth.user?.id)
    : false;

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">신청 업무</p>
          <h1 id="page-title">신청서 상세</h1>
        </div>
        <div className="row-actions mobile-detail-actions">
          {application && canEditApplication(application.status) ? (
            <Link className="secondary-button" to={`/applications/${application.id}/edit`}>
              <Edit3 aria-hidden="true" size={16} />
              수정
            </Link>
          ) : null}
          {application?.status === 'DRAFT' ? (
            <button className="secondary-button danger-button" type="button" onClick={handleCancelApplication}>
              <XCircle aria-hidden="true" size={16} />
              신청 취소
            </button>
          ) : null}
          {application && canHardDelete ? (
            <button className="secondary-button hard-delete-button" type="button" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 aria-hidden="true" size={16} />
              신청서 삭제
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={loadApplication}>
            <RefreshCcw aria-hidden="true" size={16} />
            새로고침
          </button>
        </div>
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
                      onOpenPreview={setPreviewAttachment}
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
            {application.approvalHistories && application.approvalHistories.length > 0 ? (
              <div className="mobile-card-list approval-history-cards" role="list" aria-label="모바일 결재 이력">
                {application.approvalHistories.map((history) => (
                  <article className="mobile-card" role="listitem" key={history.id}>
                    <div className="mobile-card-title">
                      <strong>{approvalStepStatusLabel(history.action)}</strong>
                      <span className="status-pill compact">{history.stepOrder ?? '-'}단계</span>
                    </div>
                    <dl className="mobile-card-meta">
                      <div>
                        <dt>원 결재자</dt>
                        <dd>{history.originalApprover?.name ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>처리자</dt>
                        <dd>{history.actor.name}</dd>
                      </div>
                      <div>
                        <dt>사유/메모</dt>
                        <dd>{history.adminReason ?? history.comment ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>처리일</dt>
                        <dd>{formatDateTime(history.actedAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>원 결재자</th>
                    <th>처리자</th>
                    <th>처리</th>
                    <th>사유/메모</th>
                    <th>처리일</th>
                  </tr>
                </thead>
                <tbody>
                  {application.approvalHistories && application.approvalHistories.length > 0 ? (
                    application.approvalHistories.map((history) => (
                    <tr key={history.id}>
                      <td>{history.stepOrder ?? '-'}</td>
                      <td>{history.originalApprover?.name ?? '-'}</td>
                      <td>{history.actor.name}</td>
                      <td>{approvalStepStatusLabel(history.action)}</td>
                      <td>{history.adminReason ?? history.comment ?? '-'}</td>
                      <td>{formatDateTime(history.actedAt)}</td>
                    </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>결재 이력 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {application && showDeleteConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="application-hard-delete-title">
          <div className="preview-modal compact-modal danger-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="application-hard-delete-title">신청서 삭제</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="닫기"
                onClick={() => {
                  if (!isDeleting) {
                    setShowDeleteConfirm(false);
                    setDeleteError('');
                  }
                }}
              >
                ×
              </button>
            </div>
            <div className="form-panel borderless-panel">
              <p className="danger-copy">이 신청서와 첨부파일은 복구할 수 없습니다.</p>
              <dl className="definition-grid compact-definition">
                <div>
                  <dt>신청서</dt>
                  <dd>#{application.id}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>{applicationStatusLabel(application.status)}</dd>
                </div>
              </dl>
              {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
              <div className="form-actions">
                <button className="secondary-button" type="button" disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)}>
                  취소
                </button>
                <button className="primary-button hard-delete-confirm-button" type="button" disabled={isDeleting} onClick={() => void handleHardDeleteApplication()}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewAttachment ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="첨부 이미지 확대 보기">
          <div className="preview-modal">
            <div className="table-toolbar">
              <strong>{previewAttachment.attachment.originalFilename}</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="닫기"
                onClick={() => setPreviewAttachment(null)}
              >
                ×
              </button>
            </div>
            <div className="preview-canvas">
              <img
                src={previewAttachment.previewUrl}
                alt={`${previewAttachment.attachment.originalFilename} 확대 미리보기`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AttachmentPreview({
  applicationId,
  attachment,
  onOpenPreview
}: {
  applicationId: number;
  attachment: AttachmentResponse;
  onOpenPreview: (preview: { attachment: AttachmentResponse; previewUrl: string }) => void;
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
      <button
        className="attachment-thumb attachment-thumb-button"
        type="button"
        aria-label={`${attachment.originalFilename} 크게 보기`}
        disabled={!previewUrl}
        onClick={() => onOpenPreview({ attachment, previewUrl })}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={`${attachment.originalFilename} 미리보기`} />
        ) : (
          <FileImage aria-hidden="true" size={28} />
        )}
      </button>
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
