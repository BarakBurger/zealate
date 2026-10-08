import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

export const NotFound = () => {
  const { t } = useI18n();
  return (
    <main id="main" className="center">
      <div style={{ textAlign: 'center' }}>
        <p className="eyebrow">404</p>
        <h1 style={{ fontSize: '2.4rem', margin: '10px 0 22px' }}>{t.notFound}</h1>
        <Link to="/" className="btn btn-primary">{t.toHome}</Link>
      </div>
    </main>
  );
};
