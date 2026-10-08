import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PenNib } from '@phosphor-icons/react';
import { api, type SearchHit } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { BookCard } from '../components/BookCover';
import { SearchBox } from '../components/SearchBox';

export const Home = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    let live = true;
    setHits(null);
    api<{ results: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}`).then(r => live && setHits(r.results)).catch(() => live && setHits([]));
    return () => { live = false; };
  }, [q]);

  return (
    <main id="main">
      {!q && (
        <section className="hero">
          <div className="fade-in">
            <p className="eyebrow">{t.tagline}</p>
            <h1 style={{ marginTop: 14 }}>
              {lang === 'he' ? <>הספר הבא שלך מתחיל <em>בדף אחד</em></> : <>Your next book starts with <em>one page</em></>}
            </h1>
            <p>{t.heroBody}</p>
            <Link to={user ? '/desk' : '/signup'} className="btn btn-primary"><PenNib size={20} aria-hidden="true" /> {t.startWriting}</Link>
            <div className="hero-search"><SearchBox autoFocus /></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-page" />
            <div className="hero-page">
              <h3>{lang === 'he' ? 'פרק ראשון' : 'Chapter One'}</h3>
              {(lang === 'he'
                ? ['הדלת נפתחה לפני שהספקתי לדפוק. מאחוריה עמדה אישה שלא ראיתי עשרים שנה, ובידה מכתב שכתבתי ולא שלחתי מעולם.', 'היא לא אמרה שלום. היא רק הושיטה לי את המעטפה וחיכתה שאקרא בקול.', 'השעון במסדרון עצר באותו רגע, או שאולי רק אני הפסקתי לשמוע אותו.']
                : ['The door opened before I could knock. Behind it stood a woman I had not seen in twenty years, holding a letter I wrote and never sent.', 'She did not say hello. She only held out the envelope and waited for me to read it aloud.', 'The clock in the hall stopped at that moment, or perhaps I simply stopped hearing it.']
              ).map((p, i) => <p key={i}>{p}</p>)}
              <span className="folio">1</span>
            </div>
          </div>
        </section>
      )}

      <section id="shelf" aria-labelledby="shelf-h">
        <div className="shelf-head">
          <h2 id="shelf-h">{q ? `“${q}”` : t.publicShelf}</h2>
          {q && <Link to="/" className="btn btn-ghost btn-sm">✕</Link>}
        </div>
        {q && <div style={{ maxWidth: 520, marginBottom: 28 }}><SearchBox /></div>}
        {hits === null ? <div className="center"><div className="spinner" role="status" aria-label={t.loading} /></div>
          : hits.length === 0 ? <p className="empty">{q ? t.noResults : t.emptyShelf}</p>
          : (
            <div className="shelf">
              {hits.map((b, i) => (
                <div key={b.id} className="fade-in" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                  <BookCard book={b} to={`/b/${b.id}`}
                    sub={`${b.author ? `${t.by} ${b.author}` : t.anonymous} · ${b.chapterCount} ${t.chapters}`} />
                </div>
              ))}
            </div>
          )}
      </section>
    </main>
  );
};
