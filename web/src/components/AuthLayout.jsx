'use client';
import Link from 'next/link';
import Icon, { Logo } from './Icons';

const POINTS = [
  'Un annuaire réservé aux femmes musulmanes, entre sœurs',
  'Agenda, prestations, visio et fiches clientes au même endroit',
  'Un seul compte pour ton espace pro et ton suivi personnel',
];

export default function AuthLayout({ children, wide = false }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark" style={{ background: 'rgba(255,255,255,.12)' }}>
            <Logo />
          </span>
          <div>
            <strong style={{ fontSize: 24 }}>Nissali</strong>
            <small>Espace pro & équipe</small>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1>Entre sœurs, au service de leur santé.</h1>
          <p style={{ marginTop: 14 }}>Psychologues, sages-femmes, praticiennes en hijama, diététiciennes : développez votre activité auprès des utilisatrices de Nissali.</p>
          <div className="auth-points">
            {POINTS.map((p) => (
              <div key={p} className="auth-point">
                <Icon name="check" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="small" style={{ color: 'var(--rose)', position: 'relative', zIndex: 1 }}>
          Une question ? nissali@gmail.com
        </p>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="brand-mark">
              <Logo />
            </span>
            Nissali
          </div>
          {wide ? children : <div className="auth-panel">{children}</div>}
          <nav className="auth-links" aria-label="Liens utiles">
            <Link href="/support">Support</Link>
            <Link href="/privacy">Confidentialité</Link>
            <Link href="/marketing">Devenir praticienne</Link>
          </nav>
        </div>
      </section>
    </div>
  );
}
