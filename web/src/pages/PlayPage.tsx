import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useGameSession } from '../hooks/useGameSession';

export function PlayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { session, loading, stop } = useGameSession({ keepAlive: true });

  const onStop = async () => {
    if (!window.confirm(t('play.stopConfirm'))) return;
    await stop();
    await navigate('/dashboard');
  };

  if (loading) return <p className="muted">{t('app.loading')}</p>;

  if (!session?.playUrl) {
    return (
      <section className="card">
        <p>{session ? t('dashboard.starting') : t('play.notRunning')}</p>
        <Link to="/dashboard" className="btn">
          {t('play.back')}
        </Link>
      </section>
    );
  }

  return (
    <section className="play">
      <div className="play-toolbar">
        <Link to="/dashboard" className="btn btn-small">
          {t('play.back')}
        </Link>
        <span className="muted">{t('play.hint')}</span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => void frameRef.current?.requestFullscreen()}
        >
          {t('play.fullscreen')}
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={() => void onStop()}>
          {t('play.stop')}
        </button>
      </div>
      <iframe
        ref={frameRef}
        className="play-frame"
        src={session.playUrl}
        title="Unciv"
        allow="fullscreen; clipboard-read; clipboard-write"
      />
    </section>
  );
}
