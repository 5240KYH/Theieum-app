import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { api } from '../shared/api';
import { AuthenticatedUser, LoginResponse } from './authTypes';

interface AuthContextValue {
  token: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const USER_STORAGE_KEY = 'authUser';

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser() {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthenticatedUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'));
  const [user, setUser] = useState<AuthenticatedUser | null>(() => readStoredUser());

  const value = useMemo<AuthContextValue>(() => {
    async function login(loginId: string, password: string) {
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ loginId, password })
      });

      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      setToken(response.accessToken);
      setUser(response.user);
    }

    function logout() {
      localStorage.removeItem('accessToken');
      localStorage.removeItem(USER_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }

    function hasRole(role: string) {
      return user?.roles.includes(role) ?? false;
    }

    return {
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      hasRole
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
