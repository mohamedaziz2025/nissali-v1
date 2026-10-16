'use client';
// Inscription praticienne : compte vérifié par code OTP envoyé par e-mail,
// choix de la formule d'abonnement, puis profil professionnel.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { Chips, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { euros } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useFetch } from '@/lib/useFetch';

export default function ProSignup() {
  const { status, user, practitioner, signIn, refresh } = useSession();
  const router = useRouter();
  const { data: meta } = useFetch('/practitioners/status');
  const [step, setStep] = useState('compte');
  const [account, setAccount] = useState({ firstName: '', identifier: '', terms: false, marketing: false });
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [billing, setBilling] = useState('mensuel');
  const [plan, setPlan] = useState('decouverte');
  const [pro, setPro] = useState({ displayName: '', specialty: '', city: '', address: '', description: '', siret: '', inPerson: true, supportsVideo: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'ready' && practitioner) router.replace('/pro');
    else if (status === 'ready' && user && step === 'compte') {
      setStep('formule');
      setPro((p) => ({ ...p, displayName: p.displayName || `${user.firstName || ''} `.trim(), city: p.city || user.city?.name || '' }));
    }
  }, [status, user, practitioner, router, step]);

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

  const sendCode = (e) => {
    e.preventDefault();
    run(async () => setSent(await api.post('/auth/otp', { identifier: account.identifier, purpose: 'register' })));
  };
  const createAccount = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.post('/auth/register', {
        identifier: account.identifier,
        code,
        accountType: 'pro',
        firstName: account.firstName,
        consents: { terms: true, marketingEmail: account.marketing, marketingSms: account.marketing, marketingWhatsapp: account.marketing },
      });
      signIn(r);
      setPro((p) => ({ ...p, displayName: account.firstName }));
      setStep('formule');
    });
  };
  const submitPro = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/pro/register', { ...pro, plan, billing });
      await refresh();
      router.replace(user?.hasPassword ? '/pro' : '/pro/securite?bienvenue=1');
    });
  };

  return (
    <AuthLayout>
      {step === 'compte' ? (
        <>
          <h1>Devenir praticienne</h1>
          <p className="muted">Un seul compte pour ton espace pro et ton suivi personnel dans l’app mobile Nissali.</p>
          {!sent ? (
            <form className="stack" onSubmit={sendCode}>
              <Field label="Prénom">
                <input className="input" value={account.firstName} onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value }))} required />
              </Field>
              <Field label="Adresse e-mail" hint="Nous t’envoyons un code de vérification. Ton numéro de téléphone est facultatif (profil).">
                <input className="input" type="email" value={account.identifier} onChange={(e) => setAccount((a) => ({ ...a, identifier: e.target.value }))} required autoComplete="email" />
              </Field>
              <label className="check">
                <input type="checkbox" checked={account.terms} onChange={(e) => setAccount((a) => ({ ...a, terms: e.target.checked }))} />
                <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={account.marketing} onChange={(e) => setAccount((a) => ({ ...a, marketing: e.target.checked }))} />
                <span>J’accepte de recevoir les actualités de Nissali (facultatif).</span>
              </label>
              {error ? <p className="error">{error}</p> : null}
              <button className="btn block" disabled={busy || !account.terms}>
                Recevoir mon code
              </button>
              <p className="muted small">
                Déjà un compte Nissali ? <Link href="/connexion">Connecte-toi</Link> : tu pourras créer ton profil pro ensuite.
              </p>
            </form>
          ) : (
            <form className="stack" onSubmit={createAccount}>
              <p className="muted">
                Code envoyé à <strong>{sent.target}</strong>.
              </p>
              <input className="input code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus aria-label="Code à 6 chiffres" />
              {sent.devCode ? <p className="muted small">Mode développement — code : {sent.devCode}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button className="btn block" disabled={busy || code.length !== 6}>
                Créer mon compte
              </button>
            </form>
          )}
        </>
      ) : step === 'formule' ? (
        <div className="stack">
          <h1>Choisis ta formule</h1>
          <div className="tabs">
            <button className={billing === 'mensuel' ? 'on' : ''} onClick={() => setBilling('mensuel')}>
              Mensuel
            </button>
            <button className={billing === 'annuel' ? 'on' : ''} onClick={() => setBilling('annuel')}>
              Annuel (2 mois offerts)
            </button>
          </div>
          {(meta?.plans || []).map((p) => {
            const amount = billing === 'annuel' ? p.priceYearly : p.priceMonthly;
            return (
              <button key={p.key} type="button" className={`plan-card ${plan === p.key ? 'on' : ''}`} onClick={() => setPlan(p.key)} aria-pressed={plan === p.key}>
                <div className="row between">
                  <h3>{p.name}</h3>
                  <span className="price">
                    {amount ? euros(amount) : 'Gratuit'}
                    {amount ? <small className="muted small">{billing === 'annuel' ? ' / an' : ' / mois'}</small> : null}
                  </span>
                </div>
                <span className="muted small">{p.tagline}</span>
                <ul>
                  {(p.highlights || []).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </button>
            );
          })}
          <p className="muted small">Les formules payantes sont activées par l’équipe après règlement. Tu peux commencer gratuitement.</p>
          <button className="btn block" onClick={() => setStep('profil')}>
            Continuer
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submitPro}>
          <h1>Ton profil pro</h1>
          <Field label="Nom affiché">
            <input className="input" value={pro.displayName} onChange={(e) => setPro((p) => ({ ...p, displayName: e.target.value }))} required minLength={2} />
          </Field>
          <Field label="Spécialité">
            <Chips items={meta?.categories || []} value={pro.specialty} onChange={(v) => setPro((p) => ({ ...p, specialty: v }))} />
          </Field>
          <div className="grid grid-2">
            <Field label="Ville d’exercice">
              <input className="input" value={pro.city} onChange={(e) => setPro((p) => ({ ...p, city: e.target.value }))} required />
            </Field>
            <Field label="SIRET (facultatif)">
              <input className="input" value={pro.siret} onChange={(e) => setPro((p) => ({ ...p, siret: e.target.value }))} />
            </Field>
          </div>
          <Field label="Adresse du cabinet (facultatif)">
            <input className="input" value={pro.address} onChange={(e) => setPro((p) => ({ ...p, address: e.target.value }))} />
          </Field>
          <Field label="Présentation">
            <textarea className="textarea" value={pro.description} onChange={(e) => setPro((p) => ({ ...p, description: e.target.value }))} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={pro.inPerson} onChange={(e) => setPro((p) => ({ ...p, inPerson: e.target.checked }))} />
            <span>Consultations au cabinet</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={pro.supportsVideo} onChange={(e) => setPro((p) => ({ ...p, supportsVideo: e.target.checked }))} />
            <span>Consultations en visio (formules Essentiel et Premium)</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy || !pro.specialty}>
            Créer mon espace pro
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep('formule')}>
            Changer de formule
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
