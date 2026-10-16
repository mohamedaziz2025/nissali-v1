'use client';
// Connexion et sécurité : code toujours disponible, mot de passe facultatif.
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Field, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

function SecurityContent() {
  const welcome = useSearchParams().get('bienvenue') === '1';
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useSession();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasPassword = Boolean(user?.hasPassword);

  const run = async (fn, message) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      toast(message);
      setCurrent('');
      setPassword('');
      setConfirm('');
      if (welcome) router.replace('/pro');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    run(() => api.put('/me/password', { password, ...(hasPassword ? { currentPassword: current } : {}) }), hasPassword ? 'Mot de passe changé' : 'Mot de passe créé');
  };

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>{welcome ? 'Ta connexion' : 'Connexion et sécurité'}</h1>
          <p>{welcome ? 'Ton espace pro est créé. Comment préfères-tu te connecter la prochaine fois ?' : 'Le même compte sert à l’espace pro et à l’app mobile.'}</p>
        </div>
      </div>
      <div className="card stack">
        <div className="label">Connexion par code</div>
        <p>Toujours disponible : un code à 6 chiffres envoyé à {user?.email || user?.phone}. Rien à retenir.</p>
      </div>
      <form className="card stack" onSubmit={save}>
        <div className="label">Mot de passe {hasPassword ? '· activé' : '· facultatif'}</div>
        {hasPassword ? (
          <Field label="Mot de passe actuel">
            <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
        ) : null}
        <div className="grid grid-2">
          <Field label={hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'} hint="8 caractères minimum">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirmation">
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button className="btn" disabled={busy}>{hasPassword ? 'Changer mon mot de passe' : 'Créer mon mot de passe'}</button>
          {hasPassword && !welcome ? (
            <button type="button" className="btn danger" disabled={busy || !current} onClick={() => run(() => api.delete('/me/password', { currentPassword: current }), 'Connexion par code uniquement')}>
              Supprimer le mot de passe
            </button>
          ) : null}
        </div>
      </form>
      {welcome ? (
        <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => router.replace('/pro')}>
          Garder la connexion par code
        </button>
      ) : null}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityContent />
    </Suspense>
  );
}
