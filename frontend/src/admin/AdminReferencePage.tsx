import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Edit3, KeyRound, Plus, Save, Trash2, X } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../shared/api';
import {
  createAdminApprovalLine,
  createAdminApprovalOrgException,
  createAdminOrganization,
  createAdminPosition,
  createAdminUser,
  deleteAdminApprovalLine,
  deleteAdminApprovalOrgException,
  deleteAdminOrganization,
  deleteAdminPosition,
  deleteAdminUser,
  getAdminApprovalLines,
  getAdminApprovalOrgExceptions,
  getAdminOrganizations,
  getAdminPositions,
  getAdminUsers,
  updateAdminApprovalLine,
  updateAdminApprovalOrgException,
  updateAdminOrganization,
  updateAdminPosition,
  updateAdminUser,
  updateAdminUserPassword
} from './adminApi';
import {
  AdminApprovalLine,
  AdminApprovalOrgException,
  AdminOrganization,
  AdminPosition,
  AdminUser
} from './adminTypes';

type AdminReferenceKind = 'users' | 'organizations' | 'positions' | 'approvalLines' | 'approvalOrgExceptions';
type ReferenceItem = AdminUser | AdminOrganization | AdminPosition | AdminApprovalLine | AdminApprovalOrgException;
type DraftValue = string | boolean;
type Draft = Record<string, DraftValue>;

interface AdminReferencePageProps {
  kind: AdminReferenceKind;
}

interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'password' | 'textarea';
  createOnly?: boolean;
}

interface PageConfig {
  title: string;
  description: string;
  headers: string[];
  fields: FieldConfig[];
  load: () => Promise<ReferenceItem[]>;
  create: (payload: unknown) => Promise<ReferenceItem>;
  update: (id: number, payload: unknown) => Promise<ReferenceItem>;
  remove: (id: number) => Promise<void>;
}

const STEP_TEMPLATE = '1,DIRECT_USER,,,2,POSITION_ORDER';

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '관리 데이터를 처리하지 못했습니다.';
}

