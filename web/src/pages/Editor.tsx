import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, CornersIn, CornersOut, Eye, EyeSlash, Plus, WarningCircle } from '@phosphor-icons/react';
import { api, ApiError, type Book, type Chapter } from '../lib/api';
import { textDir, useI18n } from '../lib/i18n';
import { NotFound } from './NotFound';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Writing happens on one sheet cut to a book page's width, in the same typeface and size the
 * reader uses, so a line here breaks close to where it will break in the book. A faint rust line
 * marks roughly where each printed page ends.
 */
export const Editor = () => {
  const { id = '', cid = '' } = useParams();
  const { t, dir } = useI18n();
  const nav = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const [pages, setPages] = useState(1);
  const [focus, setFocus] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);
  const timer = useRef<number>();
  const latest = useRef({ title, body });
  latest.current = { title, body };

  useEffect(() => {
    let live = true;
    setChapter(null); setState('idle'); dirty.current = false;
    Promise.all([api<{ book: Book }>(`/books/${id}`), api<{ chapter: Chapter }>(`/books/${id}/chapters/${cid}`)])
      .then(([b, c]) => {
        if (!live) return;
        if (!b.book.isOwner) { nav(`/b/${id}/read/${cid}`, { replace: true }); return; }
        setBook(b.book); setChapter(c.chapter); setTitle(c.chapter.title); setBody(c.chapter.body);
      })
      .catch(e => { if (e instanceof ApiError && e.status === 404) setMissing(true); });
    return () => { live = false; };
  }, [id, cid, nav]);

  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setState('saving');
    try {
      const r = await api<{ book: Book; chapter: Chapter }>(`/books/${id}/chapters/${cid}`, { method: 'PUT', body: JSON.stringify(latest.current) });
      setBook(r.book); setState(dirty.current ? 'saving' : 'saved');
    } catch {
      dirty.current = true; setState('error');
      window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 4000);
    }
  }, [id, cid]);

  const change = (next: { title?: string; body?: string }) => {
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    dirty.current = true; setState('saving');
    window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 1100);
  };

  // Save before leaving the chapter, and warn before closing the tab with unsaved words.
  useEffect(() => () => { window.clearTimeout(timer.current); void save(); }, [save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } };
    window.addEventListener('beforeunload', warn); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('keydown', key); };
  }, [save]);
  useEffect(() => { document.body.classList.toggle('focus-mode', focus); return () => document.body.classList.remove('focus-mode'); }, [focus]);

  // Grow the sheet with the text, and mark where the printed pages would end.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    // The text column is 86% of the page width, and the reader fills 81% of the page height.
    const pagePx = el.clientWidth / 0.86 * 17 / 11 * 0.81;
    el.style.setProperty('--page-px', `${pagePx}px`);
    setPages(Math.max(1, Math.ceil((body.trim() ? el.scrollHeight : 1) / pagePx)));
  }, [body, chapter]);

  if (missing) return <NotFound />;
  if (!book || !chapter) return <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>;

  const idx = book.chapters.findIndex(c => c.id === cid);
  const prev = book.chapters[idx - 1];
  const next = book.chapters[idx + 1];
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const Fwd = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const words = (body.trim().match(/\S+/g) || []).length;
  // A new chapter goes right after the one being written, so a book can be written in any order.
  const addChapter = async () => {
    await save();
    const r = await api<{ chapter: { id: string } }>(`/books/${id}/chapters`, { method: 'POST', body: JSON.stringify({ after: cid }) });
    nav(`/b/${id}/write/${r.chapter.id}`);
  };
  const ref = book.chapters[idx];
  const togglePublish = async () => {
    await save();
    const r = await api<{ book: Book }>(`/books/${id}/chapters/${cid}`, { method: 'PUT', body: JSON.stringify({ isPublic: !ref?.isPublic }) });
    setBook(r.book);
  };

  return (
    <main id="main" className="editor-shell">
      <nav className="editor-toc panel" aria-label={t.contents}>
        <Link to={`/b/${id}`} className="btn btn-ghost btn-sm" style={{ marginInlineStart: -8 }}><Back size={16} aria-hidden="true" /> <span dir="auto">{book.title}</span></Link>
        <ol>
          {book.chapters.map((c, i) => (
            <li key={c.id}>
              <Link to={`/b/${id}/write/${c.id}`} aria-current={c.id === cid ? 'page' : undefined}>
                <span className="n">{i + 1}</span><span dir="auto">{c.id === cid ? title || c.title : c.title}</span>
              </Link>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={addChapter}><Plus size={16} aria-hidden="true" /> {t.addAfter} {idx + 1}</button>
      </nav>

      <div className="sheet-wrap">
        <div className="sheet-tools" style={{ ['--sheet-w' as any]: 'min(100%, 36rem)' }}>
          <span className="save-state" data-state={state} role="status" aria-live="polite">
            {state === 'saved' && <CheckCircle size={16} aria-hidden="true" />}
            {state === 'error' && <WarningCircle size={16} aria-hidden="true" />}
            {state === 'saving' ? t.saving : state === 'saved' ? t.saved : state === 'error' ? t.saveFailed : ''}
          </span>
          <span className="spacer" />
          <span className="muted" style={{ fontSize: '.85rem', fontVariantNumeric: 'tabular-nums' }}>{words.toLocaleString()} {t.words} · ≈{pages} {t.pageApprox}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setFocus(f => !f)} aria-pressed={focus} aria-label={focus ? t.exitFocus : t.focusMode} title={focus ? t.exitFocus : t.focusMode}>
            {focus ? <CornersIn size={18} aria-hidden="true" /> : <CornersOut size={18} aria-hidden="true" />}
          </button>
          <button type="button" className={`btn btn-sm ${ref?.isPublic ? '' : 'btn-ghost'}`} onClick={togglePublish} aria-pressed={!!ref?.isPublic}
            title={ref?.isPublic ? t.unpublishChapter : t.publishChapter}>
            {ref?.isPublic ? <Eye size={16} aria-hidden="true" /> : <EyeSlash size={16} aria-hidden="true" />} {ref?.isPublic ? t.published : t.draft}
          </button>
          <Link className="btn btn-sm" to={`/b/${id}/read/${cid}`}><BookOpen size={16} aria-hidden="true" /> {t.read}</Link>
        </div>

        <article className="sheet">
          <label className="sr-only" htmlFor="ct">{t.chapterTitle}</label>
          <input id="ct" className="sheet-title" dir={textDir(title, dir)} value={title} maxLength={160} placeholder={t.chapterTitle}
            onChange={e => change({ title: e.target.value })} />
          <div className="sheet-rule" aria-hidden="true" />
          <label className="sr-only" htmlFor="cb">{t.writeHere}</label>
          <textarea id="cb" ref={bodyRef} className="sheet-body" dir={textDir(body, dir)} value={body} placeholder={t.writeHere}
            onChange={e => change({ body: e.target.value })} spellCheck />
        </article>

        <div className="sheet-foot">
          {prev ? <Link className="btn btn-sm" to={`/b/${id}/write/${prev.id}`}><Back size={16} aria-hidden="true" /> {t.prevChapter}</Link> : <span />}
          {next ? <Link className="btn btn-sm" to={`/b/${id}/write/${next.id}`}>{t.nextChapter} <Fwd size={16} aria-hidden="true" /></Link>
            : <button type="button" className="btn btn-sm" onClick={addChapter}><Plus size={16} aria-hidden="true" /> {t.addChapter}</button>}
        </div>
      </div>
    </main>
  );
};
