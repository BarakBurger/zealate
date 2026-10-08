import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FilePdf } from '@phosphor-icons/react';
import { api, type Book, type Chapter } from '../lib/api';
import { textDir, textLang, useI18n } from '../lib/i18n';
import { paragraphsOf } from '../lib/bookText';
import { NotFound } from './NotFound';

/**
 * The whole book laid out for print at the trim size (5.5 x 8.5 in): a title page, each chapter
 * opening on a new page, and page numbers in the bottom margin. "Save as PDF" in the browser's
 * print window turns it into the PDF.
 */
export const PrintBook = () => {
  const { id = '' } = useParams();
  const { t, dir: uiDir } = useI18n();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([api<{ book: Book }>(`/books/${id}`), api<{ chapters: Chapter[] }>(`/books/${id}/chapters`)])
      .then(([b, c]) => { if (!b.book.isOwner) { setMissing(true); return; } setBook(b.book); setChapters(c.chapters); document.title = b.book.title; })
      .catch(() => setMissing(true));
  }, [id]);
  useEffect(() => {
    document.body.classList.add('printing');
    return () => document.body.classList.remove('printing');
  }, []);

  if (missing) return <NotFound />;
  if (!book || !chapters) return <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>;
  const dir = textDir(`${book.title} ${chapters[0]?.body.slice(0, 400) || ''}`, uiDir);
  const Back = uiDir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <main id="main" className="print-root">
      <div className="print-controls">
        <Link to={`/b/${id}`} className="btn btn-ghost btn-sm"><Back size={16} aria-hidden="true" /> {t.backToBook}</Link>
        <span className="muted" style={{ flex: 1, fontSize: '.9rem' }}>{t.printHint}</span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><FilePdf size={18} aria-hidden="true" /> {t.printNow}</button>
      </div>
      <article className="print-book" dir={dir} lang={textLang(`${book.title} ${chapters[0]?.body.slice(0, 400) || ''}`)}>
        <section className="print-title">
          <h1 dir="auto">{book.title}</h1>
          {(book.authorName || book.author || book.ownerDisplay) && <p dir="auto">{book.authorName || book.author || book.ownerDisplay}</p>}
        </section>
        {chapters.map((c, i) => {
          const paras = paragraphsOf(c.body);
          const firstText = paras.findIndex(p => p.trim());
          return (
            <section key={c.id} className="print-chapter flow">
              <span className="chap-no">{t.chapter} {i + 1}</span>
              <h1 dir="auto">{c.title}</h1>
              {paras.map((p, j) => p.trim()
                ? <p key={j} dir="auto" className={j === firstText ? 'first' : undefined}>{p}</p>
                : <p key={j} className="blank" />)}
            </section>
          );
        })}
      </article>
    </main>
  );
};
