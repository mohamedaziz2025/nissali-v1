// Espace pro › Messages : conversations avec les clientes (façon Messenger).
import { Screen, T } from '../../components/ui';
import { ConversationList } from '../messages';

import { tr } from '../../lib/i18n';
export default function ProMessages() {
  return (
    <Screen title={tr("Messages")}>
      <T variant="muted" style={{ marginTop: -10, marginBottom: 14 }}>{tr("Tes échanges avec tes clientes. Rappelle-leur de ne pas partager d’informations médicales sensibles par message.")}</T>
      <ConversationList as="pro" embedded />
    </Screen>
  );
}
