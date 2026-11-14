import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api';
import type { Profile, Session, User } from '../lib/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
  applySession: (s: Session) => void;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
  setUser: (u: User) => void;
  signOutReason: string | null;
  clearSignOutReason: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Clears all locally cached app state (tokens, preferences) and reloads. */
export function clearCacheAndReset() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => undefined);
  }
  window.location.replace(import.meta.env.BASE_URL || '/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getToken());
  const [signOutReason, setSignOutReason] = useState<string | null>(null);

  const applySession = useCallback((s: Session) => {
    if (s.token) setToken(s.token);
    setUser(s.user);
    setProfile(s.profile);
  }, []);

  const clearLocal = useCallback((reason?: string) => {
    setToken(null);
    setUser(null);
    setProfile(null);
    if (reason) setSignOutReason(reason);
  }, []);

  const refresh = useCallback(async () => {
    const s = await api.get<Session>('/auth/me');
    setUser(s.user);
    setProfile(s.profile);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => clearLocal('Your session has expired. Please sign in again.'));
    if (getToken()) {
      refresh()
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
    return () => setUnauthorizedHandler(null);
  }, [clearLocal, refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await api.post<Session>('/auth/login', { email, password });
      setSignOutReason(null);
      applySession(s);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const s = await api.post<Session>('/auth/register', { email, password, display_name: displayName });
      setSignOutReason(null);
      applySession(s);
    },
    [applySession],
  );

  const signOut = useCallback(
    async (reason?: string) => {
      try {
        if (getToken()) await api.post('/auth/logout');
      } catch {
        /* token may already be invalid */
      }
      clearLocal(reason);
    },
    [clearLocal],
  );

  const value = useMemo<AuthState>(
    () => ({
      user, profile, loading, signIn, signUp, signOut, applySession, refresh, setProfile, setUser,
      signOutReason, clearSignOutReason: () => setSignOutReason(null),
    }),
    [user, profile, loading, signIn, signUp, signOut, applySession, refresh, signOutReason],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
