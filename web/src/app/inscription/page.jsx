'use client';
// Inscription praticienne : compte vérifié par un code envoyé par e-mail, essai gratuit (ou formule
// payante), puis profil professionnel. Sans formule payante proposée, l'essai démarre directement.
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
  const [plan, setPlan] = useState(null); // null : essai gratuit (ou formule gratuite)
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
  const trial = meta?.trial || null;
  // Avec un essai gratuit, les formules gratuites ne se choisissent pas : l'essai les inclut puis y bascule.
  const plans = (meta?.plans || []).filter((p) => !trial || p.priceMonthly > 0 || p.priceYearly > 0);
  const choosePlan = plans.length > 0 && Boolean(trial || plans.length > 1);
  const view = step === 'formule' && meta && !choosePlan ? 'profil' : step;
  const onTrial = !plan && Boolean(trial);
  const selected = plan ? (meta?.plans || []).find((p) => p.key === plan) : trial || (meta?.plans || []).find((p) => p.key === 'decouverte') || plans[0];

  const submitPro = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/pro/register', { ...pro, ...(plan || (!trial && selected) ? { plan: plan || selected.key } : {}), billing });
      await refresh();
      router.replace(user?.hasPassword ? '/pro' : '/pro/securite?bienvenue=1');
    });
  };

  return (
    <AuthLayout>
      {view === 'compte' ? (
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
              {error ? <p className="error">{error}</p> : null}
              <button className="btn block" disabled={busy || code.length !== 6}>
                Créer mon compte
              </button>
            </form>
          )}
        </>
      ) : view === 'formule' ? (
        <div className="stack">
          <h1>Choisis ta formule</h1>
          {trial ? (
            <>
              <TrialBox trial={trial} selected={!plan} onSelect={() => setPlan(null)} />
              <p className="muted small" style={{ margin: '4px 0 0', fontWeight: 600 }}>Ou choisis directement une formule</p>
            </>
          ) : null}
          <div className="tabs">
            <button className={billing === 'mensuel' ? 'on' : ''} onClick={() => setBilling('mensuel')}>
              Mensuel
            </button>
            <button className={billing === 'annuel' ? 'on' : ''} onClick={() => setBilling('annuel')}>
              Annuel (2 mois offerts)
            </button>
          </div>
          {plans.map((p) => {
            const amount = billing === 'annuel' ? p.priceYearly : p.priceMonthly;
            const on = plan === p.key || (!plan && !trial && selected?.key === p.key);
            return (
              <button key={p.key} type="button" className={`plan-card ${on ? 'on' : ''}`} onClick={() => setPlan(p.key)} aria-pressed={on}>
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
          <p className="muted small">
            {trial ? 'Pendant l’essai, tu profites des fonctionnalités ci-dessus. À la fin, tu passes sur la formule gratuite, sauf si tu choisis une formule. ' : ''}
            Les formules payantes s’activent après règlement. Tu peux changer de formule à tout moment.
          </p>
          <button className="btn block" onClick={() => setStep('profil')}>
            {onTrial ? 'Commencer mon essai gratuit' : 'Continuer'}
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submitPro}>
          <h1>Ton profil pro</h1>
          {onTrial ? <TrialBox trial={trial} active /> : null}
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
            <span>Consultations en visio{selected?.features?.video ? '' : ' (non incluses dans cette formule)'}</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy || !pro.specialty}>
            {onTrial ? 'Créer mon espace pro gratuitement' : 'Créer mon espace pro'}
          </button>
          {choosePlan ? (
            <button type="button" className="btn ghost" onClick={() => setStep('formule')}>
              Changer de formule
            </button>
          ) : null}
        </form>
      )}
    </AuthLayout>
  );
}

/** Essai gratuit de l'espace pro : durée et fonctionnalités réglées par l'équipe dans le back-office. */
function TrialBox({ trial, selected = true, onSelect, active }) {
  const Tag = onSelect ? 'button' : 'div';
  return (
    <Tag type={onSelect ? 'button' : undefined} className={`plan-card trial-card ${selected ? 'on' : ''}`} onClick={onSelect} aria-pressed={onSelect ? selected : undefined}>
      <div className="row between">
        <h3>{active ? 'Tu es en essai gratuit' : trial.name}</h3>
        <span className="price">Gratuit</span>
      </div>
      <span className="muted small">{trial.trialDays ? `${trial.trialDays} jours offerts` : 'Offert'} · sans carte bancaire, sans engagement</span>
      <span className="small" style={{ fontWeight: 600 }}>Fonctionnalités incluses pendant l’essai :</span>
      <ul>
        {(trial.included || []).map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </Tag>
  );
}
