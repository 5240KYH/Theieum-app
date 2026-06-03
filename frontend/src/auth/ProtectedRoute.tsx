import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}
