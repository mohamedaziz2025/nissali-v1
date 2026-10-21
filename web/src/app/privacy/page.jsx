import Link from 'next/link';
import PublicShell from '@/components/PublicShell';

export const metadata = {
  title: 'Politique de confidentialité — Nissali',
  description: 'Comment Nissali collecte, utilise et protège tes données personnelles.',
};

const SECTIONS = [
  {
    title: 'Qui est responsable de tes données ?',
    body: (
      <>
        <p>
          Le responsable du traitement est <strong>[Raison sociale Nissali]</strong>, [forme juridique], dont le siège
          social est situé [adresse complète], immatriculée sous le numéro [SIREN/RCS]. Pour toute question relative à
          tes données, écris-nous à <a href="mailto:contact@nissali.fr">contact@nissali.fr</a>.
        </p>
      </>
    ),
  },
  {
    title: 'Quelles données collectons-nous ?',
    body: (
      <>
        <ul>
          <li>Identité et contact : prénom, adresse e-mail, numéro de téléphone (facultatif), ville.</li>
          <li>Compte et sécurité : identifiants de connexion, codes de vérification, journaux de connexion.</li>
          <li>Activité professionnelle : prestations, tarifs, disponibilités, rendez-vous, avis publiés.</li>
          <li>Données de suivi personnel : cycle, prières, jeûnes — uniquement si tu utilises ces fonctionnalités, et cloisonnées de ton espace professionnel.</li>
          <li>Données techniques : adresse IP, type d’appareil, journaux d’usage nécessaires au fonctionnement et à la sécurité du service.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Pourquoi et sur quelle base ?',
    body: (
      <>
        <ul>
          <li><strong>Fournir le service</strong> (compte, agenda, mise en relation) — exécution du contrat.</li>
          <li><strong>Sécurité et prévention des abus</strong> — intérêt légitime.</li>
          <li><strong>Notifications et prise de rendez-vous</strong> — exécution du contrat et, le cas échéant, ton consentement.</li>
          <li><strong>Communications marketing</strong> — ton consentement, révocable à tout moment.</li>
          <li><strong>Obligations légales</strong> (comptabilité, réponses aux autorités) — obligation légale.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Et mes données de santé ?',
    body: (
      <>
        <p>
          Les informations sensibles que tu choisis de suivre (cycle, prières, jeûnes) sont strictement personnelles.
          Elles ne sont ni partagées avec les praticiennes, ni utilisées à des fins publicitaires, et ne sont
          accessibles qu’à toi depuis ton compte.
        </p>
      </>
    ),
  },
  {
    title: 'Pendant combien de temps ?',
    body: (
      <>
        <p>
          Tes données sont conservées le temps de ton utilisation du service, puis archivées ou supprimées selon les
          durées légales applicables (par exemple 10 ans pour les documents comptables). Les données de suivi
          personnel peuvent être supprimées à tout moment depuis ton compte.
        </p>
      </>
    ),
  },
  {
    title: 'Qui peut y accéder ?',
    body: (
      <>
        <p>
          Seules les personnes habilitées de l’équipe Nissali y accèdent, dans la limite de leurs fonctions. Nous
          faisons appel à des sous-traitants techniques (hébergement, envoi d’e-mails et de SMS, paiement via Stripe,
          envoi de notifications), qui n’agissent que sur nos instructions et dans le respect du RGPD.
        </p>
      </>
    ),
  },
  {
    title: 'Transferts hors Union européenne',
    body: (
      <>
        <p>
          Lorsque certains prestataires sont établis hors de l’Union européenne, les transferts sont encadrés par des
          garanties appropriées (clauses contractuelles types ou décision d’adéquation).
        </p>
      </>
    ),
  },
  {
    title: 'Tes droits',
    body: (
      <>
        <p>
          Conformément au RGPD, tu disposes d’un droit d’accès, de rectification, d’effacement, de limitation,
          d’opposition et de portabilité. Tu peux exercer ces droits en écrivant à{' '}
          <a href="mailto:contact@nissali.fr">contact@nissali.fr</a>. Tu peux aussi supprimer ton compte ou certaines
          de tes données depuis la page <Link href="/deleteaccount">Supprimer mon compte</Link>. Tu peux également
          introduire une réclamation
          auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noreferrer">cnil.fr</a>).
        </p>
      </>
    ),
  },
  {
    title: 'Cookies',
    body: (
      <>
        <p>
          L’espace web utilise uniquement des cookies strictement nécessaires à ton authentification et à la
          sécurité de ta session. Aucun cookie publicitaire n’est déposé sans ton consentement.
        </p>
      </>
    ),
  },
];

export default function Privacy() {
  return (
    <PublicShell>
      <section className="public-hero">
        <span className="label">Confidentialité</span>
        <h1>Politique de confidentialité</h1>
        <p>
          Nous accordons une attention particulière à la confidentialité de ta vie privée. Cette page explique quelles
          données nous traitons, pourquoi, et quels sont tes droits.
        </p>
      </section>

      <section className="prose">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h2>{s.title}</h2>
            {s.body}
          </div>
        ))}
      </section>

      <section className="card soft mt-lg">
        <p className="muted small">
          Une question sur tes données ? Écris-nous à <a href="mailto:contact@nissali.fr">contact@nissali.fr</a> ou
          consulte notre <Link href="/support">page de support</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
