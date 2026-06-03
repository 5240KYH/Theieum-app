import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

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

const TOKEN_STORAGE_KEY = 'accessToken';
const USER_STORAGE_KEY = 'authUser';

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthSession {
  token: string | null;
  user: AuthenticatedUser | null;
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthenticatedUser>;
  return typeof candidate.id === 'number'
    && typeof candidate.loginId === 'string'
    && typeof candidate.name === 'string'
    && Array.isArray(candidate.roles)
    && candidate.roles.every((role) => typeof role === 'string');
}

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function readStoredSession(): AuthSession {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!token || !rawUser) {
    clearStoredAuth();
    return { token: null, user: null };
  }

  try {
    const parsedUser = JSON.parse(rawUser) as unknown;
    if (!isAuthenticatedUser(parsedUser)) {
      clearStoredAuth();
      return { token: null, user: null };
    }
    return { token, user: parsedUser };
  } catch {
    clearStoredAuth();
    return { token: null, user: null };
  }
}

function normalizeRole(role: string) {
  const normalized = role.trim().toUpperCase();
  return normalized === 'MANGER' ? 'MANAGER' : normalized;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession>(() => readStoredSession());

  function logout() {
    clearStoredAuth();
    setSession({ token: null, user: null });
  }

  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout);
    return () => window.removeEventListener('auth:unauthorized', logout);
  }, []);

  useEffect(() => {
    if (!session.token) {
      return undefined;
    }

    let ignore = false;

    async function refreshUser() {
      try {
        const user = await api<AuthenticatedUser>('/me');
        if (ignore) {
          return;
        }
        if (!isAuthenticatedUser(user)) {
          return;
        }
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        setSession((current) => current.token === session.token ? { ...current, user } : current);
      } catch {
        // api() dispatches auth:unauthorized for expired sessions. Other failures keep the current session usable.
      }
    }

    void refreshUser();

    return () => {
      ignore = true;
    };
  }, [session.token]);


  const value = useMemo<AuthContextValue>(() => {
    async function login(loginId: string, password: string) {
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ loginId, password })
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      setSession({ token: response.accessToken, user: response.user });
    }

    function hasRole(role: string) {
      const targetRole = normalizeRole(role);
      return session.user?.roles?.some((userRole) => normalizeRole(userRole) === targetRole) ?? false;
    }

    return {
      token: session.token,
      user: session.user,
      isAuthenticated: Boolean(session.token && session.user),
      login,
      logout,
      hasRole
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
