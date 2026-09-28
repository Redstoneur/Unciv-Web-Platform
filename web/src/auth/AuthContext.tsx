import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback(
    (next: User | null) => {
      setUserState(next);
      // The account language drives both the interface and the game.
      if (next && next.locale !== i18n.resolvedLanguage) void i18n.changeLanguage(next.locale);
    },
    [i18n],
  );

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) console.error(error);
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      login: async (login, password) => {
        setUser(await api.post<User>('/auth/login', { login, password }));
      },
      register: async (data) => {
        setUser(await api.post<User>('/auth/register', { ...data, locale: i18n.resolvedLanguage }));
      },
      logout: async () => {
        await api.post('/auth/logout');
        setUserState(null);
      },
    }),
    [user, loading, setUser, i18n],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook colocated with its provider
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
