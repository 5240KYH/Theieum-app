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
  getAdminApprovalTypes,
  getAdminOrganizations,
  getAdminPositions,
  getAdminUsers,
  hardDeleteAdminApprovalLine,
  hardDeleteAdminApprovalOrgException,
  hardDeleteAdminOrganization,
  hardDeleteAdminPosition,
  hardDeleteAdminUser,
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
  AdminApprovalType,
  AdminOrganization,
  AdminPosition,
  AdminUser
} from './adminTypes';

type AdminReferenceKind = 'users' | 'organizations' | 'positions' | 'approvalLines' | 'approvalOrgExceptions';
type ReferenceItem = AdminUser | AdminOrganization | AdminPosition | AdminApprovalLine | AdminApprovalOrgException;
interface UserOrganizationMembershipDraft {
  organizationId: string;
  organizationName?: string;
  positionId: string;
  positionName?: string;
  primary: boolean;
  active: boolean;
  sortOrder: string;
}

type DraftValue = string | boolean | UserOrganizationMembershipDraft[];
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
  hardRemove: (id: number) => Promise<void>;
}

const STEP_TEMPLATE = '1,DIRECT_USER,,,2,POSITION_ORDER';
const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'APPROVER', 'APPLICANT'];
const STEP_TYPE_OPTIONS = [
  { value: 'DIRECT_USER', label: '직접 사용자' },
  { value: 'ORG_POSITION', label: '조직/직위' },
  { value: 'ORG_LEADER', label: '조직장' }
];
const ORGANIZATION_SCOPE_OPTIONS = [
  { value: 'APPLICANT_ORG', label: '요청자 부서' },
  { value: 'PARENT_ORG', label: '상위 조직' },
  { value: 'ROOT_ORG', label: '최상위 조직' }
];

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '관리 데이터를 처리하지 못했습니다.';
}

