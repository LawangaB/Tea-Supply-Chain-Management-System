import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out, object = { user, permissions, menu, producer }
  const [session, setSession] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setSession(data);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setSession(null); }
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    can: (action) => !!session?.permissions?.includes(action),
    hasRole: (...roles) => roles.some((r) => session?.user?.roles?.includes(r)),
    login,
    logout,
    refresh,
  }), [session, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
