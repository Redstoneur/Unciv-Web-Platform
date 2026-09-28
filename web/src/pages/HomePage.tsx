import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { usePlatform } from '../hooks/usePlatform';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const platform = usePlatform();
  const downloads = platform?.downloads;

  return (
    <>
      <section className="hero">
        <img src="/logo.svg" alt="" width={112} height={112} className="hero-logo" />
        <h1>{t('home.title')}</h1>
        <p className="lead">{t('home.subtitle')}</p>
        <Link to={user ? '/dashboard' : '/register'} className="btn btn-primary btn-large">
          {user ? t('home.ctaLogged') : t('home.cta')}
        </Link>
        {platform && (
          <p className="muted">
            {platform.currentVersion
              ? t('home.currentVersion', { version: platform.currentVersion })
              : t('home.noVersion')}
          </p>
        )}
      </section>

      <section className="features">
        <article className="card">
          <h2>{t('home.features.officialTitle')}</h2>
          <p>{t('home.features.officialText')}</p>
        </article>
        <article className="card">
          <h2>{t('home.features.freeTitle')}</h2>
          <p>{t('home.features.freeText')}</p>
        </article>
        <article className="card">
          <h2>{t('home.features.multiTitle')}</h2>
          <p>{t('home.features.multiText')}</p>
        </article>
      </section>

      <section className="card">
        <h2>{t('home.standaloneTitle')}</h2>
        <p>{t('home.standaloneText')}</p>
        {downloads && (
          <div className="button-row">
            {(['windows', 'linux', 'android', 'jar'] as const).map((key) => {
              const url = downloads[key];
              return url ? (
                <a key={key} className="btn" href={url} rel="noreferrer">
                  {t(`home.downloads.${key}`)}
                </a>
              ) : null;
            })}
            <a
              className="btn btn-ghost"
              href={downloads.releasesPage}
              target="_blank"
              rel="noreferrer"
            >
              {t('home.downloads.all')}
            </a>
          </div>
        )}
      </section>
    </>
  );
}
