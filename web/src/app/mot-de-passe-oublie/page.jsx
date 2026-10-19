'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function ForgotPassword() {
  const { signIn } = useSession();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Mot de passe oublié</h1>
      {!sent ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => setSent(await api.post('/auth/password/forgot', { identifier }))); }}>
          <p className="muted">Nous t’envoyons un code par e-mail pour choisir un nouveau mot de passe.</p>
          <Field label="Adresse e-mail">
            <input className="input" type="email" inputMode="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy}>Recevoir mon code</button>
        </form>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
            run(async () => {
              const r = await api.post('/auth/password/reset', { identifier, code, password });
              signIn(r);
              router.replace(r.practitioner ? '/pro' : '/inscription');
            });
          }}
        >
          <p className="muted">
            Code envoyé à <strong>{sent.target}</strong>.
          </p>
          <input className="input code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label="Code à 6 chiffres" />
          <Field label="Nouveau mot de passe" hint="8 caractères minimum">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirmation">
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy || code.length !== 6 || password.length < 8}>Enregistrer et me connecter</button>
        </form>
      )}
      <p className="muted small">
        <Link href="/connexion">Retour à la connexion</Link>
      </p>
    </AuthLayout>
  );
}
