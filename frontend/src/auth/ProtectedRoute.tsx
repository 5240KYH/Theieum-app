import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  requiredRole?: string;
  requiredAnyRole?: string[];
}

export function ProtectedRoute({ requiredAnyRole, requiredRole }: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (requiredRole && !auth.hasRole(requiredRole)) {
    return <Navigate replace to="/dashboard" />;
  }

  if (requiredAnyRole && !requiredAnyRole.some((role) => auth.hasRole(role))) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}
