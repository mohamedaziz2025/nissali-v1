// RG-50 — un seul compte : l'ancienne inscription pro renvoie vers « Configurer mon profil praticienne ».
import { Redirect } from 'expo-router';

export default function LegacyProSignup() {
  return <Redirect href="/devenir-praticienne" />;
}
