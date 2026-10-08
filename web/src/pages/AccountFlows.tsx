import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, EnvelopeSimple, Trash, WarningCircle } from '@phosphor-icons/react';
import { api, type User } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

/** The small book-cover card the sign-in pages already use, for each account step. */
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { t } = useI18n();
  return (
    <main id="main" className="auth">
      <div className="auth-book fade-in">
        <p className="eyebrow">{t.brand}</p>
        <h1>{title}</h1>
        <div className="stack" style={{ marginTop: 22, position: 'relative' }}>{children}</div>
      </div>
    </main>
  );
};

/** Forgot password: the same answer whether or not the account exists. */
export const Forgot = () => {
  const { t, lang } = useI18n();
  const [who, setWho] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ who, lang }) }); } catch { /* same answer regardless */ }
    setSent(true); setBusy(false);
  };
  return (
    <Card title={t.forgotTitle}>
      {sent ? (
        <div className="notice" role="status"><EnvelopeSimple size={18} aria-hidden="true" /><span>{t.forgotSent}</span></div>
      ) : (
        <form onSubmit={submit} className="stack">
          <p className="muted" style={{ margin: 0 }}>{t.forgotBody}</p>
          <div className="field">
            <label htmlFor="w">{t.forgotWho}</label>
            <input id="w" className="input" dir="auto" value={who} onChange={e => setWho(e.target.value)} autoComplete="username" required />
          </div>
          <button className="btn btn-primary" disabled={busy || !who.trim()}>{t.sendLink}</button>
        </form>
      )}
      <Link to="/login" className="muted" style={{ textAlign: 'center' }}>{t.login}</Link>
    </Card>
  );
};

/** The page a reset link opens: choose a new password, and you are signed in. */
export const Reset = () => {
  const { t } = useI18n();
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api<{ user: User }>('/auth/reset', { method: 'POST', body: JSON.stringify({ token: params.get('token'), password }) });
      setUser(r.user); nav('/desk');
    } catch (err: any) { setError(err.message || t.linkBad); } finally { setBusy(false); }
  };
  return (
    <Card title={t.resetTitle}>
      <form onSubmit={submit} className="stack">
        {error && <div className="form-error" role="alert">{error} <Link to="/forgot" style={{ color: 'inherit' }}>{t.forgotLink}</Link></div>}
        <div className="field">
          <label htmlFor="np">{t.newPassword}</label>
          <input id="np" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="new-password" minLength={8} required aria-describedby="np-hint" />
          <span id="np-hint" className="hint">{t.passwordHint}</span>
        </div>
        <button className="btn btn-primary" disabled={busy || password.length < 8}>{t.savePassword}</button>
      </form>
    </Card>
  );
};

/** The page a confirmation link opens. Confirms once, even if React runs the effect twice. */
export const Verify = () => {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'done' | 'bad'>('working');
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    api<{ user: User }>('/auth/verify', { method: 'POST', body: JSON.stringify({ token: params.get('token') }) })
      .then(r => { setState('done'); if (user && user.username === r.user.username) setUser(r.user); })
      .catch(() => setState('bad'));
  }, [params, user, setUser]);
  return (
    <Card title={t.verifyTitle}>
      {state === 'working' && <div className="center" style={{ minHeight: 80 }}><div className="spinner" role="status" aria-label={t.loading} /></div>}
      {state === 'done' && <div className="notice" role="status"><CheckCircle size={18} aria-hidden="true" /><span>{t.verifyDone}</span></div>}
      {state === 'bad' && <div className="form-error" role="alert">{t.linkBad}</div>}
      {state !== 'working' && <Link to={user ? '/desk' : '/login'} className="btn btn-primary">{user ? t.myDesk : t.login}</Link>}
    </Card>
  );
};

/** Account settings: the email address, and deleting the account. */
export const Account = () => {
  const { t, lang } = useI18n();
  const { user, ready, mail, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEmail(user?.email || ''); }, [user?.email]);
  if (ready && !user) return <Navigate to="/login" replace />;
  if (!user) return <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>;

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api<{ user: User }>('/auth/email', { method: 'PUT', body: JSON.stringify({ email, password, lang }) });
      setUser(r.user); setPassword(''); toast(r.user.emailVerified ? t.saved : t.resent);
    } catch (err: any) { setError(err.message || t.error); } finally { setBusy(false); }
  };
  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(t.confirmDeleteAccount)) return;
    setBusy(true); setError('');
    try {
      await api('/auth/account', { method: 'DELETE', body: JSON.stringify({ password: delPassword }) });
      setUser(null); nav('/');
    } catch (err: any) { setError(err.message || t.error); } finally { setBusy(false); }
  };

  return (
    <main id="main" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', marginBottom: 24 }}>{t.account}</h1>
      {error && <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      <form className="panel stack" onSubmit={saveEmail}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{t.emailSection}</h2>
          {user.email && (
            <span className={`pill ${user.emailVerified ? 'pill-public' : 'pill-private'}`}>
              {user.emailVerified ? <CheckCircle size={14} aria-hidden="true" /> : <WarningCircle size={14} aria-hidden="true" />}
              {user.emailVerified ? t.emailOk : t.emailUnverified}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="ae">{t.email}</label>
          <input id="ae" className="input" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required aria-describedby="ae-hint" />
          <span id="ae-hint" className="hint">{t.emailHint}</span>
        </div>
        <div className="field">
          <label htmlFor="ap">{t.currentPassword}</label>
          <input id="ap" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !email || !password}>{t.saveEmail}</button>
          {mail && user.email && !user.emailVerified && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
              try { await api('/auth/resend', { method: 'POST', body: JSON.stringify({ lang }) }); toast(t.resent); }
              catch (err: any) { toast(err.message || t.error); }
            }}>{t.resend}</button>
          )}
        </div>
      </form>

      <form className="panel stack" onSubmit={remove} style={{ marginTop: 28, borderColor: 'rgba(255,120,100,.25)' }}>
        <h2 style={{ margin: 0 }}>{t.deleteAccount}</h2>
        <p className="muted" style={{ margin: 0 }}>{t.deleteAccountHint}</p>
        <div className="field">
          <label htmlFor="dp">{t.currentPassword}</label>
          <input id="dp" className="input" type="password" value={delPassword} onChange={e => setDelPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button className="btn btn-danger" disabled={busy || !delPassword} style={{ justifySelf: 'start' }}><Trash size={16} aria-hidden="true" /> {t.deleteAccount}</button>
      </form>
    </main>
  );
};

/** On the desk: a reminder until the email address is confirmed, because publishing waits on it. */
export const VerifyBanner = () => {
  const { t, lang } = useI18n();
  const { user, mail } = useAuth();
  const toast = useToast();
  if (!mail || !user || user.emailVerified) return null;
  return (
    <div className="notice" role="status" style={{ marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <EnvelopeSimple size={18} aria-hidden="true" />
      {user.email ? (
        <>
          <span style={{ flex: 1, minWidth: 220 }}>{t.verifyBanner} <bdi dir="ltr">{user.email}</bdi>.</span>
          <button type="button" className="btn btn-sm" onClick={async () => {
            try { await api('/auth/resend', { method: 'POST', body: JSON.stringify({ lang }) }); toast(t.resent); }
            catch (err: any) { toast(err.message || t.error); }
          }}>{t.resend}</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, minWidth: 220 }}>{t.addEmailBanner}</span>
          <Link to="/account" className="btn btn-sm">{t.addEmail}</Link>
        </>
      )}
    </div>
  );
};
