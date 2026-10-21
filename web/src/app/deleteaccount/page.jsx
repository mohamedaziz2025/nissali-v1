import Link from 'next/link';
import PublicShell from '@/components/PublicShell';

export const metadata = {
  title: 'Supprimer mon compte — Nissali',
  description: 'Comment supprimer ton compte Nissali ou certaines de tes données, et ce qui est conservé.',
};

export default function DeleteAccount() {
  return (
    <PublicShell>
      <section className="public-hero">
        <span className="label">Compte</span>
        <h1>Supprimer mon compte</h1>
        <p>
          Cette page explique comment supprimer ton compte Nissali et toutes les données associées, ou seulement
          certaines de tes données. Elle s’applique à l’application mobile Nissali et à l’espace web nissali.fr.
        </p>
      </section>

      <section className="prose">
        <div>
          <h2>Supprimer tout mon compte</h2>
          <p>La suppression se fait directement dans l’application, sans nous écrire :</p>
          <ol>
            <li>Ouvre l’application Nissali et connecte-toi.</li>
            <li>
              Va dans l’onglet <strong>Profil</strong>, puis <strong>Confidentialité et données</strong>.
            </li>
            <li>
              Touche <strong>Supprimer mon compte</strong>, confirme l’avertissement, puis écris <strong>SUPPRIMER</strong>{' '}
              pour valider.
            </li>
          </ol>
          <p>
            La suppression est immédiate et définitive. Ton compte est déconnecté et tu ne peux plus te reconnecter avec
            cet identifiant.
          </p>
          <p>
            Si tu ne peux plus accéder à l’application, écris à{' '}
            <a href="mailto:contact@nissali.fr">contact@nissali.fr</a> depuis l’adresse e-mail de ton compte : nous
            procédons à la suppression après vérification de ton identité.
          </p>
        </div>

        <div>
          <h2>Données supprimées</h2>
          <p>Sont effacés définitivement de nos bases et de nos serveurs de fichiers :</p>
          <ul>
            <li>Ton compte : prénom, adresse e-mail, numéro de téléphone, ville, année de naissance, photo de profil.</li>
            <li>
              Tes données de santé et de suivi : cycles et règles, grossesse, poids, humeur et symptômes, journal
              quotidien, prières, dhikr, jeûnes et rattrapages.
            </li>
            <li>Tes notes personnelles.</li>
            <li>Tes rendez-vous, réservations, avis publiés, favoris et inscriptions aux événements.</li>
            <li>Tes conversations et les photos que tu as envoyées.</li>
            <li>Tes notifications, tes abonnements aux notifications push et tes codes de vérification.</li>
            <li>
              Si tu es praticienne : ta fiche professionnelle, tes prestations, disponibilités, congés, abonnement,
              avis reçus, fiches clientes et les justificatifs que tu as déposés (identité, diplôme, RC Pro, RPPS).
            </li>
          </ul>
        </div>

        <div>
          <h2>Données conservées</h2>
          <ul>
            <li>
              <strong>Journal d’audit du back-office.</strong> Les actions d’administration sont tracées avec
              l’identifiant technique de ton compte, sans ton nom ni ton adresse e-mail. Ces entrées sont conservées pour
              la sécurité et la traçabilité du service.
            </li>
            <li>
              <strong>Sauvegardes techniques.</strong> Les copies de sauvegarde de la base de données sont écrasées au
              plus tard sous 30 jours ; aucune restauration n’est faite pour récupérer un compte supprimé.
            </li>
            <li>
              <strong>Paiements Stripe.</strong> Les factures et justificatifs de paiement liés à un abonnement Nissali
              Pro sont conservés pendant 10 ans, conformément aux obligations comptables (article L123-22 du code de
              commerce). Ils restent hébergés chez notre prestataire de paiement Stripe et ne contiennent pas tes
              données de santé.
            </li>
          </ul>
          <p>
            À noter : un compte resté inactif pendant 3 ans est supprimé automatiquement, avec les mêmes effets que la
            suppression manuelle.
          </p>
        </div>

        <div>
          <h2>Supprimer certaines données sans supprimer mon compte</h2>
          <p>
            Tu peux effacer une partie de tes données à tout moment depuis l’application, en gardant ton compte :
          </p>
          <ul>
            <li>une note ;</li>
            <li>une entrée de jeûne volontaire, un rattrapage ou un ajout hors application ;</li>
            <li>une pesée ou une entrée de ton suivi santé ;</li>
            <li>un dhikr personnalisé ;</li>
            <li>un favori ;</li>
            <li>pour les praticiennes : une prestation, une indisponibilité, une note de fiche cliente.</li>
          </ul>
          <p>
            Pour toute autre demande d’effacement partiel — par exemple un message, une photo ou un dossier client —
            écris à <a href="mailto:contact@nissali.fr">contact@nissali.fr</a> en précisant les données concernées.
            Nous répondons et traitons la demande sous 30 jours. Ton compte et le reste de tes données sont conservés.
          </p>
        </div>
      </section>

      <section className="card soft mt-lg">
        <p className="muted small">
          Une question sur la suppression de tes données ? Écris-nous à{' '}
          <a href="mailto:contact@nissali.fr">contact@nissali.fr</a>, consulte notre{' '}
          <Link href="/privacy">politique de confidentialité</Link> ou notre <Link href="/support">page de support</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
