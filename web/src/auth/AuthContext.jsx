import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, getToken, ApiError } from '../api/client';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user for the whole app.
 *
 * On load it asks the API who the stored token belongs to, rather than
 * trusting anything decoded on the client. If the account has been
 * deactivated the token is dropped immediately.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.me();
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      /** Re-reads the current user, e.g. after changing a password. */
      async refresh() {
        try {
          const data = await api.me();
          setUser(data.user);
          return data.user;
        } catch {
          return null;
        }
      },
      async signIn(email, password) {
        const data = await api.login(email, password);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      signOut() {
        setToken(null);
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
