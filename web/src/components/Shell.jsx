'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import Icon, { Logo } from './Icons';
import { Avatar, Loading } from './ui';

/** Lien d'une notification (envoyé par l'API) → page de l'espace pro web. */
function webRoute(link) {
  if (!link || !link.startsWith('/')) return null;
  const msg = link.match(/^\/messages\/([a-f0-9]{24})/i);
  if (msg) return `/pro/messages?c=${msg[1]}`;
  if (link.startsWith('/pro') || link.startsWith('/admin')) return link;
  return null; // pages de l'appli mobile
}

const ADMIN_NAV = [
  ['Pilotage', [['/admin', 'Tableau de bord', 'dashboard'], ['/admin/utilisatrices', 'Utilisatrices', 'users'], ['/admin/notifications', 'Notifications push', 'megaphone']]],
  [
    'Praticiennes',
    [
      ['/admin/praticiennes', 'Praticiennes', 'stethoscope'],
      ['/admin/abonnements', 'Abonnements', 'card'],
      ['/admin/formules', 'Formules', 'layers'],
      ['/admin/specialites', 'Catégories', 'tag'],
      ['/admin/reservations', 'Réservations', 'calendar'],
      ['/admin/avis', 'Avis', 'star'],
      ['/admin/signalements', 'Signalements', 'flag'],
    ],
  ],
  ['Contenus', [['/admin/blog', 'Magazine', 'book'], ['/admin/evenements', 'Événements', 'sparkle'], ['/admin/nissaplace', 'Demandes NissaPlace', 'tag'], ['/admin/conseils', 'Conseils santé', 'heart'], ['/admin/rappels', 'Dhikr et petit rappel', 'quote']]],
  ['Référentiel', [['/admin/mosquees', 'Mosquées', 'home'], ['/admin/parametres', 'Paramètres', 'settings'], ['/admin/journal', 'Journal d’audit', 'history']]],
];

const PRO_NAV = [
  ['Mon activité', [['/pro', 'Tableau de bord', 'dashboard'], ['/pro/reservations', 'Rendez-vous', 'calendar'], ['/pro/messages', 'Messages', 'mail'], ['/pro/clientes', 'Fiches clientes', 'users'], ['/pro/avis', 'Avis', 'star']]],
  ['Mon offre', [['/pro/prestations', 'Prestations', 'briefcase'], ['/pro/disponibilites', 'Disponibilités', 'clock'], ['/pro/profil', 'Profil public', 'user'], ['/pro/abonnement', 'Abonnement', 'card']]],
  ['Mon compte', [['/pro/securite', 'Connexion et sécurité', 'shield']]],
];

function useOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const router = useRouter();
  useOutside(box, () => setOpen(false));
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return undefined;
    }
    const t = setTimeout(() => api.get(`/admin/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => setRes(null)), 250);
    return () => clearTimeout(t);
  }, [q]);
  const go = (href) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  return (
    <div className="search" ref={box}>
      <Icon name="search" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Rechercher une utilisatrice, une praticienne…" aria-label="Recherche" />
      {open && res ? (
        <div className="popover" role="listbox">
          {!res.users.length && !res.practitioners.length ? <div className="pop-empty">Aucun résultat pour « {q} »</div> : null}
          {res.practitioners.length ? <div className="pop-title">Praticiennes</div> : null}
          {res.practitioners.map((p) => (
            <button key={p.id} className="pop-item" onClick={() => go(`/admin/praticiennes/${p.id}`)}>
              <Avatar name={p.displayName} />
              <span>
                {p.displayName}
                <small>
                  {p.specialty} · {p.city}
                </small>
              </span>
            </button>
          ))}
          {res.users.length ? <div className="pop-title">Utilisatrices</div> : null}
          {res.users.map((u) => (
            <button key={u.id} className="pop-item" onClick={() => go(`/admin/utilisatrices?q=${encodeURIComponent(u.contact || u.firstName)}`)}>
              <Avatar name={u.firstName} />
              <span>
                {u.firstName || '—'}
                <small>{[u.contact, u.city].filter(Boolean).join(' · ')}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Bell({ area }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const box = useRef(null);
  useOutside(box, () => setOpen(false));
  useEffect(() => {
    const load = () =>
      (area === 'admin'
        ? Promise.all([api.get('/admin/stats'), api.get('/admin/events?status=en_attente').catch(() => null)]).then(([s, e]) => setData({ tasks: s.tasks, events: e?.counts?.en_attente || 0 }))
        : api.get('/notifications').then((n) => setData(n))
      ).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [area]);
  const count = area === 'admin' ? (data?.tasks ? data.tasks.practitioners + data.tasks.subscriptions + data.tasks.articles + (data.tasks.nissaplace || 0) + (data.events || 0) : 0) : data?.unread || 0;
  const markRead = () => area === 'pro' && data?.unread && api.post('/notifications/read-all').then(() => setData((d) => ({ ...d, unread: 0 })));
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button className="icon-btn" aria-label={`Notifications${count ? ` (${count})` : ''}`} onClick={() => { setOpen((o) => !o); markRead(); }}>
        <Icon name="bell" />
        {count ? <span className="dot-badge" /> : null}
      </button>
      {open ? (
        <div className="popover" style={{ width: 340 }}>
          {area === 'admin' ? (
            <>
              <div className="pop-title">À traiter</div>
              {[
                ['/admin/praticiennes', 'Praticiennes à valider', data?.tasks?.practitioners],
                ['/admin/abonnements', 'Paiements à confirmer', data?.tasks?.subscriptions],
                ['/admin/blog', 'Articles à valider', data?.tasks?.articles],
                ['/admin/evenements', 'Événements à valider', data?.events],
                ['/admin/nissaplace', 'Demandes NissaPlace', data?.tasks?.nissaplace],
              ].map(([href, label, n]) => (
                <Link key={href} href={href} className="pop-item" onClick={() => setOpen(false)}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <strong>{n ?? 0}</strong>
                </Link>
              ))}
            </>
          ) : data?.items?.length ? (
            <>
              <div className="pop-title">Notifications</div>
              {data.items.slice(0, 8).map((n) => {
                const href = webRoute(n.link);
                const body = (
                  <span style={{ flex: 1 }}>
                    {!n.read ? <span className="dot-inline" /> : null}
                    {n.detail || n.body}
                    <small>{new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                  </span>
                );
                return href ? (
                  <Link key={n.id} href={href} className="pop-item" onClick={() => { setOpen(false); api.post(`/notifications/${n.id}/read`).catch(() => {}); }}>
                    {body}
                    <Icon name="chevronRight" />
                  </Link>
                ) : (
                  <div key={n.id} className="pop-item" style={{ cursor: 'default' }}>{body}</div>
                );
              })}
            </>
          ) : (
            <div className="pop-empty">Aucune notification.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ area, name, sub, photo }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { signOut } = useSession();
  useOutside(box, () => setOpen(false));
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={name} src={photo} />
        <span className="who">
          <strong>{name}</strong>
          <span>{sub}</span>
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <div className="popover" role="menu" style={{ width: 260 }}>
          {area === 'pro' ? (
            <>
              <Link href="/pro/profil" className="pop-item" onClick={() => setOpen(false)}>
                <Icon name="user" size={16} /> Profil public
              </Link>
              <Link href="/pro/securite" className="pop-item" onClick={() => setOpen(false)}>
                <Icon name="shield" size={16} /> Connexion et sécurité
              </Link>
              <div className="pop-empty small" style={{ padding: '8px 10px' }}>
                Ton espace personnel (cycle, prières, jeûnes) est dans l’app mobile Nissali, avec le même compte.
              </div>
            </>
          ) : null}
          <button className="pop-item" onClick={signOut}>
            <Icon name="logout" size={16} /> Se déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Shell({ area, children, badges = {} }) {
  const { status, user, practitioner } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (status === 'anon') router.replace('/connexion');
    else if (status === 'ready' && area === 'admin' && user?.role !== 'admin') router.replace('/');
    else if (status === 'ready' && area === 'pro' && !practitioner) router.replace('/inscription');
  }, [status, area, user, practitioner, router]);

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  if (status !== 'ready' || (area === 'admin' && user?.role !== 'admin') || (area === 'pro' && !practitioner)) {
    return (
      <main className="auth-main">
        <Loading />
      </main>
    );
  }

  const nav = area === 'admin' ? ADMIN_NAV : PRO_NAV;
  const isActive = (href) => (href === `/${area}` ? pathname === href : pathname.startsWith(href));
  const current = nav.flatMap(([section, links]) => links.map((l) => [section, ...l])).find(([, href]) => isActive(href));
  const name = area === 'admin' ? user.firstName || user.email : practitioner.displayName;
  const sub = area === 'admin' ? 'Administratrice' : `Formule ${practitioner.plan?.name || 'Découverte'}`;

  return (
    <div className="shell">
      <div className={`nav-backdrop ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside id="app-sidebar" className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Navigation principale">
        <div className="brand">
          <span className="brand-mark">
            <Logo />
          </span>
          <div>
            <strong>Nissali</strong>
            <small>{area === 'admin' ? 'Back-office' : 'Espace pro'}</small>
          </div>
          <button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="Fermer le menu">
            <Icon name="close" />
          </button>
        </div>
        <nav>
          {nav.map(([section, links]) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {links.map(([href, label, icon]) => (
                <Link key={href} href={href} className={`nav-link ${isActive(href) ? 'active' : ''}`} aria-current={isActive(href) ? 'page' : undefined} onClick={() => setNavOpen(false)}>
                  <Icon name={icon} />
                  {label}
                  {badges[href] ? <span className="count">{badges[href]}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {area === 'pro' ? (
          <p className="sidebar-hint" style={{ marginTop: 'auto' }}>
            Même compte que l’app mobile : bascule vers ton espace personnel depuis l’app.
          </p>
        ) : null}
        <div className="sidebar-card" style={{ marginTop: area === 'pro' ? 12 : 'auto' }}>
          <Avatar name={name} src={area === 'pro' ? practitioner.photoUrl : undefined} />
          <div className="who">
            <strong>{name}</strong>
            <span>{sub}</span>
          </div>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="nav-toggle icon-btn" aria-label="Ouvrir le menu" aria-controls="app-sidebar" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="topbar-brand">
            <span className="brand-mark">
              <Logo />
            </span>
            <strong>{area === 'admin' ? 'Back-office' : 'Espace pro'}</strong>
          </div>
          <div className="crumbs">
            <span>{area === 'admin' ? 'Back-office' : 'Espace pro'}</span>
            {current ? (
              <>
                <Icon name="chevronRight" />
                <span>{current[0]}</span>
                <Icon name="chevronRight" />
                <strong>{current[2]}</strong>
              </>
            ) : null}
          </div>
          <div className="topbar-actions">
            {area === 'admin' ? <GlobalSearch /> : null}
            <Bell area={area} />
            <UserMenu area={area} name={name} sub={sub} photo={area === 'pro' ? practitioner.photoUrl : undefined} />
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
