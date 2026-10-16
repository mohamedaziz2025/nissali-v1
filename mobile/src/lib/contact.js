// Contacter une praticienne : messagerie interne (toujours disponible) ou appel si son numéro est public (RG-26).
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { api } from './api';

export async function openConversation(practitionerId) {
  const conv = await api.post('/messages/conversations', { practitionerId });
  router.push(`/messages/${conv.id}`);
}

export function callPhone(phone) {
  if (phone) Linking.openURL(`tel:${String(phone).replace(/[^\d+]/g, '')}`);
}
