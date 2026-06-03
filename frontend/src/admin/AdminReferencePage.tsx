import { ReactNode, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../shared/api';
import {
  getAdminApprovalLines,
  getAdminApprovalOrgExceptions,
  getAdminOrganizations,
  getAdminPositions,
  getAdminUsers
} from './adminApi';
import {
  AdminApprovalLine,
  AdminApprovalOrgException,
  AdminOrganization,
  AdminPosition,
  AdminUser
} from './adminTypes';

type AdminReferenceKind = 'users' | 'organizations' | 'positions' | 'approvalLines' | 'approvalOrgExceptions';

interface AdminReferencePageProps {
  kind: AdminReferenceKind;
}

interface PageConfig<T> {
  title: string;
  description: string;
  load: () => Promise<T[]>;
  headers: string[];
  renderRow: (item: T) => ReactNode;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return '관리 데이터를 불러오지 못했습니다.';
}

function configs(): Record<AdminReferenceKind, PageConfig<unknown>> {
  return {
    users: {
      title: '사용자 관리',
      description: '계정, 조직, 직위, 역할과 활성 상태를 확인합니다.',
      load: getAdminUsers as () => Promise<unknown[]>,
      headers: ['ID', '아이디', '이름', '조직', '직위', '역할', '상태'],
      renderRow: (item) => {
        const user = item as AdminUser;
        return (
          <tr key={user.id}>
            <td>#{user.id}</td>
            <td>{user.login_id}</td>
            <td>{user.name}</td>
            <td>{user.organization_name}</td>
            <td>{user.position_name}</td>
            <td>{user.roles}</td>
            <td>{user.active ? '활성' : '비활성'}</td>
          </tr>
        );
      }
    },
    organizations: {
      title: '조직 관리',
      description: '상위 조직, 레벨, 정렬 순서와 활성 상태를 확인합니다.',
      load: getAdminOrganizations as () => Promise<unknown[]>,
      headers: ['ID', '조직명', '상위조직', '레벨', '정렬', '상태'],
      renderRow: (item) => {
        const organization = item as AdminOrganization;
        return (
          <tr key={organization.id}>
            <td>#{organization.id}</td>
            <td>{organization.name}</td>
            <td>{organization.parent_id ? `#${organization.parent_id}` : '-'}</td>
            <td>{organization.level_no}</td>
            <td>{organization.sort_order}</td>
            <td>{organization.active ? '활성' : '비활성'}</td>
          </tr>
        );
      }
    },
    positions: {
      title: '직위 관리',
      description: '결재선 산정에 사용하는 직위 순서와 활성 상태를 확인합니다.',
      load: getAdminPositions as () => Promise<unknown[]>,
      headers: ['ID', '직위명', '직위 순서', '정렬', '상태'],
      renderRow: (item) => {
        const position = item as AdminPosition;
        return (
          <tr key={position.id}>
            <td>#{position.id}</td>
            <td>{position.name}</td>
            <td>{position.rank_order}</td>
            <td>{position.sort_order}</td>
            <td>{position.active ? '활성' : '비활성'}</td>
          </tr>
        );
      }
    },
    approvalLines: {
      title: '결재선 관리',
      description: '전자결재 유형별 결재 단계, 조직/직위 기준과 직접 대상자를 확인합니다.',
      load: getAdminApprovalLines as () => Promise<unknown[]>,
      headers: ['ID', '결재선명', '결재 유형', '단계', '상태'],
      renderRow: (item) => {
        const line = item as AdminApprovalLine;
        return (
          <tr key={line.id}>
            <td>#{line.id}</td>
            <td>{line.name}</td>
            <td>#{line.approvalTypeId}</td>
            <td className="wrap-cell">
              {line.steps.map((step) => `${step.stepOrder}. ${step.stepType}`).join(' / ')}
            </td>
            <td>{line.active ? '활성' : '비활성'}</td>
          </tr>
        );
      }
    },
    approvalOrgExceptions: {
      title: '조직별 예외 결재자 관리',
      description: '조직 단위로 기본 결재선 대신 적용할 예외 결재자를 확인합니다.',
      load: getAdminApprovalOrgExceptions as () => Promise<unknown[]>,
      headers: ['ID', '결재 유형', '조직', '예외 결재자', '단계', '상태'],
      renderRow: (item) => {
        const exception = item as AdminApprovalOrgException;
        return (
          <tr key={exception.id}>
            <td>#{exception.id}</td>
            <td>#{exception.approvalTypeId}</td>
            <td>{exception.organizationName}</td>
            <td>{exception.approverName}</td>
            <td>{exception.stepOrder}</td>
            <td>{exception.active ? '활성' : '비활성'}</td>
          </tr>
        );
      }
    }
  };
}

export function AdminReferencePage({ kind }: AdminReferencePageProps) {
  const config = useMemo(() => configs()[kind], [kind]);
  const [items, setItems] = useState<unknown[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await config.load();
        if (!ignore) {
          setItems(data);
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
  }, [config]);

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">관리</p>
          <h1 id="page-title">{config.title}</h1>
          <p className="muted-copy">{config.description}</p>
        </div>
        <span className="status-pill">{items.length}건</span>
      </div>

      <div className="table-panel">
        {error ? <p className="form-error panel-message" role="alert">{error}</p> : null}
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
              {items.map((item) => config.renderRow(item))}
              {!isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={config.headers.length}>조회된 데이터가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