function RequiredMark() {
  return <span className="required-mark" aria-hidden="true">*</span>;
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
      hardRemove: hardDeleteAdminUser,
      headers: ['ID', '아이디', '이름', '이메일', '조직', '직위', '역할', '상태', '관리'],
      fields: [
        { key: 'loginId', label: '아이디' },
        { key: 'password', label: '초기 비밀번호', type: 'password', createOnly: true },
        { key: 'name', label: '이름' },
        { key: 'email', label: '이메일' },
        { key: 'organizationId', label: '조직', type: 'number' },
        { key: 'positionId', label: '직위', type: 'number' },
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
      hardRemove: hardDeleteAdminOrganization,
      headers: ['ID', '조직명', '상위조직', '레벨', '정렬', '조직장', '상태', '관리'],
      fields: [
        { key: 'name', label: '조직명' },
        { key: 'parentId', label: '상위 조직 ID', type: 'number' },
        { key: 'levelNo', label: '레벨', type: 'number' },
        { key: 'sortOrder', label: '정렬', type: 'number' },
        { key: 'leaderUserId', label: '조직장' },
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
      hardRemove: hardDeleteAdminPosition,
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
      hardRemove: hardDeleteAdminApprovalLine,
      headers: ['ID', '결재선명', '결재 유형', '단계', '상태', '관리'],
      fields: [
        { key: 'approvalTypeId', label: '결재 유형', type: 'number' },
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
      hardRemove: hardDeleteAdminApprovalOrgException,
      headers: ['ID', '결재 유형', '조직', '예외 결재자', '단계', '상태', '관리'],
      fields: [
        { key: 'approvalTypeId', label: '결재 유형', type: 'number' },
        { key: 'organizationId', label: '조직', type: 'number' },
        { key: 'approverUserId', label: '예외 결재자', type: 'number' },
        { key: 'stepOrder', label: '단계', type: 'number' },
        { key: 'active', label: '활성', type: 'checkbox' }
      ]
    }
  };
}

function itemId(item: ReferenceItem) {
  return item.id;
}

function itemDisplayName(kind: AdminReferenceKind, item: ReferenceItem) {
  if (kind === 'users') {
    const user = item as AdminUser;
    return `${user.name} (${user.login_id})`;
  }
  if (kind === 'approvalOrgExceptions') {
    const exception = item as AdminApprovalOrgException;
    return `${exception.organizationName} / ${exception.approverName}`;
  }
  return 'name' in item ? item.name : `#${item.id}`;
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
      organizationMemberships: normalizeUserMemberships(user),
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
      leaderUserId: organization.leader_user_id ? String(organization.leader_user_id) : '',
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

function selectedRoles(value: DraftValue | undefined) {
  return String(value ?? '')
    .split(',')
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean);
}

function updateRoleValue(value: DraftValue | undefined, role: string, checked: boolean) {
  const current = new Set(selectedRoles(value));
  if (checked) {
    current.add(role);
  } else {
    current.delete(role);
  }

  return ROLE_OPTIONS.filter((option) => current.has(option)).join(',');
}

function normalizeOrganizationScope(value: string | undefined) {
  if (!value || value === 'REQUESTER_DEPARTMENT') {
    return 'APPLICANT_ORG';
  }
  if (value === 'ROOT') {
    return 'ROOT_ORG';
  }

  return value;
}

interface EditableApprovalLineStep {
  stepOrder: string;
  stepType: string;
  organizationScope: string;
  positionId: string;
  directUserId: string;
  sortPolicy: string;
}

function parseApprovalLineSteps(value: DraftValue | undefined): EditableApprovalLineStep[] {
  const lines = String(value ?? STEP_TEMPLATE).split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (lines.length > 0 ? lines : [STEP_TEMPLATE]).map((line, index) => {
    const [stepOrder, stepType, organizationScope, positionId, directUserId, sortPolicy] = line.split(',');
    return {
      stepOrder: stepOrder || String(index + 1),
      stepType: stepType || 'DIRECT_USER',
      organizationScope: normalizeOrganizationScope(organizationScope),
      positionId: positionId ?? '',
      directUserId: directUserId ?? '',
      sortPolicy: sortPolicy || 'POSITION_ORDER'
    };
  });
}

function serializeApprovalLineSteps(steps: EditableApprovalLineStep[]) {
  return steps.map((step, index) => {
    const stepType = step.stepType || 'DIRECT_USER';
    const usesOrganizationScope = stepType === 'ORG_POSITION' || stepType === 'ORG_LEADER';
    return [
      step.stepOrder || String(index + 1),
      stepType,
      usesOrganizationScope ? step.organizationScope || 'APPLICANT_ORG' : '',
      stepType === 'ORG_POSITION' ? step.positionId : '',
      stepType === 'DIRECT_USER' ? step.directUserId : '',
      'POSITION_ORDER'
    ].join(',');
  }).join('\n');
}

function userOrganizationMembershipDrafts(value: DraftValue | undefined): UserOrganizationMembershipDraft[] {
  return Array.isArray(value) ? value : [];
}

function membershipOrganizationName(
  membership: Pick<UserOrganizationMembershipDraft, 'organizationId' | 'organizationName'>,
  organizations: AdminOrganization[]
) {
  return membership.organizationName
    ?? organizations.find((organization) => String(organization.id) === membership.organizationId)?.name
    ?? `#${membership.organizationId}`;
}

function normalizePrimaryMembership(memberships: UserOrganizationMembershipDraft[]) {
  const primaryIndex = memberships.findIndex((membership) => membership.primary);
  return memberships.map((membership, index) => ({
    ...membership,
    primary: primaryIndex >= 0 ? index === primaryIndex : index === 0
  }));
}

function fallbackMembership(
  organizationId: string,
  organizationName?: string,
  positionId = '',
  positionName?: string
): UserOrganizationMembershipDraft {
  return {
    organizationId,
    organizationName,
    positionId,
    positionName,
    primary: true,
    active: true,
    sortOrder: '10'
  };
}

function normalizeUserMemberships(user: AdminUser): UserOrganizationMembershipDraft[] {
  const memberships = user.organizationMemberships ?? [];
  if (memberships.length > 0) {
    return normalizePrimaryMembership(
      memberships
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.organizationId - b.organizationId)
        .map((membership) => ({
          organizationId: String(membership.organizationId),
          organizationName: membership.organizationName,
          positionId: String(membership.positionId ?? user.position_id),
          positionName: membership.positionName ?? user.position_name,
          primary: membership.primary,
          active: membership.active,
          sortOrder: String(membership.sortOrder)
        }))
    );
  }

  return [
    fallbackMembership(
      String(user.organization_id),
      user.organization_name,
      String(user.position_id),
      user.position_name
    )
  ];
}

