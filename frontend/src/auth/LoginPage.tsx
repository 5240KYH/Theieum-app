import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      await auth.login(loginId, password);
      const nextPath = location.state && typeof location.state === 'object' && 'from' in location.state
        ? String(location.state.from)
        : '/dashboard';
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">영수증 첨부 전자결재</p>
          <h1 id="login-title">로그인</h1>
          <p className="login-copy">등록된 계정으로 접속해 신청서와 결재 업무를 처리합니다.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>아이디</span>
            <input
              autoComplete="username"
              name="loginId"
              onChange={(event) => setLoginId(event.target.value)}
              required
              type="text"
              value={loginId}
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            <LogIn aria-hidden="true" size={18} />
            {isSubmitting ? '로그인 중' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  );
}
