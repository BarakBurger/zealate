import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CaretLeft, CaretRight, ListBullets, PencilSimpleLine, X } from '@phosphor-icons/react';
import { api, ApiError, type Book, type Chapter } from '../lib/api';
import { textDir, textLang, useI18n } from '../lib/i18n';
import { chapterHtml, countSpreads, paragraphsOf } from '../lib/bookText';
import { NotFound } from './NotFound';

const RATIO = 17 / 11; // trade paperback, 5.5 x 8.5 in
type Theme = 'paper' | 'sepia' | 'night';
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The text of every readable chapter, kept per book version so moving between chapters is instant.
const textsCache = new Map<string, Promise<Chapter[]>>();
const loadTexts = (book: Book) => {
  const key = `${book.id}:${book.updatedAt}`;
  if (!textsCache.has(key)) textsCache.set(key, api<{ chapters: Chapter[] }>(`/books/${book.id}/chapters`).then(r => r.chapters).catch(() => []));
  return textsCache.get(key)!;
};

/**
 * An open book. The chapter is laid out in CSS columns, one column per printed page, and the
 * reader moves a window across them a spread at a time: two pages side by side on a wide screen,
 * one on a phone. In a Hebrew book the columns run right to left, so page one is on the right.
 *
 * Page numbers run straight through the book: the chapters before this one are laid out
 * off-screen at the same size, and their pages are counted. Every chapter opens on a new spread,
 * as chapters open on a fresh right-hand page in print.
 */
