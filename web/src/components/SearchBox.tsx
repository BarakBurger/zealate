import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useI18n } from '../lib/i18n';

export const SearchBox = ({ autoFocus = false }: { autoFocus?: boolean }) => {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const nav = useNavigate();
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  return (
    <form role="search" className="search" onSubmit={e => { e.preventDefault(); nav(q.trim() ? `/?q=${encodeURIComponent(q.trim())}#shelf` : '/#shelf'); }}>
      <MagnifyingGlass size={18} aria-hidden="true" />
      <label className="sr-only" htmlFor={autoFocus ? 'q-hero' : 'q-bar'}>{t.search}</label>
      <input id={autoFocus ? 'q-hero' : 'q-bar'} className="input" type="search" dir="auto" value={q}
        onChange={e => setQ(e.target.value)} placeholder={t.searchPlaceholder} autoComplete="off" />
    </form>
  );
};
