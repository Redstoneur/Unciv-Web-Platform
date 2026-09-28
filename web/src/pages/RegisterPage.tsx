import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { usePlatform } from '../hooks/usePlatform';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const platform = usePlatform();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await register({
        email: String(form.get('email')),
        username: String(form.get('username')),
        password: String(form.get('password')),
      });
      await navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  if (platform && !platform.registrationEnabled) {
    return (
      <section className="card form-card">
        <h1>{t('auth.registerTitle')}</h1>
        <p>{t('auth.registrationDisabled')}</p>
      </section>
    );
  }

  return (
    <section className="card form-card">
      <h1>{t('auth.registerTitle')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="form">
        <label>
          {t('auth.email')}
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label>
          {t('auth.username')}
          <input
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            pattern="[\p{L}\p{N}_.\-]+"
          />
        </label>
        <label>
          {t('auth.password')}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
          <small className="muted">{t('auth.passwordHint')}</small>
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {t('auth.submitRegister')}
        </button>
      </form>
      <p className="muted">
        {t('auth.haveAccount')} <Link to="/login">{t('nav.login')}</Link>
      </p>
    </section>
  );
}
