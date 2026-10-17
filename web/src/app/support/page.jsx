import Link from 'next/link';
import Icon from '@/components/Icons';
import PublicShell from '@/components/PublicShell';

export const metadata = {
  title: 'Support — Nissali',
  description: 'Besoin d’aide sur ton espace praticienne Nissali ? Questions fréquentes et contact.',
};

const FAQ = [
  ['Comment créer mon espace praticienne ?', 'Rends-toi sur la page « Devenir praticienne » puis clique sur « Créer mon espace praticienne ». Tu recevras un code de vérification par e-mail pour finaliser ton inscription.'],
  ['J’ai oublié mon mot de passe, que faire ?', 'Sur la page de connexion, clique sur « Mot de passe oublié ? » et suis les étapes. Si tu te connectes par code unique, aucun mot de passe n’est nécessaire.'],
  ['Comment fonctionne l’abonnement ?', 'Tu choisis une formule depuis ton espace pro, rubrique « Abonnement ». Le paiement est sécurisé par Stripe et tu peux changer ou résilier à tout moment, sans engagement.'],
  ['Mes données de santé sont-elles visibles ?', 'Non. Nissali sépare strictement ton espace personnel (cycle, prières, jeûnes) de ton espace professionnel. Les praticiennes ne voient que les informations utiles à la prise de rendez-vous.'],
  ['Comment supprimer mon compte ?', 'Écris-nous depuis l’adresse e-mail de ton compte et nous procéderons à la suppression. Voir aussi notre politique de confidentialité.'],
];

export default function Support() {
  return (
    <PublicShell>
      <section className="public-hero">
        <span className="label">Support</span>
        <h1>Une question ? Nous sommes là.</h1>
        <p>
          Consulte les questions fréquentes ci-dessous. Si tu ne trouves pas ta réponse, écris-nous : nous te
          répondons dans les plus brefs délais.
        </p>
        <div className="row mt">
          <a className="btn" href="mailto:nissali@gmail.com">
            <Icon name="mail" />
            nissali@gmail.com
          </a>
        </div>
      </section>

      <section className="mt-lg prose">
        <h2>Questions fréquentes</h2>
        {FAQ.map(([q, a]) => (
          <div key={q} className="mt">
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </section>

      <section className="card soft mt-lg">
        <h2>Tu ne trouves pas ta réponse ?</h2>
        <p className="muted mt">
          Écris-nous à <a href="mailto:nissali@gmail.com">nissali@gmail.com</a> en précisant ton adresse de compte.
          Pour la gestion de tes données personnelles, consulte notre{' '}
          <Link href="/privacy">politique de confidentialité</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
