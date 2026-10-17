import Link from 'next/link';
import Icon from '@/components/Icons';
import PublicShell from '@/components/PublicShell';

export const metadata = {
  title: 'Devenir praticienne — Nissali',
  description: 'Développe ton activité auprès des femmes musulmanes : agenda, prestations, visio et fiches clientes au même endroit.',
};

const BENEFITS = [
  ['users', 'Une patientèle engagée', 'Rencontre des femmes musulmanes qui cherchent une praticienne de confiance, près de chez elles ou en visio.'],
  ['calendar', 'Agenda et rendez-vous', 'Gère tes disponibilités, tes séances en cabinet et en visio, et tes rappels automatiques.'],
  ['card', 'Paiement simple', 'Abonnement clair, paiement en ligne sécurisé par Stripe, sans engagement.'],
  ['shield', 'Confidentialité totale', 'Aucune donnée de cycle ou de santé Nissali n’est partagée. Tu vois seulement l’essentiel pour exercer.'],
  ['star', 'Ta réputation', 'Recueille les avis de tes clientes et mets en avant ton profil public dans l’annuaire.'],
  ['heart', 'Entre sœurs', 'Une communauté bienveillante, pensée pour la santé et le bien-être des femmes.'],
];

const STEPS = [
  ['Crée ton espace', 'Inscris-toi en quelques minutes avec ton e-mail et décris ta pratique.'],
  ['Complète ton profil', 'Ajoute tes prestations, tes tarifs, tes disponibilités et tes spécialités.'],
  ['Publie et reçois tes premières demandes', 'Ton profil devient visible dans l’annuaire et tu reçois tes premières réservations.'],
];

export default function Marketing() {
  return (
    <PublicShell>
      <section className="public-hero">
        <span className="label">Espace pro</span>
        <h1>Développe ton activité auprès des femmes musulmanes</h1>
        <p>
          Psychologues, sages-femmes, praticiennes en hijama, diététiciennes, sophrologues : rejoins Nissali et
          propose ton accompagnement dans un cadre respectueux, confidentiel et pensé pour elles.
        </p>
        <div className="row mt-lg">
          <Link href="/inscription" className="btn lg">
            Créer mon espace praticienne
            <Icon name="chevronRight" />
          </Link>
          <Link href="/connexion" className="btn outline lg">
            J’ai déjà un compte
          </Link>
        </div>
      </section>

      <section className="mt-lg">
        <h2>Pourquoi rejoindre Nissali ?</h2>
        <div className="feature-grid mt">
          {BENEFITS.map(([icon, title, text]) => (
            <div key={title} className="card">
              <span className="kpi-icon">
                <Icon name={icon} />
              </span>
              <h3 className="mt">{title}</h3>
              <p className="muted small mt">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-lg">
        <h2>Comment ça marche ?</h2>
        <div className="steps mt">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="step">
              <span className="step-num">{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <p className="muted small">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card hero mt-lg">
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 26, color: 'var(--white)' }}>Prête à commencer ?</h2>
        <p className="mt" style={{ color: 'var(--rose)' }}>
          Crée ton espace praticienne gratuitement. Tu ne paies que lorsque tu choisis une formule.
        </p>
        <div className="row mt">
          <Link href="/inscription" className="btn lg" style={{ background: 'var(--white)', color: 'var(--bordeaux)', borderColor: 'var(--white)' }}>
            Créer mon espace
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
