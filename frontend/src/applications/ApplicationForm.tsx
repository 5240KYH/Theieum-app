import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Eye, FileImage, Save, Send, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import { attachReceiptImage, createApplication, submitApplication } from './applicationApi';
import { ApplicationResponse } from './applicationTypes';

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

export function ApplicationForm() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [applicationDate, setApplicationDate] = useState(today);
  const [receiptDate, setReceiptDate] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [draft, setDraft] = useState<ApplicationResponse | null>(null);
  const [attachedDraftId, setAttachedDraftId] = useState<number | null>(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isComplete = useMemo(() => {
    return Boolean(applicationDate && receiptDate && vendor.trim() && amount && description.trim() && receiptFile);
  }, [amount, applicationDate, description, receiptDate, receiptFile, vendor]);

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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
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
    const payload = {
      applicationDate,
      receiptDate,
      vendor: vendor.trim(),
      amount: Number(amount),
      description: description.trim()
    };

    const saved = draft ?? await createApplication(payload);
    setDraft(saved);

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
          <h1 id="page-title">신청서 작성</h1>
        </div>
        <span className="status-pill">{draft ? '임시저장됨' : '작성 중'}</span>
      </div>

      <form className="form-panel application-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            신청일자
            <input
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
            영수증 일자
            <input
              type="date"
              value={receiptDate}
              onChange={(event) => setReceiptDate(event.target.value)}
            />
          </label>
          <label>
            사용처
            <input
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              placeholder="예: 문구점"
            />
          </label>
          <label>
            금액
            <input
              min="1"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        <label className="wide-field">
          신청 내용
          <textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="신청 내용을 입력하세요."
          />
        </label>

        <div className="attachment-field">
          <label htmlFor="receipt-image">영수증 이미지 첨부</label>
          <input
            key={fileInputKey}
            id="receipt-image"
            accept="image/*"
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
                <button className="secondary-button" type="button" onClick={() => setPreviewOpen(true)}>
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
              <span>첨부된 이미지 없음</span>
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="첨부 미리보기">
          <div className="preview-modal">
            <div className="table-toolbar">
              <strong>{receiptFile.name}</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={() => setPreviewOpen(false)}>
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
