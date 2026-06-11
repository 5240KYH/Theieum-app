import { ReactNode } from 'react';

interface SearchConditionPanelProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SearchConditionPanel({ actions, children, className = '' }: SearchConditionPanelProps) {
  return (
    <section className={['search-condition-panel', className].filter(Boolean).join(' ')} aria-label="검색조건">
      <div className="search-condition-heading">
        <span>검색조건</span>
        {actions ? <div className="search-condition-actions">{actions}</div> : null}
      </div>
      <div className="search-condition-fields">
        {children}
      </div>
    </section>
  );
}