function configs(): Record<AdminReferenceKind, PageConfig> {
  return {
    users: {
      title: '사용자 관리',
      description: '계정, 조직, 직위, 역할과 활성 상태를 확인합니다.',
      load: getAdminUsers as () => Promise<ReferenceItem[]>,
      create: createAdminUser as (payload: unknown) => Promise<ReferenceItem>,
      update: updateAdminUser as (id: number, payload: unknown) => Promise<ReferenceItem>,
      remove: deleteAdminUser,
      headers: ['ID', '아이디', '이름', '이메일', '조직', '직위', '역할', '상태', '관리'],
      fields: [
        { key: 'loginId', label: '아이디' },
        { key: 'password', label: '초기 비밀번호', type: 'password', createOnly: true },
        { key: 'name', label: '이름' },
        { key: 'email', label: '이메일' },
        { key: 'organizationId', label: '조직 ID', type: 'number' },
        { key: 'positionId', label: '직위 ID', type: 'number' },
        { key: 'roles', label: '역할' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    },
    organizations: {
      title: '조직 관리',
      description: '상위 조직, 레벨, 정렬 순서와 활성 상태를 트리로 확인합니다.',
      load: getAdminOrganizations as () => Promise<ReferenceItem[]>,
      create: createAdminOrganization as (payload: unknown) => Promise<ReferenceItem>,
      update: updateAdminOrganization as (id: number, payload: unknown) => Promise<ReferenceItem>,
      remove: deleteAdminOrganization,
      headers: ['ID', '조직명', '상위조직', '레벨', '정렬', '상태', '관리'],
      fields: [
        { key: 'name', label: '조직명' },
        { key: 'parentId', label: '상위 조직 ID', type: 'number' },
        { key: 'levelNo', label: '레벨', type: 'number' },
        { key: 'sortOrder', label: '정렬', type: 'number' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    },
    positions: {
      title: '직위 관리',
      description: '결재선 산정에 사용하는 직위 순서와 활성 상태를 관리합니다.',
      load: getAdminPositions as () => Promise<ReferenceItem[]>,
      create: createAdminPosition as (payload: unknown) => Promise<ReferenceItem>,
      update: updateAdminPosition as (id: number, payload: unknown) => Promise<ReferenceItem>,
      remove: deleteAdminPosition,
      headers: ['ID', '직위명', '직위 순서', '정렬', '상태', '관리'],
      fields: [
        { key: 'name', label: '직위명' },
        { key: 'rankOrder', label: '직위 순서', type: 'number' },
        { key: 'sortOrder', label: '정렬', type: 'number' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    },
    approvalLines: {
      title: '결재선 관리',
      description: '전자결재 유형별 결재 단계, 조직/직위 기준과 직접 대상자를 관리합니다.',
      load: getAdminApprovalLines as () => Promise<ReferenceItem[]>,
      create: createAdminApprovalLine as (payload: unknown) => Promise<ReferenceItem>,
      update: updateAdminApprovalLine as (id: number, payload: unknown) => Promise<ReferenceItem>,
      remove: deleteAdminApprovalLine,
      headers: ['ID', '결재선명', '결재 유형', '단계', '상태', '관리'],
      fields: [
        { key: 'approvalTypeId', label: '결재 유형 ID', type: 'number' },
        { key: 'name', label: '결재선명' },
        { key: 'stepsText', label: '단계', type: 'textarea' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    },
    approvalOrgExceptions: {
      title: '조직별 예외 결재자 관리',
      description: '조직 단위로 기본 결재선 대신 적용할 예외 결재자를 관리합니다.',
      load: getAdminApprovalOrgExceptions as () => Promise<ReferenceItem[]>,
      create: createAdminApprovalOrgException as (payload: unknown) => Promise<ReferenceItem>,
      update: updateAdminApprovalOrgException as (id: number, payload: unknown) => Promise<ReferenceItem>,
      remove: deleteAdminApprovalOrgException,
      headers: ['ID', '결재 유형', '조직', '예외 결재자', '단계', '상태', '관리'],
      fields: [
        { key: 'approvalTypeId', label: '결재 유형 ID', type: 'number' },
        { key: 'organizationId', label: '조직 ID', type: 'number' },
        { key: 'approverUserId', label: '예외 결재자 ID', type: 'number' },
        { key: 'stepOrder', label: '단계', type: 'number' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    }
  };
}

function itemId(item: ReferenceItem) {
  return item.id;
}

function isActive(item: ReferenceItem) {
  return 'active' in item ? item.active : true;
}

function initialDraft(kind: AdminReferenceKind, item?: ReferenceItem): Draft {
  if (!item) {
    return {
      active: true,
      approvalTypeId: '1',
      roles: 'APPLICANT',
      stepsText: STEP_TEMPLATE
    };
  }

  if (kind === 'users') {
    const user = item as AdminUser;
    return {
      loginId: user.login_id,
      name: user.name,
      email: user.email,
      organizationId: String(user.organization_id),
      positionId: String(user.position_id),
      roles: user.roles,
      active: user.active
    };
  }

  if (kind === 'organizations') {
    const organization = item as AdminOrganization;
    return {
      name: organization.name,
      parentId: organization.parent_id ? String(organization.parent_id) : '',
      levelNo: String(organization.level_no),
      sortOrder: String(organization.sort_order),
      active: organization.active
    };
  }

  if (kind === 'positions') {
    const position = item as AdminPosition;
    return {
      name: position.name,
      rankOrder: String(position.rank_order),
      sortOrder: String(position.sort_order),
      active: position.active
    };
  }

  if (kind === 'approvalLines') {
    const line = item as AdminApprovalLine;
    return {
      approvalTypeId: String(line.approvalTypeId),
      name: line.name,
      stepsText: line.steps.map((step) => [
        step.stepOrder,
        step.stepType,
        step.organizationScope ?? '',
        step.positionId ?? '',
        step.directUserId ?? '',
        step.sortPolicy
      ].join(',')).join('\n'),
      active: line.active
    };
  }

  const exception = item as AdminApprovalOrgException;
  return {
    approvalTypeId: String(exception.approvalTypeId),
    organizationId: String(exception.organizationId),
    approverUserId: String(exception.approverUserId),
    stepOrder: String(exception.stepOrder),
    active: exception.active
  };
}

function optionalNumber(value: DraftValue | undefined) {
  if (value === undefined || value === '') {
    return null;
  }
  return Number(value);
}

function requiredNumber(value: DraftValue | undefined) {
  return Number(value);
}

function buildPayload(kind: AdminReferenceKind, draft: Draft, isCreating: boolean) {
  if (kind === 'users') {
    return {
      loginId: String(draft.loginId ?? ''),
      ...(isCreating ? { password: String(draft.password ?? '') } : {}),
      name: String(draft.name ?? ''),
      email: String(draft.email ?? ''),
      organizationId: requiredNumber(draft.organizationId),
      positionId: requiredNumber(draft.positionId),
      roles: String(draft.roles ?? 'APPLICANT'),
      active: Boolean(draft.active)
    };
  }

  if (kind === 'organizations') {
    return {
      name: String(draft.name ?? ''),
      parentId: optionalNumber(draft.parentId),
      levelNo: optionalNumber(draft.levelNo),
      sortOrder: optionalNumber(draft.sortOrder),
      active: Boolean(draft.active)
    };
  }

  if (kind === 'positions') {
    return {
      name: String(draft.name ?? ''),
      rankOrder: requiredNumber(draft.rankOrder),
      sortOrder: requiredNumber(draft.sortOrder),
      active: Boolean(draft.active)
    };
  }

  if (kind === 'approvalLines') {
    return {
      approvalTypeId: requiredNumber(draft.approvalTypeId),
      name: String(draft.name ?? ''),
      active: Boolean(draft.active),
      steps: String(draft.stepsText ?? STEP_TEMPLATE).split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [stepOrder, stepType, organizationScope, positionId, directUserId, sortPolicy] = line.split(',');
          return {
            stepOrder: Number(stepOrder),
            stepType,
            organizationScope: organizationScope || null,
            positionId: positionId ? Number(positionId) : null,
            directUserId: directUserId ? Number(directUserId) : null,
            sortPolicy: sortPolicy || 'POSITION_ORDER'
          };
        })
    };
  }

  return {
    approvalTypeId: requiredNumber(draft.approvalTypeId),
    organizationId: requiredNumber(draft.organizationId),
    approverUserId: requiredNumber(draft.approverUserId),
    stepOrder: requiredNumber(draft.stepOrder),
    active: Boolean(draft.active)
  };
}

function sortOrganizations(items: ReferenceItem[]) {
  const organizations = items as AdminOrganization[];
  const children = new Map<number | null, AdminOrganization[]>();
  organizations.forEach((organization) => {
    const key = organization.parent_id ?? null;
    children.set(key, [...(children.get(key) ?? []), organization]);
  });
  children.forEach((group) => group.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
  const sorted: AdminOrganization[] = [];
  function visit(parentId: number | null) {
    (children.get(parentId) ?? []).forEach((organization) => {
      sorted.push(organization);
      visit(organization.id);
    });
  }
  visit(null);
  return sorted;
}

export function AdminReferencePage({ kind }: AdminReferencePageProps) {
  const auth = useAuth();
  const isAdmin = auth.hasRole('ADMIN');
  const canManage = isAdmin || auth.hasRole('MANAGER');
  const canMutate = canManage && (kind !== 'users' || isAdmin);
  const config = useMemo(() => configs()[kind], [kind]);
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(
    targetConfig = config,
    targetKind = kind,
    shouldApply: () => boolean = () => true
  ) {
    setLoading(true);
    setError('');

    try {
      const data = await targetConfig.load();
      if (!shouldApply()) {
        return;
      }
      setItems(targetKind === 'organizations' ? sortOrganizations(data) : data);
    } catch (requestError) {
      if (shouldApply()) {
        setError(errorMessage(requestError));
      }
    } finally {
      if (shouldApply()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let ignore = false;
    setItems([]);
    setCreating(false);
    setEditingId(null);
    setDraft({});
    setPasswordTarget(null);
    setPassword('');
    setMessage('');
    void load(config, kind, () => !ignore);

    return () => {
      ignore = true;
    };
  }, [config, kind]);

  function updateDraftValue(key: string, value: DraftValue) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setDraft(initialDraft(kind));
    setMessage('');
    setError('');
  }

  function startEdit(item: ReferenceItem) {
    setCreating(false);
    setEditingId(itemId(item));
    setDraft(initialDraft(kind, item));
    setMessage('');
    setError('');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = buildPayload(kind, draft, isCreating);
      if (isCreating) {
        await config.create(payload);
      } else if (editingId != null) {
        await config.update(editingId, payload);
      }
      setCreating(false);
      setEditingId(null);
      setDraft({});
      setMessage('저장되었습니다.');
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function handleDelete(item: ReferenceItem) {
    setError('');
    setMessage('');

    try {
      await config.remove(itemId(item));
      setMessage('삭제되었습니다.');
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) {
      return;
    }
    setError('');
    setMessage('');

    try {
      await updateAdminUserPassword(passwordTarget.id, password);
      setPasswordTarget(null);
      setPassword('');
      setMessage('비밀번호가 변경되었습니다.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const visibleItems = kind === 'organizations' ? sortOrganizations(items) : items;
  const isEditing = isCreating || editingId !== null;

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">관리</p>
          <h1 id="page-title">{config.title}</h1>
          <p className="muted-copy">{config.description}</p>
        </div>
        <div className="row-actions">
          <span className="status-pill">{items.length}건</span>
          {canMutate ? (
            <button className="primary-button" type="button" onClick={startCreate}>
              <Plus aria-hidden="true" size={16} />
              새 항목
            </button>
          ) : null}
        </div>
      </div>

      {canMutate && isEditing ? (
        <form className="form-panel admin-edit-panel" onSubmit={handleSave}>
          <div className="table-toolbar borderless-panel">
            <strong>{isCreating ? '새 항목 입력' : '항목 수정'}</strong>
            <button
              className="icon-button"
              type="button"
              aria-label="편집 취소"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDraft({});
              }}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="form-grid">
            {config.fields
              .filter((field) => isCreating || !field.createOnly)
              .map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(draft[field.key])}
                      onChange={(event) => updateDraftValue(field.key, event.target.checked)}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      value={String(draft[field.key] ?? '')}
                      onChange={(event) => updateDraftValue(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      value={String(draft[field.key] ?? '')}
                      onChange={(event) => updateDraftValue(field.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
          </div>
          <p className="muted-copy">결재선 단계는 순서,유형,조직범위,직위ID,사용자ID,정렬정책 형식으로 한 줄씩 입력합니다.</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setDraft(initialDraft(kind))}>초기화</button>
            <button className="primary-button" type="submit">
              <Save aria-hidden="true" size={16} />
              저장
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}

      <div className="table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {config.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={itemId(item)}>
                  {renderCells(kind, item)}
                  <td>
                    {canMutate ? (
                      <div className="row-actions">
                        <button className="secondary-button" type="button" onClick={() => startEdit(item)}>
                          <Edit3 aria-hidden="true" size={16} />
                          수정
                        </button>
                        {kind === 'users' && isAdmin ? (
                          <button className="secondary-button" type="button" onClick={() => setPasswordTarget(item as AdminUser)}>
                            <KeyRound aria-hidden="true" size={16} />
                            비밀번호 변경
                          </button>
                        ) : null}
                        <button className="secondary-button danger-button" type="button" onClick={() => void handleDelete(item)}>
                          <Trash2 aria-hidden="true" size={16} />
                          삭제
                        </button>
                      </div>
                    ) : (
                      <span className="muted-copy">읽기 전용</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={config.headers.length}>조회된 데이터가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {passwordTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-password-title">
          <form className="preview-modal compact-modal form-panel" onSubmit={handlePasswordSubmit}>
            <div className="table-toolbar borderless-panel">
              <strong id="admin-password-title">{passwordTarget.name} 비밀번호 변경</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={() => setPasswordTarget(null)}>×</button>
            </div>
            <label>
              새 비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setPasswordTarget(null)}>취소</button>
              <button className="primary-button" type="submit">변경 저장</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function statusText(active: boolean) {
  return active ? '활성' : '비활성';
}

function renderCells(kind: AdminReferenceKind, item: ReferenceItem): ReactNode {
  if (kind === 'users') {
    const user = item as AdminUser;
    return (
      <>
        <td>#{user.id}</td>
        <td>{user.login_id}</td>
        <td>{user.name}</td>
        <td>{user.email}</td>
        <td>{user.organization_name ?? `#${user.organization_id}`}</td>
        <td>{user.position_name ?? `#${user.position_id}`}</td>
        <td>{user.roles}</td>
        <td>{statusText(user.active)}</td>
      </>
    );
  }

  if (kind === 'organizations') {
    const organization = item as AdminOrganization;
    return (
      <>
        <td>#{organization.id}</td>
        <td>
          <span className="tree-cell" style={{ paddingLeft: `${Math.max(0, organization.level_no - 1) * 18}px` }}>
            <span className="status-pill compact">L{organization.level_no}</span>
            {organization.name}
          </span>
        </td>
        <td>{organization.parent_id ? `#${organization.parent_id}` : '-'}</td>
        <td>{organization.level_no}</td>
        <td>{organization.sort_order}</td>
        <td>{statusText(organization.active)}</td>
      </>
    );
  }

  if (kind === 'positions') {
    const position = item as AdminPosition;
    return (
      <>
        <td>#{position.id}</td>
        <td>{position.name}</td>
        <td>{position.rank_order}</td>
        <td>{position.sort_order}</td>
        <td>{statusText(position.active)}</td>
      </>
    );
  }

  if (kind === 'approvalLines') {
    const line = item as AdminApprovalLine;
    return (
      <>
        <td>#{line.id}</td>
        <td>{line.name}</td>
        <td>#{line.approvalTypeId}</td>
        <td className="wrap-cell">
          {(line.steps ?? []).map((step) => `${step.stepOrder}. ${step.stepType}`).join(' / ')}
        </td>
        <td>{statusText(line.active)}</td>
      </>
    );
  }

  const exception = item as AdminApprovalOrgException;
  return (
    <>
      <td>#{exception.id}</td>
      <td>#{exception.approvalTypeId}</td>
      <td>{exception.organizationName}</td>
      <td>{exception.approverName}</td>
      <td>{exception.stepOrder}</td>
      <td>{statusText(exception.active)}</td>
    </>
  );
}