function primaryOrganizationId(memberships: UserOrganizationMembershipDraft[], fallbackOrganizationId: DraftValue | undefined) {
  return memberships.find((membership) => membership.primary)?.organizationId
    ?? memberships[0]?.organizationId
    ?? String(fallbackOrganizationId ?? '');
}

function primaryPositionId(memberships: UserOrganizationMembershipDraft[], fallbackPositionId: DraftValue | undefined) {
  return memberships.find((membership) => membership.primary)?.positionId
    ?? memberships[0]?.positionId
    ?? String(fallbackPositionId ?? '');
}

function serializeUserMemberships(memberships: UserOrganizationMembershipDraft[]) {
  return normalizePrimaryMembership(memberships)
    .filter((membership) => membership.organizationId && membership.positionId)
    .map((membership, index) => ({
      organizationId: Number(membership.organizationId),
      positionId: Number(membership.positionId),
      primary: membership.primary,
      active: membership.active,
      sortOrder: Number(membership.sortOrder || (index + 1) * 10)
    }));
}

function userMembershipSummary(user: AdminUser) {
  return normalizeUserMemberships(user)
    .map((membership) => {
      const organizationName = membership.organizationName ?? `#${membership.organizationId}`;
      const positionName = membership.positionName ?? `#${membership.positionId}`;
      const membershipName = `${organizationName} / ${positionName}`;
      if (membership.primary) {
        return membershipName;
      }
      return `겸직 : ${membershipName}(${membership.active ? '활성' : '비활성'})`;
    });
}

function isRequiredField(field: FieldConfig) {
  return field.type !== 'checkbox' && field.key !== 'parentId' && field.key !== 'leaderUserId';
}

