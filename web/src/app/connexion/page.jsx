'use client';
// Connexion : praticienne (code OTP par e-mail, ou mot de passe) ou équipe Nissali (mot de passe + code).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import Icon from '@/components/Icons';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const RESEND_SECONDS = 45;

/** Code à 6 chiffres : une case par chiffre, collage du code complet, retour arrière. */
function OtpInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);
  const set = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  };
  return (
    <div className="otp" role="group" aria-label="Code à 6 chiffres">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-box ${d.trim() ? 'filled' : ''}`}
          value={d.trim()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Chiffre ${i + 1}`}
          maxLength={6}
          disabled={disabled}
          autoFocus={i === 0}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) return;
            const clean = set((value.slice(0, i) + typed).slice(0, 6));
            refs.current[Math.min(clean.length, 5)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              const cut = d.trim() ? i : Math.max(0, i - 1);
              set(value.slice(0, cut));
              refs.current[cut]?.focus();
            } else if (e.key === 'ArrowLeft') refs.current[Math.max(0, i - 1)]?.focus();
            else if (e.key === 'ArrowRight') refs.current[Math.min(5, i + 1)]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const clean = set(e.clipboardData.getData('text'));
            refs.current[Math.min(clean.length, 5)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

function InputIcon({ icon, children, action }) {
  return (
    <div className="input-icon">
      <Icon name={icon} />
      {children}
      {action}
    </div>
  );
}

export default function Login() {
  const { signIn } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState('pro');
  const [method, setMethod] = useState('code'); // praticienne : code ou mot de passe
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const usesPassword = mode === 'admin' || method === 'password';

  const switchMode = (m) => {
    setMode(m);
    setSent(null);
    setError(null);
    setCode('');
  };

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'pro' && method === 'password') {
        const r = await api.post('/auth/password/login', { identifier, password });
        signIn(r);
        router.replace(r.practitioner ? '/pro' : '/inscription');
        return;
      }
      const r = mode === 'admin' ? await api.post('/auth/admin/login', { email: identifier, password }) : await api.post('/auth/otp', { identifier, purpose: 'login' });
      setSent(r);
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = mode === 'admin' ? await api.post('/auth/admin/verify', { email: identifier, code: value }) : await api.post('/auth/login', { identifier, code: value });
      signIn(r);
      router.replace(r.user.role === 'admin' ? '/admin' : r.practitioner ? '/pro' : '/inscription');
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <header className="auth-head">
        <span className="eyebrow">{mode === 'admin' ? 'Back-office' : 'Espace praticienne'}</span>
        <h1>{sent ? 'Vérifie ton code' : 'Connexion'}</h1>
        <p className="muted">
          {sent
            ? `Nous avons envoyé un code à 6 chiffres par e-mail à ${sent.target}.`
            : mode === 'admin'
              ? 'Accès réservé à l’équipe Nissali, avec double authentification.'
              : 'Heureuse de te revoir. Gère tes rendez-vous, tes clientes et ton profil.'}
        </p>
      </header>

      {!sent ? (
        <>
          <div className="segmented" role="tablist" aria-label="Type de compte">
            <button type="button" role="tab" aria-selected={mode === 'pro'} className={mode === 'pro' ? 'on' : ''} onClick={() => switchMode('pro')}>
              <Icon name="stethoscope" />
              Praticienne
            </button>
            <button type="button" role="tab" aria-selected={mode === 'admin'} className={mode === 'admin' ? 'on' : ''} onClick={() => switchMode('admin')}>
              <Icon name="shield" />
              Équipe Nissali
            </button>
          </div>

          <form className="stack auth-form" onSubmit={send}>
            {mode === 'pro' ? (
              <div className="method-grid" role="radiogroup" aria-label="Méthode de connexion">
                {[
                  { key: 'code', icon: 'mail', title: 'Code unique', text: 'Reçu par e-mail' },
                  { key: 'password', icon: 'lock', title: 'Mot de passe', text: 'Si tu en as un' },
                ].map((m) => (
                  <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`method ${method === m.key ? 'on' : ''}`} onClick={() => { setMethod(m.key); setError(null); }}>
                    <span className="method-icon">
                      <Icon name={m.icon} />
                    </span>
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.text}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <label className="field">
              <span>{mode === 'admin' ? 'E-mail professionnel' : 'E-mail'}</span>
              <InputIcon icon="mail">
                <input
                  className="input lg"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  placeholder={mode === 'admin' ? 'prenom@nissali.app' : 'toi@exemple.com'}
                  required
                  autoFocus
                />
              </InputIcon>
            </label>

            {usesPassword ? (
              <label className="field">
                <span className="field-row">
                  Mot de passe
                  {mode === 'pro' ? <Link href="/mot-de-passe-oublie" className="small">Mot de passe oublié ?</Link> : null}
                </span>
                <InputIcon
                  icon="lock"
                  action={
                    <button type="button" className="input-action" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {showPassword ? 'Masquer' : 'Afficher'}
                    </button>
                  }
                >
                  <input className="input lg" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="8 caractères minimum" required minLength={8} />
                </InputIcon>
              </label>
            ) : null}

            {error ? (
              <div className="alert error" role="alert">
                <Icon name="alert" />
                <span>{error}</span>
              </div>
            ) : null}

            <button className="btn block lg" disabled={busy || identifier.trim().length < 3 || (usesPassword && password.length < 8)}>
              {busy ? 'Un instant…' : mode === 'admin' ? 'Continuer' : method === 'password' ? 'Me connecter' : 'Recevoir mon code'}
              {!busy ? <Icon name="chevronRight" /> : null}
            </button>
            {method === 'code' && mode === 'pro' ? <p className="muted small center">Le code expire au bout de 10 minutes. Aucun mot de passe à retenir.</p> : null}
            {mode === 'admin' ? <p className="muted small center">Un code de vérification est envoyé par e-mail après le mot de passe.</p> : null}
          </form>

          {mode === 'pro' ? (
            <div className="auth-foot">
              <span className="divider">
                <span>Nouvelle sur Nissali ?</span>
              </span>
              <Link href="/inscription" className="btn outline block lg">
                Créer mon espace praticienne
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <form
          className="stack auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
          {sent.devCode ? (
            <p className="dev-code">
              Mode test : code <strong>{sent.devCode}</strong>
            </p>
          ) : null}
          {error ? (
            <div className="alert error" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          ) : null}
          <button className="btn block lg" disabled={busy || code.length !== 6}>
            {busy ? 'Vérification…' : 'Me connecter'}
          </button>
          <div className="otp-actions">
            <button type="button" className="link-btn" onClick={() => { setSent(null); setError(null); }}>
              ← Modifier {mode === 'admin' ? 'mes identifiants' : 'l’adresse'}
            </button>
            {mode === 'pro' ? (
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={() => send()}>
                {wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
