import Link from 'next/link';
import { Logo } from './Icons';

export function SiteFooter() {
  return (
    <footer className="public-foot">
      <div className="public-foot-inner">
        <span>© {new Date().getFullYear()} Nissali — Entre sœurs, au service de leur santé.</span>
        <nav aria-label="Liens utiles">
          <Link href="/marketing">Devenir praticienne</Link>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Confidentialité</Link>
          <Link href="/connexion">Connexion</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function PublicShell({ children }) {
  return (
    <div className="public">
      <header className="public-nav">
        <Link href="/marketing" className="public-brand">
          <span className="brand-mark">
            <Logo size={20} />
          </span>
          Nissali
        </Link>
        <nav className="public-nav-links">
          <Link href="/marketing">Devenir praticienne</Link>
          <Link href="/support">Support</Link>
          <Link href="/connexion" className="btn sm">
            Se connecter
          </Link>
        </nav>
      </header>
      <main className="public-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
