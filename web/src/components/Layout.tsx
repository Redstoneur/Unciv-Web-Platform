import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

const UNCIV_REPOSITORY = 'https://github.com/yairm210/Unciv';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    await navigate('/');
  };

  return (
    <div className="app">
      <div className="unofficial-banner" role="note">
        {t('app.unofficial')}
      </div>
      <header className="header">
        <Link to="/" className="brand">
          {t('app.name')}
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
              <NavLink to="/settings">{t('nav.settings')}</NavLink>
              {user.role === 'admin' && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
              <button type="button" className="link-button" onClick={() => void onLogout()}>
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">{t('nav.login')}</NavLink>
              <NavLink to="/register">{t('nav.register')}</NavLink>
            </>
          )}
          <LanguageSwitcher />
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>{t('app.unofficial')}</span>
        <span>
          {t('footer.license')}{' '}
          <a href={UNCIV_REPOSITORY} target="_blank" rel="noreferrer">
            {t('footer.uncivSource')}
          </a>
        </span>
      </footer>
    </div>
  );
}
