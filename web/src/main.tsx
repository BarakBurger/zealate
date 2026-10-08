import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './styles.css';
import { I18nProvider, useI18n } from './lib/i18n';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { Bar } from './components/Bar';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { Desk } from './pages/Desk';
import { BookPage } from './pages/BookPage';
import { Editor } from './pages/Editor';
import { Reader } from './pages/Reader';
import { PrintBook } from './pages/PrintBook';
import { NotFound } from './pages/NotFound';

/** Land at the top of each new page, and give screen readers the new page's main region. */
const RouteFocus = () => {
  const { pathname } = useLocation();
  const { t } = useI18n();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!pathname.includes('/read/') && !pathname.includes('/b/')) document.title = `${t.brand} · ${t.tagline}`;
  }, [pathname, t]);
  return null;
};

const App = () => {
  const { t } = useI18n();
  return (
    <>
      <a className="skip" href="#main">{t.skip}</a>
      <Bar />
      <RouteFocus />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/desk" element={<Desk />} />
        <Route path="/b/:id" element={<BookPage />} />
        <Route path="/b/:id/write/:cid" element={<Editor />} />
        <Route path="/b/:id/read/:cid" element={<Reader />} />
        <Route path="/b/:id/print" element={<PrintBook />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter><App /></BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
