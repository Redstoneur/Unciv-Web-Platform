import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { CopyField } from '../components/CopyField';
import { ErrorMessage } from '../components/ErrorMessage';
import { useGameSession } from '../hooks/useGameSession';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { session, loading, error, start, stop } = useGameSession();

  if (!user) return null;

  return (
    <>
      <h1>{t('dashboard.title', { username: user.username })}</h1>

      <section className="card">
        <h2>{t('dashboard.sessionTitle')}</h2>
        {loading ? (
          <p className="muted">{t('app.loading')}</p>
        ) : session ? (
          <>
            <p>
              {session.status === 'running' ? t('dashboard.running') : t('dashboard.starting')}{' '}
              <span className="muted">{t('dashboard.version', { version: session.version })}</span>
            </p>
            {session.status === 'starting' && <div className="spinner" aria-hidden="true" />}
            <div className="button-row">
              {session.status === 'running' && (
                <Link to="/play" className="btn btn-primary btn-large">
                  {t('dashboard.resume')}
                </Link>
              )}
              <button type="button" className="btn btn-danger" onClick={() => void stop()}>
                {t('dashboard.stop')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">{t('dashboard.noSession')}</p>
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={() => void start()}
            >
              {t('dashboard.start')}
            </button>
          </>
        )}
        <ErrorMessage error={error} />
        <p className="muted">{t('dashboard.saveInfo')}</p>
      </section>

      <section className="card">
        <h2>{t('dashboard.standaloneTitle')}</h2>
        <p>{t('dashboard.standaloneText')}</p>
        <CopyField label={t('dashboard.userId')} value={user.uncivUserId} />
        <CopyField label={t('dashboard.server')} value={user.multiplayerServerUrl} />
      </section>
    </>
  );
}
