import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { api, type User } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';

export const Auth = ({ mode }: { mode: 'login' | 'signup' }) => {
  const { t, lang } = useI18n();
  const { user, mail, setUser } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to="/desk" replace />;
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api<{ user: User }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(signup ? { username, password, email, lang } : { username, password }) });
      setUser(r.user);
      nav('/desk');
    } catch (err: any) { setError(err.message || t.error); } finally { setBusy(false); }
  };

  return (
    <main id="main" className="auth">
      <div className="auth-book fade-in">
        <p className="eyebrow">{t.brand}</p>
        <h1>{signup ? t.createAccount : t.welcomeBack}</h1>
        <form onSubmit={submit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="u">{t.username}</label>
            <input id="u" className="input" dir="auto" value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24}
              aria-describedby={signup ? 'u-hint' : undefined} />
            {signup && <span id="u-hint" className="hint">{t.usernameHint}</span>}
          </div>
          <div className="field">
            <label htmlFor="p">{t.password}</label>
            <div className="input-wrap">
              <input id="p" className="input" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1}
                aria-describedby={signup ? 'p-hint' : undefined} style={{ paddingInlineEnd: 52 }} />
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setShow(s => !s)}
                aria-label={show ? t.hidePassword : t.showPassword} aria-pressed={show}>
                {show ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {signup && <span id="p-hint" className="hint">{t.passwordHint}</span>}
          </div>
          {signup && (
            <div className="field">
              <label htmlFor="e">{t.email}</label>
              <input id="e" className="input" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" required maxLength={254} aria-describedby="e-hint" />
              <span id="e-hint" className="hint">{t.emailHint}</span>
            </div>
          )}
          {!signup && mail && <Link to="/forgot" className="muted" style={{ fontSize: '.9rem', justifySelf: 'start' }}>{t.forgotLink}</Link>}
          <button className="btn btn-primary" type="submit" disabled={busy || !username || !password || (signup && !email)}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null} {signup ? t.signup : t.login}
          </button>
          <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
            {signup ? t.haveAccount : t.noAccount}{' '}
            <Link to={signup ? '/login' : '/signup'} style={{ color: 'var(--brass)', fontWeight: 600 }}>{signup ? t.login : t.signup}</Link>
          </p>
        </form>
      </div>
    </main>
  );
};
