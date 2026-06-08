import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileImage, Save, Send, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import {
  attachReceiptImage,
  createApplication,
  getApplication,
  getApprovalOrganizations,
  getApprovalPreview,
  submitApplication,
  updateApplication
} from './applicationApi';
import {
  ApplicationResponse,
  ApprovalOrganizationSummary,
  ApprovalPreviewStep,
  canEditApplication
} from './applicationTypes';

const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_RECEIPT_IMAGE_COUNT = 10;
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

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const date = digits.slice(6, 8);

  if (digits.length <= 4) {
    return year;
  }

  if (digits.length <= 6) {
    return `${year}. ${month}`;
  }

  return `${year}. ${month}. ${date}.`;
}

function formatIsoDateInput(value: string) {
  return formatDateInput(value);
}

function toIsoDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) {
    return '';
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const date = Number(digits.slice(6, 8));
  const parsed = new Date(year, month - 1, date);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== date
  ) {
    return '';
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function normalizeAmountInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}

function formatAmountInput(value: string) {
  const digits = normalizeAmountInput(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
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
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [draft, setDraft] = useState<ApplicationResponse | null>(null);
  const [draftPayloadSignature, setDraftPayloadSignature] = useState('');
  const [uploadedFileKeys, setUploadedFileKeys] = useState<string[]>([]);
  const [existingAttachmentCount, setExistingAttachmentCount] = useState(0);
  const [approvalOrganizations, setApprovalOrganizations] = useState<ApprovalOrganizationSummary[]>([]);
  const [approvalOrganizationId, setApprovalOrganizationId] = useState<number | null>(null);
  const [approvalPreview, setApprovalPreview] = useState<ApprovalPreviewStep[]>([]);
  const [approvalPreviewError, setApprovalPreviewError] = useState('');
  const [previewFileIndex, setPreviewFileIndex] = useState<number | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const isComplete = useMemo(() => {
    return Boolean(
      applicationDate
      && toIsoDate(receiptDate)
      && vendor.trim()
      && amount
      && description.trim()
      && (receiptFiles.length > 0 || existingAttachmentCount > 0)
    );
  }, [amount, applicationDate, description, existingAttachmentCount, receiptDate, receiptFiles.length, vendor]);

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
        setReceiptDate(formatIsoDateInput(application.receiptDate));
        setVendor(application.vendor);
        setAmount(String(application.amount));
        setDescription(application.description);
        setExistingAttachmentCount(application.attachments?.length ?? 0);
        setApprovalOrganizationId(application.approvalOrganizationId);
        setDraftPayloadSignature(JSON.stringify({
          approvalTypeId: application.approvalTypeId,
          approvalOrganizationId: application.approvalOrganizationId,
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

    async function loadApprovalOrganizations() {
      try {
        const organizations = await getApprovalOrganizations();
        if (ignore) {
          return;
        }
        setApprovalOrganizations(organizations);
        setApprovalOrganizationId((current) => {
          if (current !== null) {
            return current;
          }

          return (organizations.find((organization) => organization.primary) ?? organizations[0] ?? null)
            ?.id ?? null;
        });
      } catch (requestError) {
        if (!ignore) {
          setApprovalOrganizations([]);
          setApprovalPreview([]);
          setApprovalPreviewError(errorMessage(requestError));
        }
      }
    }

    void loadApprovalOrganizations();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!approvalOrganizationId) {
      setApprovalPreview([]);
      return undefined;
    }

    let ignore = false;
    const selectedApprovalOrganizationId = approvalOrganizationId;

    async function loadApprovalPreview() {
      setApprovalPreviewError('');
      try {
        const steps = await getApprovalPreview(1, selectedApprovalOrganizationId);
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
  }, [approvalOrganizationId]);

  useEffect(() => {
    if (receiptFiles.length === 0 || typeof URL.createObjectURL !== 'function') {
      setPreviewUrls([]);
      return undefined;
    }

    const urls = receiptFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [receiptFiles]);

  useEffect(() => {
    if (previewFileIndex !== null) {
      previewCloseButtonRef.current?.focus();
    }
  }, [previewFileIndex]);

  function buildPayload() {
    return {
      approvalTypeId: 1,
      approvalOrganizationId: approvalOrganizationId ?? 0,
      applicationDate,
      receiptDate: toIsoDate(receiptDate),
      vendor: vendor.trim(),
      amount: Number(amount),
      description: description.trim()
    };
  }

  function closePreview() {
    setPreviewFileIndex(null);
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
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.some((file) => !SUPPORTED_RECEIPT_IMAGE_TYPES.has(file.type))) {
      resetFileInput();
      setError('PNG, JPG, GIF, WebP 이미지만 첨부할 수 있습니다.');
      setMessage('');
      return;
    }

    if (selectedFiles.some((file) => file.size > MAX_RECEIPT_IMAGE_BYTES)) {
      resetFileInput();
      setError('영수증 이미지는 5MB 이하로 첨부해주세요.');
      setMessage('');
      return;
    }

    if (existingAttachmentCount + receiptFiles.length + selectedFiles.length > MAX_RECEIPT_IMAGE_COUNT) {
      resetFileInput();
      setError(`영수증 이미지는 신청서당 최대 ${MAX_RECEIPT_IMAGE_COUNT}개까지 첨부할 수 있습니다.`);
      setMessage('');
      return;
    }

    setReceiptFiles((current) => [...current, ...selectedFiles]);
    resetFileInput();
    setMessage('');
    setError('');
  }

  function resetFileInput() {
    setFileInputKey((value) => value + 1);
  }

  function clearFile(index: number) {
    const removedFileKey = receiptFiles[index] ? fileKey(receiptFiles[index]) : '';
    setReceiptFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setUploadedFileKeys((current) => current.filter((key) => key !== removedFileKey));
    setPreviewFileIndex((current) => (current === index ? null : current));
    resetFileInput();
  }

  function validate() {
    if (!approvalOrganizationId) {
      setError('결재 기준 조직을 선택하면 저장/제출할 수 있습니다.');
      return false;
    }

    if (!isComplete) {
      setError('필수 항목을 입력하면 제출할 수 있습니다.');
      return false;
    }

    if (!toIsoDate(receiptDate)) {
      setError('영수증 일자는 YYYY. MM. DD. 형식으로 입력해주세요.');
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

    const pendingFiles = receiptFiles.filter((file) => !uploadedFileKeys.includes(fileKey(file)));
    for (const file of pendingFiles) {
      await attachReceiptImage(saved.id, file);
    }

    if (pendingFiles.length > 0) {
      setUploadedFileKeys((current) => Array.from(new Set([
        ...current,
        ...pendingFiles.map((file) => fileKey(file))
      ])));
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
                  <span className="approval-preview-step-order">{step.stepOrder}단계</span>
                  <span className="approval-preview-organization">{step.approver.organizationName}</span>
                  <strong>{step.approver.name}</strong>
                  <span className="approval-preview-position">{step.approver.positionName}</span>
                  {step.autoApprovalExpected ? (
                    <span className="approval-preview-auto">자동</span>
                  ) : null}
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
            <span>결재 기준 조직 <RequiredMark /></span>
            <select
              aria-label="결재 기준 조직"
              value={approvalOrganizationId ?? ''}
              onChange={(event) => setApprovalOrganizationId(Number(event.target.value))}
            >
              {approvalOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
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
              inputMode="numeric"
              maxLength={13}
              type="text"
              value={receiptDate}
              onChange={(event) => setReceiptDate(formatDateInput(event.target.value))}
              placeholder="예: 2026. 06. 08."
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
              inputMode="numeric"
              type="text"
              value={formatAmountInput(amount)}
              onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
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

        <div className="attachment-field mobile-attachment-uploader">
          <label className="required-inline-label" htmlFor="receipt-image">영수증 이미지 첨부 <RequiredMark /></label>
          <input
            aria-label="영수증 이미지 첨부"
            key={fileInputKey}
            id="receipt-image"
            accept="image/png,image/jpeg,image/gif,image/webp"
            type="file"
            multiple
            onChange={handleFileChange}
          />

          {receiptFiles.length > 0 ? (
            <div className="attachment-preview-grid">
              {receiptFiles.map((file, index) => (
                <div className="attachment-preview" key={fileKey(file)}>
                  <div className="attachment-thumb">
                    {previewUrls[index] ? (
                      <img alt={`${file.name} 미리보기`} src={previewUrls[index]} />
                    ) : (
                      <img alt={`${file.name} 미리보기`} />
                    )}
                  </div>
                  <div>
                    <strong>{file.name}</strong>
                    <span>{Math.ceil(file.size / 1024)}KB</span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      ref={index === 0 ? previewButtonRef : undefined}
                      onClick={() => setPreviewFileIndex(index)}
                    >
                      <Eye aria-hidden="true" size={16} />
                      첨부 미리보기
                    </button>
                    <button
                      className="secondary-button danger-button"
                      type="button"
                      aria-label={`${file.name} 첨부 삭제`}
                      onClick={() => clearFile(index)}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      첨부 삭제
                    </button>
                  </div>
                </div>
              ))}
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

        <div className="form-actions mobile-sticky-actions">
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

      {previewFileIndex !== null && receiptFiles[previewFileIndex] ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="첨부 미리보기"
          onKeyDown={handlePreviewKeyDown}
        >
          <div className="preview-modal">
            <div className="table-toolbar">
              <strong>{receiptFiles[previewFileIndex].name}</strong>
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
              {previewUrls[previewFileIndex] ? (
                <img
                  alt={`${receiptFiles[previewFileIndex].name} 확대 미리보기`}
                  src={previewUrls[previewFileIndex]}
                />
              ) : <span>미리보기 없음</span>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
