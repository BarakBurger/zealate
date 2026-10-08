import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Eye, EyeSlash, FilePdf, FileDoc, ImageSquare, LinkSimple, PencilSimpleLine, Plus, Trash } from '@phosphor-icons/react';
import { downloadDoc } from '../lib/exportBook';
import { api, ApiError, type Book, type Chapter } from '../lib/api';
import { textDir, useI18n } from '../lib/i18n';
import { Cover } from '../components/BookCover';
import { Switch } from '../components/Switch';
import { useToast } from '../components/Toast';
import { NotFound } from './NotFound';

export const BookPage = () => {
  const { id = '' } = useParams();
  const { t, dir } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [moved, setMoved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ book: Book }>(`/books/${id}`).then(r => { setBook(r.book); setTitle(r.book.title); setDesc(r.book.description); setAuthorName(r.book.authorName || ''); })
      .catch(e => { if (e instanceof ApiError && e.status === 404) setMissing(true); });
  }, [id]);
  useEffect(() => { if (book) document.title = `${book.title} · ${t.brand}`; }, [book, t.brand]);

  if (missing) return <NotFound />;
  if (!book) return <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>;
  const owner = !!book.isOwner;

  const patch = async (body: Partial<Book>) => {
    const r = await api<{ book: Book }>(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    setBook(r.book);
  };
  const move = async (i: number, delta: number) => {
    const ids = book.chapters.map(c => c.id);
    const j = i + delta;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const r = await api<{ book: Book }>(`/books/${id}/chapters/order`, { method: 'PUT', body: JSON.stringify({ ids }) });
    setBook(r.book); setMoved(ids[j]);
  };
  /** A new chapter at the end, at the start, or right after a chosen one. */
  const addChapter = async (where: { after?: string; position?: 'start' } = {}) => {
    const r = await api<{ chapter: { id: string } }>(`/books/${id}/chapters`, { method: 'POST', body: JSON.stringify(where) });
    nav(`/b/${id}/write/${r.chapter.id}`);
  };
  const setPublished = async (cid: string, isPublic: boolean) => {
    const r = await api<{ book: Book }>(`/books/${id}/chapters/${cid}`, { method: 'PUT', body: JSON.stringify({ isPublic }) });
    setBook(r.book);
  };
  const exportDoc = async () => {
    const r = await api<{ chapters: Chapter[] }>(`/books/${id}/chapters`);
    downloadDoc(book, r.chapters, t.chapter);
  };
  const removeChapter = async (cid: string) => {
    if (!confirm(t.confirmDeleteChapter)) return;
    const r = await api<{ book: Book }>(`/books/${id}/chapters/${cid}`, { method: 'DELETE' });
    setBook(r.book);
  };
  const uploadCover = async (file: File) => {
    try {
      const r = await api<{ book: Book }>(`/books/${id}/cover`, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
      setBook(r.book);
    } catch (e: any) { toast(e.message || t.error); }
  };
  const first = book.chapters.find(c => owner || c.isPublic);

  return (
    <main id="main" className="book-layout">
      <aside className="book-side">
        <Cover book={book} />
        {owner && (
          <div className="stack" style={{ gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="cover-file"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }} />
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <ImageSquare size={18} aria-hidden="true" /> {book.hasCover ? t.replaceCover : t.uploadCover}
            </button>
            {book.hasCover && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => setBook((await api<{ book: Book }>(`/books/${id}/cover`, { method: 'DELETE' })).book)}>
                {t.removeCover}
              </button>
            )}
            <span className="hint muted" style={{ fontSize: '.8rem', textAlign: 'center' }}>{t.coverHint}</span>
          </div>
        )}
        {first && (
          <Link to={`/b/${id}/read/${first.id}`} className="btn btn-primary"><BookOpen size={20} aria-hidden="true" /> {t.startReading}</Link>
        )}
      </aside>

      <section className="stack" style={{ gap: 28 }}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <span className={`pill ${book.isPublic ? 'pill-public' : 'pill-private'}`}>{book.isPublic ? t.public : t.private}</span>
            {book.isPublic && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(location.href); toast(t.copied); }}>
                <LinkSimple size={16} aria-hidden="true" /> {t.share}
              </button>
            )}
          </div>
          {owner ? (
            <>
              <label className="sr-only" htmlFor="bt">{t.title}</label>
              <input id="bt" className="book-title-input" dir={textDir(title, dir)} value={title} maxLength={160}
                onChange={e => setTitle(e.target.value)} onBlur={() => title !== book.title && patch({ title })} />
            </>
          ) : <h1 dir="auto" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>{book.title}</h1>}
          <p className="muted" dir="auto" style={{ margin: 0 }}>{book.author ? `${t.by} ${book.author}` : owner ? `${t.by} ${book.authorName || book.ownerDisplay}` : t.anonymous}</p>
        </div>

        {owner ? (
          <div className="field">
            <label htmlFor="bd">{t.description}</label>
            <textarea id="bd" className="input" dir={textDir(desc, dir)} value={desc} maxLength={1200} placeholder={t.descriptionPlaceholder}
              onChange={e => setDesc(e.target.value)} onBlur={() => desc !== book.description && patch({ description: desc })} />
          </div>
        ) : book.description && <p dir="auto" style={{ fontSize: '1.1rem', color: 'var(--desk-ink-soft)', margin: 0, maxWidth: '62ch' }}>{book.description}</p>}

        {owner && (
          <div className="panel">
            <Switch checked={book.isPublic} onChange={v => patch({ isPublic: v })} label={t.makePublic} sub={t.makePublicHint} />
            <Switch checked={book.listPublic} onChange={v => patch({ listPublic: v })} label={t.listPublic} sub={t.listPublicHint} />
            <Switch checked={book.authorPublic} onChange={v => patch({ authorPublic: v })} label={t.showAuthor} sub={t.showAuthorHint} />
            <div className="field" style={{ margin: '4px 0 12px', paddingInlineStart: 62 }}>
              <label htmlFor="an">{t.authorName}</label>
              <input id="an" className="input" dir={textDir(authorName, dir)} value={authorName} maxLength={80}
                placeholder={book.ownerDisplay} aria-describedby="an-hint" autoComplete="name"
                onChange={e => setAuthorName(e.target.value)}
                onBlur={() => authorName !== (book.authorName || '') && patch({ authorName } as Partial<Book>)} />
              <span id="an-hint" className="hint">{t.authorNameHint}</span>
            </div>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '.85rem' }}>{t.chapterPublishedHint}</p>
          </div>
        )}

        <div className="toc">
          <h2>{t.contents}</h2>
          {book.chapters.length === 0 ? <p className="empty-toc">{t.noChapters}</p> : (
            <ol>
              {book.chapters.map((c, i) => (
                <Fragment key={c.id}>
                <li className={[moved === c.id ? 'moved' : '', !owner && !c.isPublic ? 'locked' : ''].join(' ')} onAnimationEnd={() => setMoved(null)}>
                  <span className="num" aria-hidden="true" />
                  {owner || c.isPublic ? (
                    <Link className="ch" to={owner ? `/b/${id}/write/${c.id}` : `/b/${id}/read/${c.id}`}>
                      <span className="t" dir="auto">{c.title}</span><span className="dots" aria-hidden="true" />
                      <span className="w">{c.words.toLocaleString()} {t.words}</span>
                    </Link>
                  ) : (
                    <span className="ch"><span className="t" dir="auto">{c.title}</span><span className="dots" aria-hidden="true" /><span className="state draft">{t.comingSoon}</span></span>
                  )}
                  {owner && <span className={`state ${c.isPublic ? 'pub' : 'draft'}`}>{c.isPublic ? t.published : t.draft}</span>}
                  {owner && (
                    <span className="tools">
                      <button type="button" className="btn btn-sm btn-icon" onClick={() => setPublished(c.id, !c.isPublic)} aria-pressed={c.isPublic}
                        aria-label={`${c.isPublic ? t.unpublishChapter : t.publishChapter}: ${c.title}`} title={c.isPublic ? t.unpublishChapter : t.publishChapter}>
                        {c.isPublic ? <Eye size={17} aria-hidden="true" /> : <EyeSlash size={17} aria-hidden="true" />}
                      </button>
                      <Link className="btn btn-sm btn-icon" to={`/b/${id}/read/${c.id}`} aria-label={`${t.read}: ${c.title}`} title={t.read}><BookOpen size={17} aria-hidden="true" /></Link>
                      <button type="button" className="btn btn-sm btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${t.moveUp}: ${c.title}`} title={t.moveUp}><ArrowUp size={17} aria-hidden="true" /></button>
                      <button type="button" className="btn btn-sm btn-icon" disabled={i === book.chapters.length - 1} onClick={() => move(i, 1)} aria-label={`${t.moveDown}: ${c.title}`} title={t.moveDown}><ArrowDown size={17} aria-hidden="true" /></button>
                      <button type="button" className="btn btn-sm btn-icon" onClick={() => removeChapter(c.id)} aria-label={`${t.deleteChapter}: ${c.title}`} title={t.deleteChapter}><Trash size={17} aria-hidden="true" /></button>
                    </span>
                  )}
                </li>
                {owner && i < book.chapters.length - 1 && (
                  <li className="insert" aria-hidden={false}>
                    <button type="button" className="btn" onClick={() => addChapter({ after: c.id })}>
                      <Plus size={12} aria-hidden="true" /> {t.addAfter} {i + 1}
                    </button>
                  </li>
                )}
                </Fragment>
              ))}
            </ol>
          )}
          {owner && (
            <div className="add" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => addChapter()}><Plus size={18} aria-hidden="true" /> {t.addChapter}</button>
              {book.chapters.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => addChapter({ position: 'start' })}>{t.addAtStart}</button>}
            </div>
          )}
        </div>

        {owner && book.chapters.length > 0 && (
          <div className="row">
            <Link className="btn" to={`/b/${id}/write/${book.chapters[book.chapters.length - 1].id}`}><PencilSimpleLine size={18} aria-hidden="true" /> {t.continueWriting}</Link>
          </div>
        )}
        {owner && book.chapters.length > 0 && (
          <div className="panel">
            <h2>{t.exportBook}</h2>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: '.88rem' }}>{t.exportHint}</p>
            <div className="export-row">
              <Link className="btn" to={`/b/${id}/print`}><FilePdf size={18} aria-hidden="true" /> {t.exportPdf}</Link>
              <button type="button" className="btn" onClick={exportDoc}><FileDoc size={18} aria-hidden="true" /> {t.exportDoc}</button>
            </div>
          </div>
        )}
        {owner && (
          <div className="row" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(233,201,138,.12)' }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={async () => {
              if (!confirm(t.confirmDeleteBook)) return;
              await api(`/books/${id}`, { method: 'DELETE' }); nav('/desk');
            }}><Trash size={16} aria-hidden="true" /> {t.deleteBook}</button>
          </div>
        )}
      </section>
    </main>
  );
};
