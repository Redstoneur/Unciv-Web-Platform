import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) return <p className="muted">{t('app.loading')}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
