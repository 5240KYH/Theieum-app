import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ShieldCheck, Trash2, X } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { applicationStatusLabel, ApprovalStepResponse } from '../applications/applicationTypes';
import { ApiError } from '../shared/api';
import {
  adminApproveStep,
  downloadMonthlyReceiptAttachments,
  getAdminApplications,
  getApplication,
  hardDeleteAdminApplication
} from './adminApi';
import { AdminApplication, findPendingStep } from './adminTypes';

const statusOptions = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '임시저장' },
  { value: 'IN_APPROVAL', label: '결재중' },
  { value: 'APPROVED', label: '승인완료' },
  { value: 'REJECTED', label: '반려' },
  { value: 'CANCELED', label: '취소' }
];

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

function currentMonth() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function AdminApplicationsPage() {
  const auth = useAuth();
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedApplication, setSelectedApplication] = useState<AdminApplication | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<AdminApplication | null>(null);
  const [pendingStep, setPendingStep] = useState<ApprovalStepResponse | null>(null);
  const [reason, setReason] = useState('');
  const [downloadMonth, setDownloadMonth] = useState(currentMonth);
  const [isLoading, setLoading] = useState(true);
  const [isApproving, setApproving] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [isDownloadingAttachments, setDownloadingAttachments] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lastOverrideButtonRef = useRef<HTMLButtonElement | null>(null);
  const overrideCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedApplication) {
      overrideCloseButtonRef.current?.focus();
    }
  }, [selectedApplication]);

  const filteredApplications = useMemo(() => {
    if (statusFilter === 'ALL') {
      return applications;
    }

    return applications.filter((application) => application.status === statusFilter);
  }, [applications, statusFilter]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await getAdminApplications();
        if (!ignore) {
          setApplications(data);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(errorMessage(requestError));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  function handleFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(event.target.value);
  }

  async function openOverride(application: AdminApplication, trigger: HTMLButtonElement) {
    lastOverrideButtonRef.current = trigger;
    setSelectedApplication(application);
    setPendingStep(null);
    setReason('');
    setMessage('');
    setError('');

    try {
      const detail = await getApplication(application.id);
      const nextStep = findPendingStep(detail);
      if (!nextStep) {
        setError('현재 대기 중인 결재 단계가 없습니다.');
        return;
      }
      setPendingStep(nextStep);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  function closeOverride() {
    setSelectedApplication(null);
    setPendingStep(null);
    setReason('');
    window.requestAnimationFrame(() => lastOverrideButtonRef.current?.focus());
  }

  function handleOverrideKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      closeOverride();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      overrideCloseButtonRef.current?.focus();
    }
  }

  async function handleAdminApprove() {
    if (!reason.trim()) {
      setError('관리자 예외 결재 사유를 입력해주세요.');
      return;
    }

    if (!pendingStep) {
      setError('현재 대기 중인 결재 단계를 찾을 수 없습니다.');
      return;
    }

    setApproving(true);
    setError('');
    setMessage('');

    try {
      const result = await adminApproveStep(pendingStep.id, reason.trim());
      setApplications((current) => current.map((application) => {
        if (application.id !== selectedApplication?.id) {
          return application;
        }

        return { ...application, status: result.status };
      }));
      setMessage('관리자 예외 결재가 완료되었습니다.');
      closeOverride();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setApproving(false);
    }
  }

  function canHardDelete(application: AdminApplication) {
    return auth.hasRole('ADMIN') && (application.status === 'DRAFT' || application.status === 'CANCELED');
  }

  async function handleHardDeleteApplication() {
    if (!hardDeleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError('');
    setError('');
    setMessage('');

    try {
      await hardDeleteAdminApplication(hardDeleteTarget.id);
      setApplications((current) => current.filter((application) => application.id !== hardDeleteTarget.id));
      setHardDeleteTarget(null);
      setMessage('신청서가 완전 삭제되었습니다.');
    } catch (requestError) {
      setDeleteError(errorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  async function handleMonthlyAttachmentDownload() {
    if (!downloadMonth) {
      setError('다운로드할 월을 선택해주세요.');
      return;
    }

    setDownloadingAttachments(true);
    setError('');
    setMessage('');

    try {
      const blob = await downloadMonthlyReceiptAttachments(downloadMonth);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `receipt-attachments-${downloadMonth}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage(`${downloadMonth} 첨부파일 다운로드를 시작했습니다.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDownloadingAttachments(false);
    }
  }

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">관리</p>
          <h1 id="page-title">전체 신청서 관리</h1>
        </div>
        <span className="status-pill">{filteredApplications.length}건</span>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <label className="inline-field">
            상태 필터
            <select value={statusFilter} onChange={handleFilterChange}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {auth.hasRole('ADMIN') ? (
            <div className="row-actions monthly-download-actions">
              <label className="inline-field">
                첨부 다운로드 월
                <input
                  aria-label="첨부 다운로드 월"
                  type="month"
                  value={downloadMonth}
                  onChange={(event) => setDownloadMonth(event.target.value)}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={isDownloadingAttachments}
                onClick={() => void handleMonthlyAttachmentDownload()}
              >
                <Download aria-hidden="true" size={16} />
                월별 첨부 다운로드
              </button>
            </div>
          ) : null}
        </div>

        {error ? <p className="form-error panel-message" role="alert">{error}</p> : null}
        {message ? <p className="form-success panel-message" role="status">{message}</p> : null}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>신청서 ID</th>
                <th>신청자</th>
                <th>사용처</th>
                <th>상태</th>
                <th>관리자 예외</th>
                <th>완전 삭제</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => (
                <tr key={application.id}>
                  <td>#{application.id}</td>
                  <td>{application.applicantName}</td>
                  <td>{application.vendor}</td>
                  <td>{applicationStatusLabel(application.status)}</td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={application.status !== 'IN_APPROVAL'}
                      onClick={(event) => void openOverride(application, event.currentTarget)}
                    >
                      <ShieldCheck aria-hidden="true" size={16} />
                      예외 결재
                    </button>
                  </td>
                  <td>
                    {canHardDelete(application) ? (
                      <button
                        className="secondary-button hard-delete-button"
                        type="button"
                        onClick={() => {
                          setHardDeleteTarget(application);
                          setDeleteError('');
                          setMessage('');
                          setError('');
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                        완전 삭제
                      </button>
                    ) : (
                      <span className="muted-copy">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6}>조회된 신청서가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApplication ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="관리자 예외 결재"
          onKeyDown={handleOverrideKeyDown}
        >
          <div className="preview-modal compact-modal">
            <div className="table-toolbar">
              <strong>#{selectedApplication.id} 관리자 예외 결재</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="닫기"
                ref={overrideCloseButtonRef}
                onClick={closeOverride}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="form-panel borderless-panel">
              <p className="muted-copy">
                {pendingStep ? `${pendingStep.originalApprover.name} 결재 단계를 관리자 권한으로 처리합니다.` : '결재 단계를 확인하고 있습니다.'}
              </p>
              <label className="wide-field">
                예외 결재 사유
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="예: 결재자 부재로 인한 관리자 예외 처리"
                />
              </label>
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeOverride}>
                  취소
                </button>
                <button className="primary-button" type="button" disabled={isApproving || !pendingStep} onClick={() => void handleAdminApprove()}>
                  예외 승인
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hardDeleteTarget ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-application-hard-delete-title"
        >
          <div className="preview-modal compact-modal danger-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="admin-application-hard-delete-title">신청서 완전 삭제</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="닫기"
                onClick={() => {
                  if (!isDeleting) {
                    setHardDeleteTarget(null);
                    setDeleteError('');
                  }
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="form-panel borderless-panel">
              <p className="danger-copy">이 신청서와 첨부파일은 복구할 수 없습니다.</p>
              <dl className="definition-grid compact-definition">
                <div>
                  <dt>신청서</dt>
                  <dd>#{hardDeleteTarget.id}</dd>
                </div>
                <div>
                  <dt>신청자</dt>
                  <dd>{hardDeleteTarget.applicantName}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>{applicationStatusLabel(hardDeleteTarget.status)}</dd>
                </div>
              </dl>
              {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
              <div className="form-actions">
                <button className="secondary-button" type="button" disabled={isDeleting} onClick={() => setHardDeleteTarget(null)}>
                  취소
                </button>
                <button className="primary-button hard-delete-confirm-button" type="button" disabled={isDeleting} onClick={() => void handleHardDeleteApplication()}>
                  완전 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
