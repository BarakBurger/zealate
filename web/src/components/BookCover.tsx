import { Link } from 'react-router-dom';
import { coverUrl } from '../lib/api';
import { useI18n } from '../lib/i18n';

/** Cloth colours for books without an uploaded cover; each book always gets the same one. */
const CLOTH = [
  ['#6b2b1a', '#4a1c10'], ['#1f3a5f', '#14263f'], ['#2f4a35', '#1d3022'], ['#7a5a1c', '#553d10'],
  ['#4b2a4f', '#321b35'], ['#2b2b2b', '#161616'], ['#7a2e3a', '#561e28'], ['#355a5a', '#223d3d'],
];
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

type B = { id: string; title: string; author: string | null; hasCover: boolean; updatedAt: string };

export const Cover = ({ book }: { book: B }) => {
  const { t } = useI18n();
  const [a, b] = CLOTH[hash(book.id) % CLOTH.length];
  return (
    <div className="book3d">
      <div className="pages-edge" aria-hidden="true" />
      <div className="cover">
        {book.hasCover
          ? <img src={coverUrl(book)} alt="" loading="lazy" />
          : (
            <div className="gen-cover" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }} aria-hidden="true">
              <span className="frame" />
              <span className="orn">✦ ✦ ✦</span>
              <h3 dir="auto">{book.title || t.untitled}</h3>
              <span className="who" dir="auto">{book.author || ''}</span>
            </div>
          )}
      </div>
    </div>
  );
};

export const BookCard = ({ book, to, sub }: { book: B; to: string; sub?: string }) => {
  const { t } = useI18n();
  return (
    <Link to={to} className="book-card">
      <Cover book={book} />
      <div className="book-meta">
        <h3 dir="auto">{book.title || t.untitled}</h3>
        <p dir="auto">{sub ?? (book.author ? `${t.by} ${book.author}` : t.anonymous)}</p>
      </div>
    </Link>
  );
};