function buildPayload(kind: AdminReferenceKind, draft: Draft, isCreating: boolean) {
  if (kind === 'users') {
    const memberships = userOrganizationMembershipDrafts(draft.organizationMemberships);
    const organizationMemberships = serializeUserMemberships(memberships);
    return {
      loginId: String(draft.loginId ?? ''),
      ...(isCreating ? { password: String(draft.password ?? '') } : {}),
      name: String(draft.name ?? ''),
      email: String(draft.email ?? ''),
      organizationId: requiredNumber(primaryOrganizationId(memberships, draft.organizationId)),
      organizationMemberships,
      positionId: requiredNumber(primaryPositionId(memberships, draft.positionId)),
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
      leaderUserId: optionalNumber(draft.leaderUserId),
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

function activeOrganizations(organizations: AdminOrganization[]) {
  return sortOrganizations(organizations).filter((organization) => organization.active);
}

function activePositions(positions: AdminPosition[]) {
  return positions
    .filter((position) => position.active)
    .sort((a, b) => a.rank_order - b.rank_order || a.sort_order - b.sort_order || a.id - b.id);
}

function activeUsers(users: AdminUser[]) {
  return users
    .filter((user) => user.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id - b.id);
}

function activeApprovalTypes(approvalTypes: AdminApprovalType[]) {
  return approvalTypes.filter((approvalType) => approvalType.active).sort((a, b) => a.id - b.id);
}

function firstId(items: Array<{ id: number }>) {
  return items[0] ? String(items[0].id) : '';
}

function userOptionLabel(user: AdminUser) {
  return `#${user.id} ${user.name}`;
}

function organizationLeaderOptions(users: AdminUser[], organizationId: string) {
  return users.filter((user) => (
    String(user.organization_id) === organizationId
      || (user.organizationMemberships ?? []).some((membership) => (
        String(membership.organizationId) === organizationId && membership.active
      ))
  ));
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
  const [approvalTypes, setApprovalTypes] = useState<AdminApprovalType[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [selectableUsers, setSelectableUsers] = useState<AdminUser[]>([]);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<ReferenceItem | null>(null);
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [isHardDeleting, setHardDeleting] = useState(false);
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

  async function loadSelectOptions(
    targetKind = kind,
    shouldApply: () => boolean = () => true
  ) {
    if (targetKind !== 'users'
      && targetKind !== 'organizations'
      && targetKind !== 'approvalLines'
      && targetKind !== 'approvalOrgExceptions') {
      setApprovalTypes([]);
      setOrganizations([]);
      setPositions([]);
      setSelectableUsers([]);
      return;
    }

    try {
      const [approvalTypeData, organizationData, positionData, userData] = await Promise.all([
        targetKind === 'approvalLines' || targetKind === 'approvalOrgExceptions'
          ? getAdminApprovalTypes()
          : Promise.resolve([]),
        targetKind === 'users' || targetKind === 'approvalOrgExceptions'
          ? getAdminOrganizations()
          : Promise.resolve([]),
        targetKind === 'users' || targetKind === 'approvalLines'
          ? getAdminPositions()
          : Promise.resolve([]),
        targetKind === 'organizations' || targetKind === 'approvalLines' || targetKind === 'approvalOrgExceptions'
          ? getAdminUsers()
          : Promise.resolve([])
      ]);
      if (!shouldApply()) {
        return;
      }

      setApprovalTypes(activeApprovalTypes(approvalTypeData));
      setOrganizations(activeOrganizations(organizationData));
      setPositions(activePositions(positionData));
      setSelectableUsers(activeUsers(userData));
    } catch (requestError) {
      if (shouldApply()) {
        setError(errorMessage(requestError));
      }
    }
  }

  function applyDefaultSelectValues(current: Draft) {
    if (kind === 'users') {
      const organizationId = String(current.organizationId || firstId(organizations));
      const positionId = String(current.positionId || firstId(positions));
      const organizationMemberships = userOrganizationMembershipDrafts(current.organizationMemberships)
        .map((membership) => ({
          ...membership,
          positionId: membership.positionId || positionId,
          positionName: membership.positionName
            ?? positions.find((position) => String(position.id) === (membership.positionId || positionId))?.name
        }));
      return {
        ...current,
        organizationId,
        organizationMemberships: organizationMemberships.length > 0
          ? organizationMemberships
          : organizationId
            ? [fallbackMembership(
              organizationId,
              organizations.find((organization) => String(organization.id) === organizationId)?.name,
              positionId,
              positions.find((position) => String(position.id) === positionId)?.name
            )]
            : [],
        positionId
      };
    }

    if (kind === 'approvalLines') {
      return {
        ...current,
        approvalTypeId: current.approvalTypeId || firstId(approvalTypes)
      };
    }

    if (kind === 'approvalOrgExceptions') {
      return {
        ...current,
        approvalTypeId: current.approvalTypeId || firstId(approvalTypes),
        organizationId: current.organizationId || firstId(organizations),
        approverUserId: current.approverUserId || firstId(selectableUsers)
      };
    }

    return current;
  }

  function createDraft() {
    return applyDefaultSelectValues(initialDraft(kind));
  }

  useEffect(() => {
    let ignore = false;
    setItems([]);
    setCreating(false);
    setEditingId(null);
    setDraft({});
    setPasswordTarget(null);
    setHardDeleteTarget(null);
    setHardDeleteError('');
    setPassword('');
    setMessage('');
    void load(config, kind, () => !ignore);
    void loadSelectOptions(kind, () => !ignore);

    return () => {
      ignore = true;
    };
  }, [config, kind]);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    setDraft((current) => applyDefaultSelectValues(current));
  }, [approvalTypes, isCreating, kind, organizations, positions, selectableUsers]);

  function updateDraftValue(key: string, value: DraftValue) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setDraft(createDraft());
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

  function openHardDelete(item: ReferenceItem) {
    setHardDeleteTarget(item);
    setHardDeleteError('');
    setMessage('');
    setError('');
  }

  function closeHardDelete() {
    if (isHardDeleting) {
      return;
    }
    setHardDeleteTarget(null);
    setHardDeleteError('');
  }

  async function handleHardDelete() {
    if (!hardDeleteTarget) {
      return;
    }

    setHardDeleting(true);
    setHardDeleteError('');
    setError('');
    setMessage('');

    try {
      await config.hardRemove(itemId(hardDeleteTarget));
      setHardDeleteTarget(null);
      setMessage('완전 삭제되었습니다.');
      await load();
    } catch (requestError) {
      setHardDeleteError(errorMessage(requestError));
    } finally {
      setHardDeleting(false);
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
    <section className="page-section admin-reference-page" aria-labelledby="page-title">
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

      {kind === 'approvalLines' ? (
        <section className="admin-guide-panel" aria-labelledby="approval-line-guide-title">
          <h2 id="approval-line-guide-title">결재선 설정 안내</h2>
          <p>
            신청서 유형별로 활성 결재선은 하나만 사용합니다. 결재 유형은 신청서 이름으로 선택하고,
            단계는 위에서부터 순서대로 진행됩니다.
          </p>
          <p className="muted-copy">
            직접 사용자는 특정 사용자를 바로 지정합니다. 조직/직위는 요청자 부서, 상위 조직,
            최상위 조직 중 하나를 고른 뒤 직위를 선택해 해당 조직의 그 직위 사용자를 결재자로 산정합니다.
            상위 조직이 없는 최상위 조직 사용자는 본인 조직을 기준으로 처리됩니다.
          </p>
        </section>
      ) : null}

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
              .map((field) => {
                const label = <span>{field.label} {isRequiredField(field) ? <RequiredMark /> : null}</span>;
                if ((kind === 'approvalLines' || kind === 'approvalOrgExceptions') && field.key === 'approvalTypeId') {
                  return (
                    <SelectField
                      key={field.key}
                      label={field.label}
                      required={isRequiredField(field)}
                      value={String(draft.approvalTypeId ?? '')}
                      options={approvalTypes.map((approvalType) => ({
                        value: String(approvalType.id),
                        label: approvalType.name
                      }))}
                      onChange={(value) => updateDraftValue('approvalTypeId', value)}
                    />
                  );
                }
                if (kind === 'users' && field.key === 'roles') {
                  return (
                    <div className="admin-field" key={field.key}>
                      {label}
                      <RoleCheckboxGroup
                        value={String(draft.roles ?? '')}
                        onChange={(role, checked) => updateDraftValue('roles', updateRoleValue(draft.roles, role, checked))}
                      />
                    </div>
                  );
                }
                if (kind === 'users' && field.key === 'organizationId') {
                  return (
                    <div className="admin-field wide-admin-field" key={field.key}>
                      <span>{field.label} {isRequiredField(field) ? <RequiredMark /> : null}</span>
                      <UserOrganizationMembershipEditor
                        organizations={organizations}
                        positions={positions}
                        value={userOrganizationMembershipDrafts(draft.organizationMemberships)}
                        onChange={(organizationMemberships) => {
                          updateDraftValue('organizationMemberships', organizationMemberships);
                          updateDraftValue('organizationId', primaryOrganizationId(organizationMemberships, draft.organizationId));
                          updateDraftValue('positionId', primaryPositionId(organizationMemberships, draft.positionId));
                        }}
                      />
                    </div>
                  );
                }
                if (kind === 'users' && field.key === 'positionId') {
                  return null;
                }
                if (kind === 'organizations' && field.key === 'leaderUserId') {
                  const organizationId = editingId == null ? '' : String(editingId);
                  const leaders = organizationLeaderOptions(selectableUsers, organizationId);
                  return (
                    <SelectField
                      key={field.key}
                      label={field.label}
                      required={false}
                      value={String(draft.leaderUserId ?? '')}
                      options={[
                        { value: '', label: '미지정' },
                        ...leaders.map((leader) => ({
                          value: String(leader.id),
                          label: userOptionLabel(leader)
                        }))
                      ]}
                      onChange={(value) => updateDraftValue('leaderUserId', value)}
                    />
                  );
                }
                if (kind === 'approvalOrgExceptions' && field.key === 'organizationId') {
                  return (
                    <SelectField
                      key={field.key}
                      label={field.label}
                      required={isRequiredField(field)}
                      value={String(draft.organizationId ?? '')}
                      options={organizations.map((organization) => ({
                        value: String(organization.id),
                        label: organization.name
                      }))}
                      onChange={(value) => updateDraftValue('organizationId', value)}
                    />
                  );
                }
                if (kind === 'approvalOrgExceptions' && field.key === 'approverUserId') {
                  return (
                    <SelectField
                      key={field.key}
                      label={field.label}
                      required={isRequiredField(field)}
                      value={String(draft.approverUserId ?? '')}
                      options={selectableUsers.map((user) => ({
                        value: String(user.id),
                        label: user.name
                      }))}
                      onChange={(value) => updateDraftValue('approverUserId', value)}
                    />
                  );
                }
                if (kind === 'approvalLines' && field.key === 'stepsText') {
                  return (
                    <div className="admin-field wide-admin-field" key={field.key}>
                      {label}
                      <ApprovalLineStepsEditor
                        positions={positions}
                        users={selectableUsers}
                        value={String(draft.stepsText ?? STEP_TEMPLATE)}
                        onChange={(value) => updateDraftValue('stepsText', value)}
                      />
                    </div>
                  );
                }

                return (
                  <label key={field.key}>
                    {label}
                    {field.type === 'checkbox' ? (
                    <input
                      aria-label={field.label}
                      type="checkbox"
                      checked={Boolean(draft[field.key])}
                      onChange={(event) => updateDraftValue(field.key, event.target.checked)}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      aria-label={field.label}
                      rows={4}
                      value={String(draft[field.key] ?? '')}
                      onChange={(event) => updateDraftValue(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      aria-label={field.label}
                      type={field.type ?? 'text'}
                      value={String(draft[field.key] ?? '')}
                      onChange={(event) => updateDraftValue(field.key, event.target.value)}
                    />
                  )}
                  </label>
                );
              })}
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setDraft(createDraft())}>초기화</button>
            <button className="primary-button" type="submit">
              <Save aria-hidden="true" size={16} />
              저장
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}

      <div className="table-panel admin-mobile-table-shell">
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
                          비활성화
                        </button>
                        {isAdmin ? (
                          <button className="secondary-button hard-delete-button" type="button" onClick={() => openHardDelete(item)}>
                            <Trash2 aria-hidden="true" size={16} />
                            완전 삭제
                          </button>
                        ) : null}
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

      {hardDeleteTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hard-delete-title">
          <div className="preview-modal compact-modal danger-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="hard-delete-title">완전 삭제</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={closeHardDelete}>×</button>
            </div>
            <div className="form-panel borderless-panel">
              <p className="danger-copy">
                이 데이터는 복구할 수 없습니다.
              </p>
              <dl className="definition-grid compact-definition">
                <div>
                  <dt>ID</dt>
                  <dd>#{itemId(hardDeleteTarget)}</dd>
                </div>
                <div>
                  <dt>대상</dt>
                  <dd>{itemDisplayName(kind, hardDeleteTarget)}</dd>
                </div>
              </dl>
              {hardDeleteError ? <p className="form-error" role="alert">{hardDeleteError}</p> : null}
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeHardDelete} disabled={isHardDeleting}>취소</button>
                <button className="primary-button hard-delete-confirm-button" type="button" disabled={isHardDeleting} onClick={() => void handleHardDelete()}>
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

function RoleCheckboxGroup({
  value,
  onChange
}: {
  value: string;
  onChange: (role: string, checked: boolean) => void;
}) {
  const roles = selectedRoles(value);

  return (
    <div className="checkbox-grid">
      {ROLE_OPTIONS.map((role) => (
        <label className="checkbox-option" key={role}>
          <input
            type="checkbox"
            checked={roles.includes(role)}
            onChange={(event) => onChange(role, event.target.checked)}
          />
          <span>{role}</span>
        </label>
      ))}
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  required,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required: boolean;
  value: string;
}) {
  const selectedValue = value || options[0]?.value || '';

  return (
    <label>
      <span>{label} {required ? <RequiredMark /> : null}</span>
      <select
        aria-label={label}
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.length === 0 ? <option value="">선택</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function UserOrganizationMembershipEditor({
  organizations,
  positions,
  value,
  onChange
}: {
  organizations: AdminOrganization[];
  positions: AdminPosition[];
  value: UserOrganizationMembershipDraft[];
  onChange: (value: UserOrganizationMembershipDraft[]) => void;
}) {
  const memberships = normalizePrimaryMembership(value);
  const selectedOrganizationIds = new Set(memberships.map((membership) => membership.organizationId));
  const nextOrganization = organizations.find((organization) => !selectedOrganizationIds.has(String(organization.id)));

  function updateMembership(index: number, nextValue: Partial<UserOrganizationMembershipDraft>) {
    const next = memberships.map((membership, membershipIndex) => {
      if (membershipIndex !== index) {
        return membership;
      }

      return {
        ...membership,
        ...nextValue,
        active: membership.primary && nextValue.active === false ? true : nextValue.active ?? membership.active
      };
    });
    onChange(normalizePrimaryMembership(next));
  }

  function updatePrimary(index: number) {
    onChange(memberships.map((membership, membershipIndex) => ({
      ...membership,
      primary: membershipIndex === index,
      active: membershipIndex === index ? true : membership.active
    })));
  }

  function addMembership() {
    if (!nextOrganization) {
      return;
    }
    const firstPosition = positions[0];

    onChange(normalizePrimaryMembership([
      ...memberships,
      {
        ...fallbackMembership(
          String(nextOrganization.id),
          nextOrganization.name,
          firstPosition ? String(firstPosition.id) : '',
          firstPosition?.name
        ),
        primary: memberships.length === 0,
        sortOrder: String((memberships.length + 1) * 10)
      }
    ]));
  }

  function removeMembership(index: number) {
    const next = memberships
      .filter((_, membershipIndex) => membershipIndex !== index)
      .map((membership, membershipIndex) => ({
        ...membership,
        sortOrder: String((membershipIndex + 1) * 10)
      }));
    onChange(normalizePrimaryMembership(next));
  }

  return (
    <div className="approval-line-editor">
      {memberships.map((membership, index) => {
        const organizationName = membershipOrganizationName(membership, organizations);
        return (
          <div className="approval-line-step-row user-membership-row" key={`${membership.organizationId}-${index}`}>
            <label>
              <span>소속 조직 <RequiredMark /></span>
              <select
                aria-label="소속 조직"
                value={membership.organizationId}
                onChange={(event) => {
                  const organization = organizations.find((item) => String(item.id) === event.target.value);
                  updateMembership(index, {
                    organizationId: event.target.value,
                    organizationName: organization?.name
                  });
                }}
              >
                {organizations.map((organization) => (
                  <option
                    key={organization.id}
                    value={organization.id}
                    disabled={selectedOrganizationIds.has(String(organization.id)) && String(organization.id) !== membership.organizationId}
                  >
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>소속 직위 <RequiredMark /></span>
              <select
                aria-label="소속 직위"
                value={membership.positionId}
                onChange={(event) => {
                  const position = positions.find((item) => String(item.id) === event.target.value);
                  updateMembership(index, {
                    positionId: event.target.value,
                    positionName: position?.name
                  });
                }}
              >
                {positions.length === 0 ? <option value="">선택</option> : null}
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-option">
              <input
                type="radio"
                name="primary-organization-membership"
                aria-label={`${organizationName} 대표 소속`}
                checked={membership.primary}
                onChange={() => updatePrimary(index)}
              />
              <span>대표</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                aria-label={`${organizationName} 활성 소속`}
                checked={membership.primary || membership.active}
                disabled={membership.primary}
                onChange={(event) => updateMembership(index, { active: event.target.checked })}
              />
              <span>활성</span>
            </label>
            <button
              className="secondary-button danger-button"
              type="button"
              onClick={() => removeMembership(index)}
              disabled={memberships.length === 1}
            >
              <Trash2 aria-hidden="true" size={16} />
              소속 삭제
            </button>
          </div>
        );
      })}
      <button className="secondary-button" type="button" onClick={addMembership} disabled={!nextOrganization}>
        <Plus aria-hidden="true" size={16} />
        소속 추가
      </button>
    </div>
  );
}

function ApprovalLineStepsEditor({
  positions,
  users,
  value,
  onChange
}: {
  positions: AdminPosition[];
  users: AdminUser[];
  value: string;
  onChange: (value: string) => void;
}) {
  const steps = parseApprovalLineSteps(value);
  const firstPositionId = firstId(positions);
  const firstUserId = firstId(users);

  function updateStep(index: number, key: keyof EditableApprovalLineStep, nextValue: string) {
    const next = steps.map((step, stepIndex) => (
      stepIndex === index ? { ...step, [key]: nextValue } : step
    ));
    onChange(serializeApprovalLineSteps(next));
  }

  function updateStepType(index: number, stepType: string) {
    const next = steps.map((step, stepIndex) => {
      if (stepIndex !== index) {
        return step;
      }

      if (stepType === 'ORG_POSITION') {
        return {
          ...step,
          stepType,
          organizationScope: step.organizationScope || 'APPLICANT_ORG',
          positionId: step.positionId || firstPositionId,
          directUserId: '',
          sortPolicy: 'POSITION_ORDER'
        };
      }
      if (stepType === 'ORG_LEADER') {
        return {
          ...step,
          stepType,
          organizationScope: step.organizationScope || 'APPLICANT_ORG',
          positionId: '',
          directUserId: '',
          sortPolicy: 'POSITION_ORDER'
        };
      }

      return {
        ...step,
        stepType,
        organizationScope: '',
        positionId: '',
        directUserId: step.directUserId || firstUserId,
        sortPolicy: 'POSITION_ORDER'
      };
    });
    onChange(serializeApprovalLineSteps(next));
  }

  function addStep() {
    onChange(serializeApprovalLineSteps([
      ...steps,
      {
        stepOrder: String(steps.length + 1),
        stepType: 'DIRECT_USER',
        organizationScope: '',
        positionId: '',
        directUserId: firstUserId,
        sortPolicy: 'POSITION_ORDER'
      }
    ]));
  }

  function removeStep(index: number) {
    const next = steps
      .filter((_, stepIndex) => stepIndex !== index)
      .map((step, stepIndex) => ({ ...step, stepOrder: String(stepIndex + 1) }));
    onChange(serializeApprovalLineSteps(next.length > 0 ? next : parseApprovalLineSteps(STEP_TEMPLATE)));
  }

  return (
    <div className="approval-line-editor">
      {steps.map((step, index) => {
        const labelPrefix = `${index + 1}단계`;
        return (
          <div className="approval-line-step-row" key={index}>
            <label>
              <span>{labelPrefix} 순서 <RequiredMark /></span>
              <input
                aria-label={`${labelPrefix} 순서`}
                type="number"
                value={step.stepOrder}
                onChange={(event) => updateStep(index, 'stepOrder', event.target.value)}
              />
            </label>
            <label>
              <span>{labelPrefix} 유형 <RequiredMark /></span>
              <select
                aria-label={`${labelPrefix} 유형`}
                value={step.stepType}
                onChange={(event) => updateStepType(index, event.target.value)}
              >
                {STEP_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {step.stepType === 'ORG_POSITION' || step.stepType === 'ORG_LEADER' ? (
              <>
                <label>
                  <span>{labelPrefix} 조직범위 <RequiredMark /></span>
                  <select
                    aria-label={`${labelPrefix} 조직범위`}
                    value={step.organizationScope || 'APPLICANT_ORG'}
                    onChange={(event) => updateStep(index, 'organizationScope', event.target.value)}
                  >
                    {ORGANIZATION_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {step.stepType === 'ORG_POSITION' ? (
                  <label>
                    <span>{labelPrefix} 직위 <RequiredMark /></span>
                    <select
                      aria-label={`${labelPrefix} 직위`}
                      value={step.positionId || firstPositionId}
                      onChange={(event) => updateStep(index, 'positionId', event.target.value)}
                    >
                      {positions.length === 0 ? <option value="">선택</option> : null}
                      {positions.map((position) => (
                        <option key={position.id} value={position.id}>{position.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : (
              <label>
                <span>{labelPrefix} 사용자 <RequiredMark /></span>
                <select
                  aria-label={`${labelPrefix} 사용자`}
                  value={step.directUserId || firstUserId}
                  onChange={(event) => updateStep(index, 'directUserId', event.target.value)}
                >
                  {users.length === 0 ? <option value="">선택</option> : null}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{userOptionLabel(user)}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="secondary-button danger-button"
              type="button"
              onClick={() => removeStep(index)}
            >
              <Trash2 aria-hidden="true" size={16} />
              {labelPrefix} 삭제
            </button>
          </div>
        );
      })}
      <button className="secondary-button" type="button" onClick={addStep}>
        <Plus aria-hidden="true" size={16} />
        단계 추가
      </button>
    </div>
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
        <td>
          <div className="user-organization-summary">
            {userMembershipSummary(user).map((summary) => (
              <span key={summary}>{summary}</span>
            ))}
          </div>
        </td>
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
        <td>
          {organization.leader_user_name
            ? `${organization.leader_user_name} / ${organization.leader_position_name ?? '-'}`
            : '-'}
        </td>
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
        <td>{line.approvalTypeName ?? `#${line.approvalTypeId}`}</td>
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