export const Reader = () => {
  const { id = '', cid = '' } = useParams();
  const { t, dir: uiDir } = useI18n();
  const nav = useNavigate();
  const location = useLocation() as { state?: { atEnd?: boolean } };
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [missing, setMissing] = useState(false);
  const [spread, setSpread] = useState(0);
  const [spreads, setSpreads] = useState(1);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [scale, setScale] = useState<number>(() => load('z_scale', 1));
  const [theme, setTheme] = useState<Theme>(() => load('z_theme', 'paper'));
  const [drawer, setDrawer] = useState(false);
  const [box, setBox] = useState({ w: window.innerWidth, h: window.innerHeight });
  const viewRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => { store('z_scale', scale); }, [scale]);
  useEffect(() => { store('z_theme', theme); }, [theme]);

  useEffect(() => {
    let live = true;
    setChapter(null);
    Promise.all([api<{ book: Book }>(`/books/${id}`), api<{ chapter: Chapter }>(`/books/${id}/chapters/${cid}`)])
      .then(([b, c]) => { if (live) { setBook(b.book); setChapter(c.chapter); document.title = `${c.chapter.title} · ${b.book.title}`; } })
      .catch(e => { if (e instanceof ApiError && e.status === 404) setMissing(true); });
    return () => { live = false; };
  }, [id, cid]);

  // The stage is whatever room is left between the top row and the bottom controls.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [chapter]);

  const bookDir = textDir(`${chapter?.title || ''} ${chapter?.body.slice(0, 400) || ''}`, uiDir);
  const geo = useMemo(() => {
    const two = box.w >= 860 && box.w / Math.max(box.h, 1) > 1.05;
    const per = two ? 2 : 1;
    let h = Math.max(320, box.h);
    let w = h / RATIO;
    if (w * per > box.w) { w = box.w / per; h = w * RATIO; }
    const top = h * 0.085, bottom = h * 0.105;
    // Side margins and type size are set for line length: about 9 to 10 words a line, near a
    // printed paperback, instead of the 7 that wider margins and larger type gave.
    const outer = w * 0.075, inner = two ? w * 0.065 : outer;
    const colW = w - outer - inner;
    const gap = inner * 2;
    const font = Math.max(15, Math.min(21, w / 28)) * scale;
    return { two, per, w, h, top, bottom, outer, inner, colW, gap, font, step: per * (colW + gap) };
  }, [box, scale]);

  // Readers move only through chapters they can read; the author moves through all of them.
  const readable = useMemo(() => (book ? book.chapters.filter(c => book.isOwner || c.isPublic) : []), [book]);
  const index = chapter ? readable.findIndex(c => c.id === chapter.id) : -1;
  const prevCh = index > 0 ? readable[index - 1] : null;
  const nextCh = index >= 0 ? readable[index + 1] || null : null;
  const chapterNo = book && chapter ? book.chapters.findIndex(c => c.id === chapter.id) + 1 : 0;
  const paragraphs = useMemo(() => paragraphsOf(chapter?.body || ''), [chapter]);

  // Count the spreads once the text is laid out (and again when fonts arrive or size changes).
  useLayoutEffect(() => {
    const flow = flowRef.current;
    if (!flow || !chapter) return;
    const measure = () => {
      const n = countSpreads(flow, geo, bookDir);
      setSpreads(n);
      setSpread(s => (location.state?.atEnd ? n - 1 : Math.min(s, n - 1)));
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [chapter, geo, location.state, bookDir]);

  // Lay out every readable chapter off-screen at the same size to number pages through the book.
  useEffect(() => {
    const host = measureRef.current;
    if (!book || !host) return;
    let live = true;
    const run = async () => {
      const texts = await loadTexts(book);
      await document.fonts?.ready;
      if (!live) return;
      const counts: Record<string, number> = {};
      const last = texts[texts.length - 1]?.id;
      for (const c of texts) {
        const no = book.chapters.findIndex(x => x.id === c.id) + 1;
        const d = textDir(`${c.title} ${c.body.slice(0, 400)}`, uiDir);
        host.dir = d;
        host.innerHTML = chapterHtml(`${t.chapter} ${no}`, c.title, c.body, c.id === last ? '✦ ✦ ✦' : '❦');
        counts[c.id] = countSpreads(host, geo, d) * geo.per;
      }
      host.innerHTML = '';
      setPageCounts(counts);
    };
    const timer = window.setTimeout(run, 60);
    return () => { live = false; window.clearTimeout(timer); };
  }, [book, geo, t.chapter, uiDir]);

  const startPage = useMemo(() => {
    const out: Record<string, number> = {};
    let n = 1;
    for (const c of readable) { out[c.id] = n; n += pageCounts[c.id] ?? 0; }
    return { byId: out, total: n - 1, ready: readable.every(c => pageCounts[c.id] !== undefined) };
  }, [readable, pageCounts]);

  useEffect(() => { setSpread(location.state?.atEnd ? Number.MAX_SAFE_INTEGER : 0); }, [cid, location.state]);

  // Move the text, not the scroll position: a browser will not scroll past the last column, so a
  // chapter ending on a left-hand page could never show its final spread by scrolling.
  useLayoutEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    const s = Math.min(spread, spreads - 1);
    flow.style.transform = `translateX(${(bookDir === 'rtl' ? 1 : -1) * s * geo.step}px)`;
  }, [spread, spreads, geo, bookDir]);

  const animateTurn = (forward: boolean) => {
    const el = turnRef.current;
    if (!el || reducedMotion()) return;
    // The sheet that swings is the one on the far side of the spine in reading direction.
    const fromRight = (bookDir === 'ltr') === forward;
    el.style.width = `${geo.w}px`;
    el.style.left = fromRight ? `${geo.two ? geo.w : 0}px` : '0px';
    el.style.transformOrigin = fromRight ? 'left center' : 'right center';
    el.animate(
      [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${fromRight ? -180 : 180}deg)`, filter: 'brightness(.85)' }],
      { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)' },
    );
  };

  const go = useCallback((forward: boolean) => {
    if (!book) return;
    if (forward) {
      if (spread < spreads - 1) { animateTurn(true); setSpread(s => s + 1); }
      else if (nextCh) { animateTurn(true); nav(`/b/${id}/read/${nextCh.id}`); }
    } else {
      if (spread > 0) { animateTurn(false); setSpread(s => s - 1); }
      else if (prevCh) { animateTurn(false); nav(`/b/${id}/read/${prevCh.id}`, { state: { atEnd: true } }); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, spread, spreads, nextCh, prevCh, id, nav, geo, bookDir]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (drawer || (e.target instanceof Element && e.target.closest('input, textarea, select'))) return;
      const ahead = bookDir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = bookDir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === ahead || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(true); }
      if (e.key === back || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); go(false); }
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, bookDir, drawer]);

  // Swipe: drag toward the spine to turn forward, the way a real page moves.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    go(bookDir === 'rtl' ? dx > 0 : dx < 0);
  };

  if (missing) return <NotFound />;
  if (!book || !chapter) return <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>;

  const Back = uiDir === 'rtl' ? ArrowRight : ArrowLeft;
  const PrevI = bookDir === 'rtl' ? CaretRight : CaretLeft;
  const NextI = bookDir === 'rtl' ? CaretLeft : CaretRight;
  const s = Math.min(spread, spreads - 1);
  // Until the earlier chapters are measured, numbers count from this chapter; then they continue.
  const offset = startPage.ready ? (startPage.byId[chapter.id] ?? 1) - 1 : 0;
  const firstPage = offset + s * geo.per + 1;
  const totalPages = startPage.ready ? startPage.total : offset + spreads * geo.per;
  const atStart = s === 0 && !prevCh;
  const atEnd = s === spreads - 1 && !nextCh;
  const folios = Array.from({ length: geo.per }, (_, k) => firstPage + k);
  const progress = startPage.ready && totalPages ? (firstPage - 1 + geo.per) / totalPages : (s + 1) / spreads;

  return (
    <div className="reader" data-theme={theme}>
      <div className="reader-top">
        <Link to={`/b/${id}`} className="btn btn-ghost btn-sm"><Back size={16} aria-hidden="true" /> {t.backToBook}</Link>
        <span className="title" dir="auto">{book.title}</span>
        {book.isOwner && <Link to={`/b/${id}/write/${cid}`} className="btn btn-ghost btn-sm"><PencilSimpleLine size={16} aria-hidden="true" /> {t.write}</Link>}
        <button type="button" className="btn btn-sm" onClick={() => setDrawer(true)} aria-haspopup="dialog"><ListBullets size={18} aria-hidden="true" /> {t.contents}</button>
      </div>

      <div className="stage" ref={stageRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: 'pan-y' }}>
        <div className={`spread ${geo.two ? 'two' : ''}`} dir={bookDir}
          style={{ width: geo.w * geo.per, height: geo.h, borderRadius: geo.two ? 6 : '3px 8px 8px 3px' }}>
          <div className="page-view" ref={viewRef} aria-live="polite"
            style={{ top: geo.top, bottom: geo.bottom, insetInlineStart: geo.outer, insetInlineEnd: geo.outer }}>
            <div className="flow" ref={flowRef} dir={bookDir} lang={textLang(`${chapter.title} ${chapter.body.slice(0, 400)}`)}
              style={{ columnWidth: geo.colW, columnGap: geo.gap, fontSize: geo.font, lineHeight: 1.62 }}>
              <span className="chap-no">{t.chapter} {chapterNo}</span>
              <h1 dir="auto">{chapter.title}</h1>
              {paragraphs.map((p, i) => p.trim()
                ? <p key={i} dir="auto" className={paragraphs.slice(0, i).every(x => !x.trim()) ? 'first' : undefined}>{p}</p>
                : <p key={i} className="blank" aria-hidden="true" />)}
              <p className="fin">{nextCh ? '❦' : '✦ ✦ ✦'}</p>
              {!nextCh && <p className="fin" style={{ letterSpacing: '.1em' }}>{t.endOfBook}</p>}
            </div>
          </div>
          {/* Off-screen twin of the page, used only to measure the other chapters. */}
          <div className="page-view" aria-hidden="true" style={{ top: geo.top, bottom: geo.bottom, insetInlineStart: geo.outer, insetInlineEnd: geo.outer, visibility: 'hidden', zIndex: -1 }}>
            <div className="flow" ref={measureRef} style={{ columnWidth: geo.colW, columnGap: geo.gap, fontSize: geo.font, lineHeight: 1.62 }} />
          </div>
          {folios.map((n, k) => (
            <span key={k} className="folio" aria-hidden="true"
              style={{ bottom: geo.bottom * 0.4, insetInlineStart: geo.w * k + geo.w / 2, transform: `translateX(${bookDir === 'rtl' ? '50%' : '-50%'})` }}>
              {n}
            </span>
          ))}
          <div ref={turnRef} className="turn" aria-hidden="true" style={{ transform: 'rotateY(90deg)' }} />
          <button type="button" className="nav-zone" style={{ insetInlineStart: 0 }} onClick={() => go(false)} disabled={atStart} aria-label={t.prevPage} />
          <button type="button" className="nav-zone" style={{ insetInlineEnd: 0 }} onClick={() => go(true)} disabled={atEnd} aria-label={t.nextPage} />
        </div>
      </div>

      <div className="reader-bottom" dir={bookDir}>
        <button type="button" className="btn btn-icon" onClick={() => go(false)} disabled={atStart} aria-label={t.prevPage}><PrevI size={20} aria-hidden="true" /></button>
        <div className="stack" style={{ gap: 6, justifyItems: 'center' }}>
          <div className="progress" aria-hidden="true"><i style={{ width: `${Math.min(1, progress) * 100}%` }} /></div>
          <span className="page-count">{t.page} {firstPage}{geo.per > 1 ? `–${firstPage + 1}` : ''} {t.ofPages} {totalPages}</span>
        </div>
        <button type="button" className="btn btn-icon" onClick={() => go(true)} disabled={atEnd} aria-label={t.nextPage}><NextI size={20} aria-hidden="true" /></button>
      </div>

      {drawer && (
        <>
          <div className="drawer-scrim" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-h">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 id="dr-h" style={{ margin: 0 }}>{t.contents}</h2>
              <span className="spacer" />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setDrawer(false)} aria-label={t.cancel} autoFocus><X size={18} aria-hidden="true" /></button>
            </div>
            <ol className="drawer-toc">
              {book.chapters.map((c, i) => {
                const canRead = book.isOwner || c.isPublic;
                const inner = (
                  <>
                    <span className="n">{i + 1}</span><span className="t" dir="auto">{c.title}</span>
                    <span className="pg">{canRead ? (startPage.ready ? startPage.byId[c.id] : '') : t.comingSoon}</span>
                  </>
                );
                return (
                  <li key={c.id}>
                    {canRead
                      ? <Link to={`/b/${id}/read/${c.id}`} aria-current={c.id === cid ? 'page' : undefined} onClick={() => setDrawer(false)}>{inner}</Link>
                      : <span className="locked">{inner}</span>}
                  </li>
                );
              })}
            </ol>
            <div className="stack" style={{ marginTop: 28 }}>
              <div className="field">
                <label htmlFor="ts">{t.textSize}</label>
                <input id="ts" type="range" min={0.85} max={1.35} step={0.05} value={scale} onChange={e => setScale(Number(e.target.value))} />
              </div>
              <div className="field">
                <span style={{ fontWeight: 600, fontSize: '.92rem', color: 'var(--desk-ink-soft)' }}>{t.theme}</span>
                <div className="seg" role="group" aria-label={t.theme}>
                  {(['paper', 'sepia', 'night'] as Theme[]).map(th => (
                    <button key={th} type="button" aria-pressed={theme === th} onClick={() => setTheme(th)}>{t[th]}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
