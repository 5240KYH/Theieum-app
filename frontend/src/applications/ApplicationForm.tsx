import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileImage, Save, Send, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import {
  attachReceiptImage,
  createApplication,
  getApplication,
  getApprovalPreview,
  submitApplication,
  updateApplication
} from './applicationApi';
import { ApplicationResponse, ApprovalPreviewStep, canEditApplication } from './applicationTypes';

const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_RECEIPT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]);

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const date = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

function RequiredMark() {
  return <span className="required-mark" aria-hidden="true">*</span>;
}

export function ApplicationForm() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [applicationDate, setApplicationDate] = useState(today);
  const [receiptDate, setReceiptDate] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [draft, setDraft] = useState<ApplicationResponse | null>(null);
  const [draftPayloadSignature, setDraftPayloadSignature] = useState('');
  const [attachedDraftId, setAttachedDraftId] = useState<number | null>(null);
  const [existingAttachmentCount, setExistingAttachmentCount] = useState(0);
  const [approvalPreview, setApprovalPreview] = useState<ApprovalPreviewStep[]>([]);
  const [approvalPreviewError, setApprovalPreviewError] = useState('');
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const isComplete = useMemo(() => {
    return Boolean(
      applicationDate
      && receiptDate
      && vendor.trim()
      && amount
      && description.trim()
      && (receiptFile || existingAttachmentCount > 0)
    );
  }, [amount, applicationDate, description, existingAttachmentCount, receiptDate, receiptFile, vendor]);

  useEffect(() => {
    let ignore = false;

    async function loadEditableApplication() {
      if (!id) {
        return;
      }

      setError('');
      try {
        const application = await getApplication(id);
        if (ignore) {
          return;
        }
        if (!canEditApplication(application.status)) {
          setError('해당 상태의 신청서는 수정할 수 없습니다.');
          return;
        }
        setDraft(application);
        setApplicationDate(application.applicationDate);
        setReceiptDate(application.receiptDate);
        setVendor(application.vendor);
        setAmount(String(application.amount));
        setDescription(application.description);
        setExistingAttachmentCount(application.attachments?.length ?? 0);
        setDraftPayloadSignature(JSON.stringify({
          applicationDate: application.applicationDate,
          receiptDate: application.receiptDate,
          vendor: application.vendor,
          amount: Number(application.amount),
          description: application.description
        }));
      } catch (requestError) {
        if (!ignore) {
          setError(errorMessage(requestError));
        }
      }
    }

    void loadEditableApplication();

    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    let ignore = false;

    async function loadApprovalPreview() {
      setApprovalPreviewError('');
      try {
        const steps = await getApprovalPreview(1);
        if (!ignore) {
          setApprovalPreview(steps);
        }
      } catch (requestError) {
        if (!ignore) {
          setApprovalPreview([]);
          setApprovalPreviewError(errorMessage(requestError));
        }
      }
    }

    void loadApprovalPreview();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl('');
      return undefined;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(receiptFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  useEffect(() => {
    if (isPreviewOpen) {
      previewCloseButtonRef.current?.focus();
    }
  }, [isPreviewOpen]);

  function buildPayload() {
    return {
      applicationDate,
      receiptDate,
      vendor: vendor.trim(),
      amount: Number(amount),
      description: description.trim()
    };
  }

  function closePreview() {
    setPreviewOpen(false);
    window.requestAnimationFrame(() => previewButtonRef.current?.focus());
  }

  function handlePreviewKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      closePreview();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      previewCloseButtonRef.current?.focus();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!SUPPORTED_RECEIPT_IMAGE_TYPES.has(file.type)) {
      clearFile();
      setError('PNG, JPG, GIF, WebP 이미지만 첨부할 수 있습니다.');
      setMessage('');
      return;
    }

    if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
      clearFile();
      setError('영수증 이미지는 5MB 이하로 첨부해주세요.');
      setMessage('');
      return;
    }

    setReceiptFile(file);
    setAttachedDraftId(null);
    setMessage('');
    setError('');
  }

  function clearFile() {
    setReceiptFile(null);
    setAttachedDraftId(null);
    setPreviewOpen(false);
    setFileInputKey((value) => value + 1);
  }

  function validate() {
    if (!isComplete) {
      setError('필수 항목을 입력하면 제출할 수 있습니다.');
      return false;
    }

    if (Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      setError('금액은 0보다 큰 숫자로 입력해주세요.');
      return false;
    }

    return true;
  }

  async function saveDraft() {
    const payload = buildPayload();
    const payloadSignature = JSON.stringify(payload);
    const saved = draft && draftPayloadSignature === payloadSignature
      ? draft
      : draft
        ? await updateApplication(draft.id, payload)
        : await createApplication(payload);

    setDraft(saved);
    setDraftPayloadSignature(payloadSignature);

    if (receiptFile && attachedDraftId !== saved.id) {
      await attachReceiptImage(saved.id, receiptFile);
      setAttachedDraftId(saved.id);
    }

    return saved;
  }

  async function handleSaveDraft() {
    if (!validate()) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const saved = await saveDraft();
      setMessage(`임시저장 완료: 신청서 #${saved.id}`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const saved = await saveDraft();
      const submitted = await submitApplication(saved.id);
      navigate(`/applications/${submitted.id}`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">신청 업무</p>
          <h1 id="page-title">{id ? '신청서 수정' : '신청서 작성'}</h1>
        </div>
        <span className="status-pill">{draft ? '임시저장됨' : '작성 중'}</span>
      </div>

      <form className="form-panel application-form" onSubmit={handleSubmit}>
        <section className="approval-preview-panel" aria-labelledby="approval-preview-title">
          <div className="table-toolbar borderless-panel">
            <h2 id="approval-preview-title">예상 결재선</h2>
          </div>
          {approvalPreview.length > 0 ? (
            <ol className="approval-preview-list">
              {approvalPreview.map((step) => (
                <li key={`${step.stepOrder}-${step.approver.id}`}>
                  <span className="status-pill compact">{step.stepOrder}단계</span>
                  <strong>{step.approver.name}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel-message">
              {approvalPreviewError ? '예상 결재선을 불러오지 못했습니다.' : '예상 결재선이 없습니다.'}
            </p>
          )}
        </section>

        <div className="form-grid">
          <label>
            <span>신청일자 <RequiredMark /></span>
            <input
              aria-label="신청일자"
              type="date"
              value={applicationDate}
              onChange={(event) => setApplicationDate(event.target.value)}
            />
          </label>
          <label>
            신청자
            <input value={auth.user?.name ?? ''} readOnly />
          </label>
          <label>
            <span>영수증 일자 <RequiredMark /></span>
            <input
              aria-label="영수증 일자"
              type="date"
              value={receiptDate}
              onChange={(event) => setReceiptDate(event.target.value)}
            />
          </label>
          <label>
            <span>사용처 <RequiredMark /></span>
            <input
              aria-label="사용처"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              placeholder="예: 문구점"
            />
          </label>
          <label>
            <span>금액 <RequiredMark /></span>
            <input
              aria-label="금액"
              min="1"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        <label className="wide-field">
          <span>신청 내용 <RequiredMark /></span>
          <textarea
            aria-label="신청 내용"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="신청 내용을 입력하세요."
          />
        </label>

        <div className="attachment-field">
          <label className="required-inline-label" htmlFor="receipt-image">영수증 이미지 첨부 <RequiredMark /></label>
          <input
            aria-label="영수증 이미지 첨부"
            key={fileInputKey}
            id="receipt-image"
            accept="image/png,image/jpeg,image/gif,image/webp"
            type="file"
            onChange={handleFileChange}
          />

          {receiptFile ? (
            <div className="attachment-preview">
              <div className="attachment-thumb">
                {previewUrl ? (
                  <img alt={`${receiptFile.name} 미리보기`} src={previewUrl} />
                ) : (
                  <img alt={`${receiptFile.name} 미리보기`} />
                )}
              </div>
              <div>
                <strong>{receiptFile.name}</strong>
                <span>{Math.ceil(receiptFile.size / 1024)}KB</span>
              </div>
              <div className="row-actions">
                <button
                  className="secondary-button"
                  type="button"
                  ref={previewButtonRef}
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye aria-hidden="true" size={16} />
                  첨부 미리보기
                </button>
                <button className="secondary-button danger-button" type="button" onClick={clearFile}>
                  <Trash2 aria-hidden="true" size={16} />
                  첨부 삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileImage aria-hidden="true" size={22} />
              <span>{existingAttachmentCount > 0 ? `기존 첨부 ${existingAttachmentCount}개` : '첨부된 이미지 없음'}</span>
            </div>
          )}
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="form-success" role="status">{message}</p> : null}

        <div className="form-actions">
          <button className="secondary-button" disabled={isSaving} type="button" onClick={handleSaveDraft}>
            <Save aria-hidden="true" size={16} />
            임시저장
          </button>
          <button className="primary-button" disabled={isSaving} type="submit">
            <Send aria-hidden="true" size={16} />
            제출
          </button>
          <button className="secondary-button" disabled={isSaving} type="button" onClick={() => navigate('/applications/my')}>
            <X aria-hidden="true" size={16} />
            취소
          </button>
        </div>
      </form>

      {isPreviewOpen && receiptFile ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="첨부 미리보기"
          onKeyDown={handlePreviewKeyDown}
        >
          <div className="preview-modal">
            <div className="table-toolbar">
              <strong>{receiptFile.name}</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="닫기"
                ref={previewCloseButtonRef}
                onClick={closePreview}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="preview-canvas">
              {previewUrl ? <img alt={`${receiptFile.name} 확대 미리보기`} src={previewUrl} /> : <span>미리보기 없음</span>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
