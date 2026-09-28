import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get('login')), String(form.get('password')));
      const from = (location.state as { from?: string } | null)?.from;
      await navigate(from ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card form-card">
      <h1>{t('auth.loginTitle')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="form">
        <label>
          {t('auth.login')}
          <input name="login" autoComplete="username" required maxLength={254} />
        </label>
        <label>
          {t('auth.password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {t('auth.submitLogin')}
        </button>
      </form>
      <p className="muted">
        {t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link>
      </p>
    </section>
  );
}
