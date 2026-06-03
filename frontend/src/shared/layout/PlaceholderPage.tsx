interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="page-section" aria-labelledby="page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">업무 화면</p>
          <h1 id="page-title">{title}</h1>
        </div>
        <span className="status-pill">준비 중</span>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>{description}</strong>
          <button className="secondary-button" type="button">새로고침</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>상태</th>
              <th>담당</th>
              <th>최종 변경</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{title}</td>
              <td>후속 작업 대기</td>
              <td>업무 담당자</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
