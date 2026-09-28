import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { SUPPORTED_LOCALES } from '../i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();

  const change = async (locale: string) => {
    await i18n.changeLanguage(locale);
    if (user && user.locale !== locale) {
      setUser(await api.patch<User>('/users/me', { locale }));
    }
  };

  return (
    <label className="language-switcher">
      <span className="sr-only">{t('nav.language')}</span>
      <select value={i18n.resolvedLanguage} onChange={(event) => void change(event.target.value)}>
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`languages.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
