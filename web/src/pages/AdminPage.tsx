import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { AdminOverview, AdminSession, GameVersion, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';

interface AdminData {
  overview: AdminOverview;
  versions: GameVersion[];
  sessions: AdminSession[];
  users: User[];
}

async function fetchAdminData(): Promise<AdminData> {
  const [overview, versions, sessions, users] = await Promise.all([
    api.get<AdminOverview>('/admin/overview'),
    api.get<GameVersion[]>('/admin/versions'),
    api.get<AdminSession[]>('/admin/sessions'),
    api.get<User[]>('/admin/users'),
  ]);
  return { overview, versions, sessions, users };
}

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.resolvedLanguage) : '–';

  useEffect(() => {
    let cancelled = false;
    fetchAdminData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setData(await fetchAdminData());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const checkUpdates = () =>
    run(async () => {
      const result = await api.post<{ latest: string }>('/admin/versions/check');
      setMessage(t('admin.updateResult', { latest: result.latest }));
    });

  const install = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tag = String(new FormData(event.currentTarget).get('tag')).trim();
    if (tag) void run(() => api.post('/admin/versions', { tag }));
  };

  if (!data) {
    return error ? <ErrorMessage error={error} /> : <p className="muted">{t('app.loading')}</p>;
  }
  const { overview, versions, sessions, users } = data;

  return (
    <>
      <h1>{t('admin.title')}</h1>
      <ErrorMessage error={error} />
      {message && <p className="alert alert-success">{message}</p>}

      <section className="stats">
        <div className="card stat">
          <span className="label">{t('admin.users')}</span>
          <strong>{overview.users}</strong>
        </div>
        <div className="card stat">
          <span className="label">{t('admin.sessions')}</span>
          <strong>
            {overview.activeSessions} / {overview.maxSessions}
          </strong>
        </div>
        <div className="card stat">
          <span className="label">{t('admin.currentVersion')}</span>
          <strong>{overview.currentVersion ?? '–'}</strong>
        </div>
        <div className="card stat">
          <span className="label">{t('admin.docker')}</span>
          <strong className={overview.dockerAvailable ? 'ok' : 'ko'}>
            {overview.dockerAvailable ? t('admin.available') : t('admin.unavailable')}
          </strong>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>{t('admin.versions')}</h2>
          <button type="button" className="btn" disabled={busy} onClick={() => void checkUpdates()}>
            {busy ? t('admin.checking') : t('admin.checkUpdates')}
          </button>
        </div>
        <form className="inline-form" onSubmit={install}>
          <input
            name="tag"
            placeholder="4.22.4"
            aria-label={t('admin.installTag')}
            maxLength={64}
          />
          <button type="submit" className="btn btn-small" disabled={busy}>
            {t('admin.install')}
          </button>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.columns.tag')}</th>
              <th>{t('admin.columns.published')}</th>
              <th>{t('admin.columns.status')}</th>
              <th>{t('admin.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.tag}>
                <td>
                  <a href={version.releaseUrl} target="_blank" rel="noreferrer">
                    {version.tag}
                  </a>
                </td>
                <td>{formatDate(version.publishedAt)}</td>
                <td title={version.error ?? undefined}>{t(`admin.status.${version.status}`)}</td>
                <td>
                  {version.isCurrent ? (
                    <span className="badge">{t('admin.active')}</span>
                  ) : (
                    version.status === 'ready' && (
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            api.post(`/admin/versions/${encodeURIComponent(version.tag)}/activate`),
                          )
                        }
                      >
                        {t('admin.activate')}
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {versions.length === 0 && <p className="muted">{t('admin.empty')}</p>}
      </section>

      <section className="card">
        <h2>{t('admin.sessions')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.columns.user')}</th>
              <th>{t('admin.columns.tag')}</th>
              <th>{t('admin.columns.status')}</th>
              <th>{t('admin.columns.started')}</th>
              <th>{t('admin.columns.lastSeen')}</th>
              <th>{t('admin.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.username}</td>
                <td>{session.version}</td>
                <td>{t(`admin.status.${session.status}`)}</td>
                <td>{formatDate(session.createdAt)}</td>
                <td>{formatDate(session.lastSeenAt)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={busy}
                    onClick={() => void run(() => api.delete(`/admin/sessions/${session.id}`))}
                  >
                    {t('admin.stopSession')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <p className="muted">{t('admin.empty')}</p>}
      </section>

      <section className="card">
        <h2>{t('admin.users')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.columns.user')}</th>
              <th>{t('admin.columns.email')}</th>
              <th>{t('admin.columns.role')}</th>
              <th>{t('admin.columns.created')}</th>
              <th>{t('admin.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{t(`admin.roles.${user.role}`)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className="actions">
                    {!isSelf && (
                      <>
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              api.patch(`/admin/users/${user.id}`, {
                                role: user.role === 'admin' ? 'user' : 'admin',
                              }),
                            )
                          }
                        >
                          {user.role === 'admin' ? t('admin.makeUser') : t('admin.makeAdmin')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                t('admin.deleteUserConfirm', { username: user.username }),
                              )
                            ) {
                              void run(() => api.delete(`/admin/users/${user.id}`));
                            }
                          }}
                        >
                          {t('admin.deleteUser')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
