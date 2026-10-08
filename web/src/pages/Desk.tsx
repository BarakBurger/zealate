import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { api, type Book } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { BookCard } from '../components/BookCover';

export const Desk = () => {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) api<{ books: Book[] }>('/my/books').then(r => setBooks(r.books)).catch(() => setBooks([])); }, [user]);
  useEffect(() => { if (naming) inputRef.current?.focus(); }, [naming]);
  if (ready && !user) return <Navigate to="/login" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<{ book: Book }>('/books', { method: 'POST', body: JSON.stringify({ title }) });
      nav(`/b/${r.book.id}`);
    } finally { setBusy(false); }
  };

  return (
    <main id="main">
      <div className="shelf-head">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{t.myDesk}</h1>
        <span className="muted">{user?.display}</span>
      </div>
      {books === null ? <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div> : (
        <div className="shelf">
          <div>
            {naming ? (
              <form onSubmit={create} className="new-book" style={{ cursor: 'default', alignContent: 'center' }}>
                <label htmlFor="nt" style={{ color: 'var(--desk-ink-soft)' }}>{t.newBookTitle}</label>
                <input id="nt" ref={inputRef} className="input" dir="auto" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-primary btn-sm" disabled={busy}>{t.create}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNaming(false); setTitle(''); }}>{t.cancel}</button>
                </div>
              </form>
            ) : (
              <button type="button" className="new-book" onClick={() => setNaming(true)}>
                <span><Plus size={34} aria-hidden="true" /><br />{t.newBook}</span>
              </button>
            )}
          </div>
          {books.map((b, i) => (
            <div key={b.id} className="fade-in" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
              <BookCard book={b} to={`/b/${b.id}`}
                sub={`${b.isPublic ? t.public : t.private} · ${b.chapters.length} ${t.chapters}`} />
            </div>
          ))}
        </div>
      )}
      {books?.length === 0 && !naming && <p className="muted" style={{ marginTop: 24 }}>{t.deskEmpty}</p>}
    </main>
  );
};
