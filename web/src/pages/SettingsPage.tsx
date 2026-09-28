import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import type { MultiplayerMode, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { usePlatform } from '../hooks/usePlatform';
import { SUPPORTED_LOCALES } from '../i18n';

type Status = { error: unknown; success: string | null };
const idle: Status = { error: null, success: null };

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const platform = usePlatform();
  const navigate = useNavigate();
  const [mode, setMode] = useState<MultiplayerMode>(user?.multiplayerMode ?? 'official');
  const [profileStatus, setProfileStatus] = useState<Status>(idle);
  const [passwordStatus, setPasswordStatus] = useState<Status>(idle);
  const [deleteStatus, setDeleteStatus] = useState<Status>(idle);

  if (!user) return null;
  const platformServerAvailable = Boolean(platform?.multiplayer.platformServerUrl);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileStatus(idle);
    try {
      const updated = await api.patch<User>('/users/me', {
        username: String(form.get('username')),
        locale: String(form.get('locale')),
        uncivUserId: String(form.get('uncivUserId')).trim(),
        multiplayerMode: mode,
        customMultiplayerUrl: mode === 'custom' ? String(form.get('customMultiplayerUrl')) : null,
      });
      setUser(updated);
      setProfileStatus({ error: null, success: t('settings.saved') });
    } catch (error) {
      setProfileStatus({ error, success: null });
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPasswordStatus(idle);
    try {
      await api.post('/users/me/password', {
        currentPassword: String(form.get('currentPassword')),
        newPassword: String(form.get('newPassword')),
      });
      formElement.reset();
      setPasswordStatus({ error: null, success: t('settings.passwordChanged') });
    } catch (error) {
      setPasswordStatus({ error, success: null });
    }
  };

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm(t('settings.deleteConfirm'))) return;
    const form = new FormData(event.currentTarget);
    setDeleteStatus(idle);
    try {
      await api.delete('/users/me', { password: String(form.get('password')) });
      setUser(null);
      await navigate('/', { replace: true });
    } catch (error) {
      setDeleteStatus({ error, success: null });
    }
  };

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <form className="card form" onSubmit={(event) => void saveProfile(event)}>
        <h2>{t('settings.profile')}</h2>
        <label>
          {t('auth.email')}
          <input value={user.email} disabled readOnly />
        </label>
        <label>
          {t('auth.username')}
          <input
            name="username"
            defaultValue={user.username}
            required
            minLength={3}
            maxLength={32}
          />
        </label>
        <label>
          {t('settings.locale')}
          <select name="locale" defaultValue={user.locale}>
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(`languages.${locale}`)}
              </option>
            ))}
          </select>
        </label>

        <h2>{t('settings.multiplayerTitle')}</h2>
        <p className="muted">{t('settings.multiplayerText')}</p>
        <fieldset className="radio-group">
          {(['official', 'platform', 'custom'] as const).map((option) => {
            const disabled = option === 'platform' && !platformServerAvailable;
            return (
              <label key={option} className={disabled ? 'disabled' : undefined}>
                <input
                  type="radio"
                  name="multiplayerMode"
                  value={option}
                  checked={mode === option}
                  disabled={disabled}
                  onChange={() => setMode(option)}
                />
                {t(`settings.mode.${option}`)}
                {disabled && (
                  <small className="muted"> ({t('settings.platformUnavailable')})</small>
                )}
              </label>
            );
          })}
        </fieldset>
        {mode === 'custom' && (
          <label>
            {t('settings.customUrl')}
            <input
              name="customMultiplayerUrl"
              type="url"
              placeholder="https://"
              defaultValue={user.customMultiplayerUrl ?? ''}
              required
            />
          </label>
        )}
        <label>
          {t('settings.uncivUserId')}
          <input
            name="uncivUserId"
            defaultValue={user.uncivUserId}
            required
            pattern="[0-9a-fA-F\-]{36}"
          />
          <small className="muted">{t('settings.uncivUserIdHint')}</small>
        </label>

        <ErrorMessage error={profileStatus.error} />
        {profileStatus.success && <p className="alert alert-success">{profileStatus.success}</p>}
        <button type="submit" className="btn btn-primary">
          {t('settings.save')}
        </button>
      </form>

      <form className="card form" onSubmit={(event) => void changePassword(event)}>
        <h2>{t('settings.passwordTitle')}</h2>
        <label>
          {t('settings.currentPassword')}
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label>
          {t('settings.newPassword')}
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        <ErrorMessage error={passwordStatus.error} />
        {passwordStatus.success && <p className="alert alert-success">{passwordStatus.success}</p>}
        <button type="submit" className="btn">
          {t('settings.changePassword')}
        </button>
      </form>

      <form className="card form danger-zone" onSubmit={(event) => void deleteAccount(event)}>
        <h2>{t('settings.dangerTitle')}</h2>
        <p>{t('settings.dangerText')}</p>
        <label>
          {t('auth.password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <ErrorMessage error={deleteStatus.error} />
        <button type="submit" className="btn btn-danger">
          {t('settings.delete')}
        </button>
      </form>
    </>
  );
}
