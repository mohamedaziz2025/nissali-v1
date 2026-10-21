// 5.11 — « Rejoindre NissaPlace » : une sœur demande à ouvrir sa boutique sur nissaplace.fr,
// l'équipe étudie la demande et la recontacte pour la suite.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { Button, Card, Field, Gap, Loader, Row, Screen, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

function Section({ title, icon, children }) {
  return (
    <View style={s.section}>
      <Row gap={8}>
        <View style={s.sectionIcon}>
          <Icon name={icon} size={16} color={colors.bordeaux} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </Row>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

export default function JoinNissaPlace() {
  const toast = useToast();
  const { data: mine, loading: loadingMine, reload } = useApi('/nissaplace/mine');
  const latest = mine?.[0];
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ shopName: '', activity: '', description: '', city: '', phone: '', instagramUrl: '', websiteUrl: '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/nissaplace', f);
      toast('Merci ! Notre équipe étudie ta demande.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const missing = [f.shopName.trim().length < 2 && 'le nom de ta boutique'].filter(Boolean);

  if (loadingMine) return <Screen back title="Rejoindre NissaPlace"><Loader /></Screen>;

  if (latest?.status === 'en_attente' || latest?.status === 'validee') {
    return (
      <Screen back title="Rejoindre NissaPlace">
        <Card tone="soft" style={{ gap: 10 }}>
          <Icon name={latest.status === 'validee' ? 'check' : 'briefcase'} size={22} color={colors.bordeaux} />
          <T variant="h3">{latest.status === 'validee' ? 'Ta boutique est validée' : 'Ta demande est en cours d’examen'}</T>
          <T variant="small">
            {latest.status === 'validee'
              ? `« ${latest.shopName} » est validée. Notre équipe te recontacte pour la mettre en ligne sur nissaplace.fr.`
              : `Notre équipe étudie ta demande pour « ${latest.shopName} » et te recontacte bientôt.`}
          </T>
        </Card>
        <Gap h={24} />
      </Screen>
    );
  }

  return (
    <Screen back title="Rejoindre NissaPlace">
      <T variant="muted" style={{ marginTop: -8, marginBottom: 16 }}>Présente ta boutique : notre équipe étudie chaque demande et te recontacte pour la suite.</T>

      {latest?.status === 'refusee' ? (
        <Card tone="soft" style={{ gap: 6, marginBottom: 14 }}>
          <T variant="medium">Ta précédente demande n’a pas été retenue.</T>
          {latest.moderationNote ? <T variant="small">{latest.moderationNote}</T> : null}
          <T variant="small">Tu peux proposer une nouvelle demande ci-dessous.</T>
        </Card>
      ) : null}

      <Section title="Ta boutique" icon="briefcase">
        <Field label="Nom de la boutique" value={f.shopName} onChangeText={set('shopName')} placeholder="Ex. Les Perles de Zaynab" maxLength={80} />
        <Field label="Ce que tu vends" value={f.activity} onChangeText={set('activity')} placeholder="Ex. abayas, hijabs, cosmétiques…" maxLength={120} />
        <Field label="Présente ta boutique (facultatif)" value={f.description} onChangeText={set('description')} multiline placeholder="Quelques lignes sur toi et tes produits" />
      </Section>

      <Section title="Contact" icon="phone">
        <Field label="Ville" value={f.city} onChangeText={set('city')} placeholder="Ex. Lyon" icon="pin" />
        <Field label="Téléphone" value={f.phone} onChangeText={set('phone')} placeholder="06 12 34 56 78" keyboardType="phone-pad" />
        <Field label="Instagram (facultatif)" value={f.instagramUrl} onChangeText={set('instagramUrl')} placeholder="instagram.com/taboutique" autoCapitalize="none" autoCorrect={false} />
        <Field label="Site web (facultatif)" value={f.websiteUrl} onChangeText={set('websiteUrl')} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </Section>

      {missing.length ? <T variant="small" style={{ textAlign: 'center', marginBottom: 10 }}>Il manque : {missing.join(', ')}.</T> : null}
      <Button title="Envoyer ma demande" icon="check" onPress={submit} loading={busy} disabled={missing.length > 0 || busy} />
      <Gap h={24} />
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.line },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
});
