import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowsLeftRight, BookOpen, Eye, FileArrowDown, PenNib, Signature, TreeStructure } from '@phosphor-icons/react';
import { api, type SearchHit } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { BookCard } from '../components/BookCover';
import { SearchBox } from '../components/SearchBox';

const FEATURES = [
  { icon: BookOpen, t: 'f1t', b: 'f1b' }, { icon: TreeStructure, t: 'f2t', b: 'f2b' }, { icon: Eye, t: 'f3t', b: 'f3b' },
  { icon: Signature, t: 'f4t', b: 'f4b' }, { icon: ArrowsLeftRight, t: 'f5t', b: 'f5b' }, { icon: FileArrowDown, t: 'f6t', b: 'f6b' },
] as const;
const STEPS = [['how1t', 'how1b'], ['how2t', 'how2b'], ['how3t', 'how3b']] as const;
const FAQ = [['q1', 'a1'], ['q2', 'a2'], ['q3', 'a3'], ['q4', 'a4'], ['q5', 'a5'], ['q6', 'a6']] as const;

export const Home = () => {
  const { t } = useI18n();
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

  // The questions and answers, as structured data in the language on screen, for search engines.
  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.metaDescription);
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'faq-ld';
    el.text = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map(([qk, ak]) => ({ '@type': 'Question', name: t[qk], acceptedAnswer: { '@type': 'Answer', text: t[ak] } })),
    });
    document.getElementById('faq-ld')?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [t]);

  return (
    <main id="main">
      {!q && (
        <section className="hero">
          <div className="fade-in">
            <p className="eyebrow">{t.tagline}</p>
            <h1 style={{ marginTop: 14 }}>{t.heroTitleA} <em>{t.heroTitleEm}</em></h1>
            <p>{t.heroBody}</p>
            <Link to={user ? '/desk' : '/signup'} className="btn btn-primary"><PenNib size={20} aria-hidden="true" /> {t.startWriting}</Link>
            <div className="hero-search"><SearchBox autoFocus /></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-page" />
            <div className="hero-page">
              <h3>{t.sampleChapter}</h3>
              {[t.sample1, t.sample2, t.sample3].map((p, i) => <p key={i}>{p}</p>)}
              <span className="folio">1</span>
            </div>
          </div>
        </section>
      )}

      <section id="shelf" aria-labelledby="shelf-h">
        <div className="shelf-head">
          <h2 id="shelf-h">{q ? `“${q}”` : t.publicShelf}</h2>
          {q && <Link to="/" className="btn btn-ghost btn-sm" aria-label={t.cancel}>✕</Link>}
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

      {!q && (
        <>
          <section className="features" aria-labelledby="feat-h">
            <h2 id="feat-h">{t.featuresTitle}</h2>
            <ul>
              {FEATURES.map(({ icon: Icon, t: tk, b: bk }) => (
                <li key={tk}>
                  <span className="feat-icon"><Icon size={26} weight="duotone" aria-hidden="true" /></span>
                  <h3>{t[tk]}</h3>
                  <p>{t[bk]}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="how" aria-labelledby="how-h">
            <h2 id="how-h">{t.howTitle}</h2>
            <ol>
              {STEPS.map(([tk, bk], i) => (
                <li key={tk}>
                  <span className="step-no" aria-hidden="true">{i + 1}</span>
                  <h3>{t[tk]}</h3>
                  <p>{t[bk]}</p>
                </li>
              ))}
            </ol>
            <Link to={user ? '/desk' : '/signup'} className="btn btn-primary"><PenNib size={20} aria-hidden="true" /> {t.startWriting}</Link>
          </section>

          <section className="faq" aria-labelledby="faq-h">
            <h2 id="faq-h">{t.faqTitle}</h2>
            {FAQ.map(([qk, ak]) => (
              <details key={qk}>
                <summary>{t[qk]}</summary>
                <p>{t[ak]}</p>
              </details>
            ))}
          </section>
        </>
      )}
    </main>
  );
};
