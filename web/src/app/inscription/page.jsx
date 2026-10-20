'use client';
// 4.12 — Espace praticienne sur le site Nissali Pro : 4 étapes (colonne bordeaux avec la progression).
// RG-50 : un seul compte — le compte se crée dans l'appli ; ici, connexion puis activité, justificatifs
// et envoi pour vérification. Brouillon et justificatifs sont partagés avec le parcours de l'appli (4.14).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { Chips, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { euros } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useFetch } from '@/lib/useFetch';

const STEP_LABELS = ['Ton compte Nissali', 'Ton activité', 'Tes justificatifs', 'Vérification'];
const DOCS = [
  { kind: 'identity', label: 'Pièce d’identité', required: true, hint: 'Carte d’identité, passeport ou titre de séjour · obligatoire' },
  { kind: 'diploma', label: 'Diplôme ou certificat', hint: 'Facultatif : vérifié, il t’apporte le badge « Diplômée »' },
  { kind: 'rcPro', label: 'Assurance RC Pro', hint: 'Facultatif' },
];

export default function ProSignup() {
  const { status, user, practitioner, refresh } = useSession();
  const router = useRouter();
  const { data: meta } = useFetch('/practitioners/status');
  const { data: profile } = useFetch(status === 'ready' && user ? '/pro-profile' : null);
  const [step, setStep] = useState('compte'); // compte | formule | activite | justificatifs | verification
  const [billing, setBilling] = useState('mensuel');
  const [plan, setPlan] = useState(null); // null : essai gratuit (ou formule gratuite)
  const [pro, setPro] = useState({ specialty: '', otherSpecialty: '', places: { visio: false, domicile: false, cabinet: false }, address: '', city: '', lastName: '', rpps: '', sterile: false });
  const [docs, setDocs] = useState({});
  const [uploading, setUploading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'ready' && practitioner) router.replace('/pro');
    else if (status === 'ready' && user && step === 'compte') setStep('formule');
  }, [status, user, practitioner, router, step]);

  useEffect(() => {
    const d = profile?.draft;
    if (!d) return;
    setDocs(d.documents || {});
    setPro((x) => ({
      ...x,
      city: x.city || profile.city || '',
      ...d.data,
      places: { ...x.places, ...(d.data?.places || {}) },
    }));
  }, [profile]);

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

  const trial = meta?.trial || null;
  // Avec un essai gratuit, les formules gratuites ne se choisissent pas : l'essai les inclut puis y bascule.
  const plans = (meta?.plans || []).filter((p) => !trial || p.priceMonthly > 0 || p.priceYearly > 0);
  const choosePlan = plans.length > 0 && Boolean(trial || plans.length > 1);
  const onTrial = !plan && Boolean(trial);
  const selected = plan ? (meta?.plans || []).find((p) => p.key === plan) : trial || (meta?.plans || []).find((p) => p.key === 'decouverte') || plans[0];
  const cat = (meta?.categories || []).find((c) => c.key === pro.specialty);
  const stepIndex = { compte: 0, formule: 0, activite: 1, justificatifs: 2, verification: 3 }[step];

  const saveActivity = () =>
    run(async () => {
      await api.put('/pro-profile/draft', { step: 1, data: { specialty: pro.specialty, otherSpecialty: pro.otherSpecialty, places: pro.places, address: pro.address, city: pro.city, lastName: pro.lastName } });
      setStep('justificatifs');
    });

  const pickDoc = async (kind, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError('10 Mo maximum par document');
    const fd = new FormData();
    fd.append('file', file);
    setUploading(kind);
    setError(null);
    try {
      const metaDoc = await api.upload(`/pro-profile/documents/${kind}`, fd);
      setDocs((x) => ({ ...x, [kind]: metaDoc }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  };

  const docsReady = Boolean(docs.identity) && (!cat?.requiresRpps || /^\d{11}$/.test(pro.rpps)) && (!cat?.requiresSterile || pro.sterile);

  const submit = () =>
    run(async () => {
      const r = await api.post('/pro-profile/submit', {
        via: 'web',
        charter: true,
        ...(plan || (!trial && selected) ? { plan: plan || selected.key, billing } : {}),
      });
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      setStep('verification');
    });

  return (
    <AuthLayout steps={STEP_LABELS} stepIndex={stepIndex}>
      {step !== 'compte' ? (
        <ol className="steps-rail" aria-label="Étapes de l’inscription">
          {STEP_LABELS.map((label, i) => (
            <li key={label} className={i === stepIndex ? 'on' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>
      ) : null}
      {step === 'compte' ? (
        <>
          <h1>Devenir praticienne</h1>
          <p className="muted">Un seul compte pour ton espace pro et ton suivi personnel dans l’app mobile Nissali.</p>
          <div className="stack">
            <p>
              Avec Nissali, toute praticienne est d’abord une utilisatrice : <strong>un seul compte</strong> pour ton suivi personnel et ton profil pro.
            </p>
            <ol className="muted" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Télécharge l’app Nissali et crée ton compte (prénom, âge, ville, e-mail, téléphone).</li>
              <li>À la question « Es-tu aussi praticienne ? », réponds Oui, ou plus tard depuis Profil › Devenir praticienne.</li>
              <li>Reviens ici avec le même e-mail pour gérer ton espace pro sur grand écran.</li>
            </ol>
            <Link className="btn block" href="/connexion">
              J’ai déjà un compte Nissali : me connecter
            </Link>
          </div>
        </>
      ) : step === 'formule' ? (
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
          <button className="btn block" onClick={() => setStep('activite')}>
            {onTrial ? 'Commencer mon essai gratuit' : 'Continuer'}
          </button>
        </div>
      ) : step === 'activite' ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            saveActivity();
          }}
        >
          <h1>Ton activité</h1>
          <p className="muted">Métier, ville et lieux de consultation. Tu compléteras ta présentation et tes tarifs depuis ton espace.</p>
          <Field label="Métier">
            <Chips items={meta?.categories || []} value={pro.specialty} onChange={(v) => setPro((p) => ({ ...p, specialty: v }))} />
          </Field>
          {pro.specialty === 'autre' ? (
            <Field label="Ton métier" hint="Masqué sur ta fiche jusqu’à validation par l’équipe">
              <input className="input" value={pro.otherSpecialty} onChange={(e) => setPro((p) => ({ ...p, otherSpecialty: e.target.value.slice(0, 40) }))} minLength={3} maxLength={40} required />
            </Field>
          ) : null}
          <Field label="Où reçois-tu ?">
            <Chips
              multi
              items={[
                { key: 'cabinet', label: 'En cabinet' },
                { key: 'visio', label: 'En visio' },
                { key: 'domicile', label: 'À domicile' },
              ]}
              value={Object.entries(pro.places).filter(([, v]) => v).map(([k]) => k)}
              onChange={(keys) => setPro((p) => ({ ...p, places: { visio: keys.includes('visio'), domicile: keys.includes('domicile'), cabinet: keys.includes('cabinet') } }))}
            />
          </Field>
          {pro.places.cabinet ? (
            <Field label="Adresse du cabinet" hint="Jamais affichée : seule la ville l’est">
              <input className="input" value={pro.address} onChange={(e) => setPro((p) => ({ ...p, address: e.target.value }))} required minLength={5} />
            </Field>
          ) : null}
          <div className="grid grid-2">
            <Field label="Ville d’exercice">
              <input className="input" value={pro.city} onChange={(e) => setPro((p) => ({ ...p, city: e.target.value }))} required minLength={2} />
            </Field>
            <Field label="Ton nom" hint={`Nom affiché : ${user?.firstName || ''} ${pro.lastName ? `${pro.lastName.trim()[0].toUpperCase()}.` : ''}`.trim()}>
              <input className="input" value={pro.lastName} onChange={(e) => setPro((p) => ({ ...p, lastName: e.target.value }))} required maxLength={60} placeholder="Seule l’initiale est affichée" />
            </Field>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy || !pro.specialty || !pro.city || !pro.lastName || !(pro.places.visio || pro.places.domicile || pro.places.cabinet) || (pro.specialty === 'autre' && pro.otherSpecialty.trim().length < 3)}>
            Continuer
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep('formule')}>
            Retour à la formule
          </button>
        </form>
      ) : step === 'justificatifs' ? (
        <div className="stack">
          <h1>Tes justificatifs</h1>
          <p className="muted">PDF, JPG ou PNG, 10 Mo maximum. Chiffrés et vus seulement par l’équipe Nissali.</p>
          {DOCS.map((doc) => (
            <label key={doc.kind} className={`card dashed row between ${docs[doc.kind] ? 'soft' : ''}`} style={{ cursor: 'pointer', padding: 14 }}>
              <span className="stack" style={{ gap: 2 }}>
                <strong>
                  {doc.label}
                  {doc.required ? <span style={{ color: 'var(--bordeaux)' }}> · obligatoire</span> : null}
                </strong>
                <span className="muted small">{docs[doc.kind] ? `✓ ${docs[doc.kind].name}` : doc.hint}</span>
              </span>
              <span className="btn sm outline" aria-hidden>
                {uploading === doc.kind ? 'Envoi…' : docs[doc.kind] ? 'Remplacer' : 'Ajouter'}
              </span>
              <input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={uploading === doc.kind} onChange={(e) => pickDoc(doc.kind, e.target.files?.[0])} />
            </label>
          ))}
          {cat?.requiresRpps ? (
            <Field label="Numéro RPPS" hint="Obligatoire : diététicienne est un titre protégé par la loi">
              <input className="input" inputMode="numeric" value={pro.rpps} onChange={(e) => setPro((p) => ({ ...p, rpps: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="11 chiffres" />
            </Field>
          ) : null}
          {cat?.requiresSterile ? (
            <label className="check">
              <input type="checkbox" checked={pro.sterile} onChange={(e) => setPro((p) => ({ ...p, sterile: e.target.checked }))} />
              <span>
                J’utilise du matériel stérile à usage unique et j’informe sur les contre-indications. <span className="muted small">(obligatoire)</span>
              </span>
            </label>
          ) : null}
          {cat?.disclaimer ? <p className="muted small">Mention ajoutée sur ta fiche : « {cat.disclaimer} ».</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="btn block" disabled={busy || !docsReady} onClick={submit}>
            Envoyer pour vérification
          </button>
          {!docs.identity ? <p className="muted small">La pièce d’identité est obligatoire pour envoyer ton dossier.</p> : null}
          <button type="button" className="btn ghost" onClick={() => setStep('activite')}>
            Retour
          </button>
        </div>
      ) : (
        <div className="stack">
          <h1>Dossier envoyé</h1>
          <p className="muted">Merci ! L’équipe vérifie ta pièce d’identité sous 48 h. Un e-mail de confirmation t’a été envoyé.</p>
          <div className="card stack" style={{ gap: 10 }}>
            {[
              ['Profil rempli', true],
              ['Vérification (48 h)', false],
              ['Fiche en ligne', false],
            ].map(([label, done]) => (
              <div key={label} className="row" style={{ gap: 10 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: done ? 'var(--or)' : 'transparent',
                    border: done ? 'none' : '1.5px solid var(--bordeaux)',
                    color: done ? 'var(--white)' : 'var(--bordeaux)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flex: 'none',
                  }}
                  aria-hidden
                >
                  {done ? '✓' : '·'}
                </span>
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Tu recevras une notification et un e-mail au résultat. Ta fiche ne montre jamais tes données personnelles (cycle, notes, prières).</p>
          <button
            className="btn block"
            onClick={() => {
              refresh()
                .catch(() => {})
                .finally(() => router.replace(user?.hasPassword ? '/pro' : '/pro/securite?bienvenue=1'));
            }}
          >
            Aller à mon espace pro
          </button>
        </div>
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
