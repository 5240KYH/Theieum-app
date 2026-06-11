import { Eye, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../shared/api';
import { SearchConditionPanel } from '../shared/SearchConditionPanel';
import { getMyApplications } from './applicationApi';
import { applicationStatusLabel, ApplicationResponse, currentApprover } from './applicationTypes';
import { formatDate, formatDateTime, formatMoney, summarize } from './formatters';
import { formatMonthInput, matchesReceiptMonthRange } from './monthFilters';

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return '내 신청서 목록을 불러오지 못했습니다.';
}

export function MyApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [receiptFromMonth, setReceiptFromMonth] = useState('');
  const [receiptToMonth, setReceiptToMonth] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filteredApplications = applications.filter((application) => (
    matchesReceiptMonthRange(application.receiptDate, receiptFromMonth, receiptToMonth)
  ));

  async function loadApplications() {
    setLoading(true);
    setError('');

    try {
      setApplications(await getMyApplications());
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">신청 업무</p>
          <h1 id="page-title">내 신청서</h1>
        </div>
        <Link className="primary-button" to="/applications/new">새 신청</Link>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>신청 내역</strong>
          <SearchConditionPanel>
            <label className="inline-field filter-field">
              영수증 월 From
              <input
                aria-label="영수증 월 From"
                type="text"
                inputMode="numeric"
                maxLength={7}
                placeholder="YYYY-MM"
                value={receiptFromMonth}
                onChange={(event) => setReceiptFromMonth(formatMonthInput(event.target.value))}
              />
            </label>
            <label className="inline-field filter-field">
              영수증 월 To
              <input
                aria-label="영수증 월 To"
                type="text"
                inputMode="numeric"
                maxLength={7}
                placeholder="YYYY-MM"
                value={receiptToMonth}
                onChange={(event) => setReceiptToMonth(formatMonthInput(event.target.value))}
              />
            </label>
            <button
              className="secondary-button filter-reset-button"
              type="button"
              onClick={() => {
                setReceiptFromMonth('');
                setReceiptToMonth('');
              }}
            >
              전체기간
            </button>
          </SearchConditionPanel>
          <button className="secondary-button" type="button" onClick={loadApplications}>
            <RefreshCcw aria-hidden="true" size={16} />
            새로고침
          </button>
        </div>

        {error ? <p className="panel-message form-error" role="alert">{error}</p> : null}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>신청일</th>
                <th>신청 내용 요약</th>
                <th>영수증 일자</th>
                <th>사용처</th>
                <th>금액</th>
                <th>현재 결재자</th>
                <th>상태</th>
                <th>최종 처리일</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9}>불러오는 중</td>
                </tr>
              ) : filteredApplications.length > 0 ? (
                filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td>{formatDate(application.applicationDate)}</td>
                    <td className="wrap-cell">{summarize(application.description)}</td>
                    <td>{formatDate(application.receiptDate)}</td>
                    <td>{application.vendor}</td>
                    <td>{formatMoney(application.amount)}</td>
                    <td>{currentApprover(application)}</td>
                    <td><span className="status-pill compact">{applicationStatusLabel(application.status)}</span></td>
                    <td>{formatDateTime(application.completedAt)}</td>
                    <td>
                      <Link className="icon-button" to={`/applications/${application.id}`} aria-label={`신청서 ${application.id} 상세`}>
                        <Eye aria-hidden="true" size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>조회된 신청 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
