import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';

/** Displays an API error translated from its stable error code. */
export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  const details = error instanceof ApiError && code === 'VALIDATION_ERROR' ? error.message : null;
  return (
    <p className="alert alert-error" role="alert">
      {t(`errors.${code}`, { defaultValue: t('errors.INTERNAL_ERROR') })}
      {details && <small className="details">{details}</small>}
    </p>
  );
}
