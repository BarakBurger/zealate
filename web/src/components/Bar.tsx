import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, SignOut, Translate } from '@phosphor-icons/react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { SearchBox } from './SearchBox';

export const Bar = () => {
  const { t, toggle } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="bar">
      <Link to="/" className="brand" aria-label={t.brand}>
        <span className="brand-mark" aria-hidden="true">Z</span>
        <span>{t.brand}</span>
      </Link>
      <div className="bar-search"><SearchBox /></div>
      <nav className="bar-actions" aria-label="Account">
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-label={t.language}>
          <Translate size={18} aria-hidden="true" /> <span>{t.language}</span>
        </button>
        {user ? (
          <>
            <Link to="/desk" className="btn btn-sm"><BookOpenText size={18} aria-hidden="true" /> {t.myDesk}</Link>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t.logout} title={t.logout}
              onClick={async () => { await logout(); nav('/'); }}>
              <SignOut size={18} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">{t.login}</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">{t.signup}</Link>
          </>
        )}
      </nav>
    </header>
  );
};
