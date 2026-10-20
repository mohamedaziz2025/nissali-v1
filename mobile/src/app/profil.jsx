// 4.5 · 4.1 — Mon profil : carte bordeaux (initiale, prénom, âge, ville, situation, « Modifier »), carte sable
// « Devenir praticienne » / « Mon espace praticienne », Mes rappels (Prières et adhan, Pendant mes règles, Dhikr,
// Notifications), Mon suivi, Compte (confidentialité, aide, déconnexion avec confirmation).
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CityPicker, TimeField } from '../components/forms';
import Icon from '../components/Icon';
import { FREQUENCIES } from '../components/NotifFrequency';
import { Button, Card, Chips, CodeInput, Field, Gap, Label, ListItem, Row, Screen, Sheet, T, Toggle, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, fonts, PRAYERS } from '../theme';

const SPECIAL = [
  { key: 'aucun', label: 'Aucun' },
  { key: 'adolescente', label: 'Adolescente' },
  { key: 'arret_pilule', label: 'Arrêt de la pilule' },
  { key: 'allaitement', label: 'Allaitement' },
  { key: 'premenopause', label: 'Préménopause' },
];
const CONTRACEPTION = [
  { key: 'aucune', label: 'Aucune' },
  { key: 'pilule', label: 'Pilule' },
  { key: 'sterilet', label: 'Stérilet' },
  { key: 'implant', label: 'Implant' },
  { key: 'preservatif', label: 'Préservatif' },
  { key: 'autre', label: 'Autre' },
];

export default function Profile() {
  const { user, practitioner, setSession, signOut } = useAuth();
  const toast = useToast();
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState({});
  const [idValue, setIdValue] = useState('');
  const [idSent, setIdSent] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const patch = async (body, message = 'Enregistré') => {
    try {
      await setSession(await api.patch('/me', body));
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const dhikrSettings = async (body) => {
    try {
      const r = await api.patch('/dhikr/settings', body);
      await setSession({ user: r.user });
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const open = (name, initial = {}) => {
    setDraft(initial);
    setSheet(name);
  };

  const sendIdCode = async () => {
    setBusy(true);
    try {
      const r = await api.post('/me/identifier/otp', { identifier: idValue });
      // Numéro de téléphone : enregistré directement (aucun SMS) ; e-mail : code envoyé par e-mail.
      if (r.saved) {
        await setSession(r);
        toast('Numéro enregistré');
        setSheet(null);
        return;
      }
      setIdSent(r);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const verifyId = async (value = code) => {
    setBusy(true);
    try {
      await setSession(await api.post('/me/identifier/verify', { identifier: idValue, code: value }));
      toast('Identifiant vérifié');
      setSheet(null);
      setIdSent(null);
      setCode('');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const situationLabel = user.situation === 'mariee' ? 'Mariée' : user.situation === 'celibataire' ? 'Célibataire' : null;
  const ps = user.prayerSettings || {};
  const np = user.notificationPrefs || {};
  const prayersOn = PRAYERS.filter((k) => ps.notifications !== false && ps.notifyPrayers?.[k] !== false).length;
  const adhanCount = PRAYERS.filter((k) => ['complet', 'court'].includes(ps.prayerSound?.[k] || 'complet') && ps.adhanPrayers?.[k] !== false).length;
  const freq = FREQUENCIES.find((f) => f.key === (np.frequency || 'faible'));
  const logout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Te déconnecter de Nissali ?')) signOut(); // eslint-disable-line no-alert
      return;
    }
    Alert.alert('Te déconnecter ?', 'Tu pourras te reconnecter à tout moment.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Me déconnecter', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <Screen back title="Mon profil">
      {/* Carte bordeaux : initiale, prénom, âge, ville, situation, « Modifier » */}
      <View style={s.hero}>
        <Row gap={14}>
          <View style={s.initial}>
            <Text style={s.initialText}>{(user.firstName || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName} numberOfLines={1}>{user.firstName}</Text>
            <Text style={s.heroSub} numberOfLines={2}>{[user.age ? `${user.age} ans` : null, user.city?.name, situationLabel].filter(Boolean).join(' · ')}</Text>
          </View>
          <Pressable onPress={() => open('infos', { firstName: user.firstName, age: String(user.age || ''), city: user.city, situation: user.situation })} accessibilityRole="button" accessibilityLabel="Modifier mes informations" hitSlop={8} style={s.modify}>
            <Text style={s.modifyText}>Modifier</Text>
          </Pressable>
        </Row>
        <View style={s.heroIds}>
          <Pressable onPress={() => { setIdValue(user.email || ''); setIdSent(null); setSheet('identifier'); }} accessibilityRole="button" style={s.heroId}>
            <Icon name="mail" size={15} color={colors.onBordeaux} />
            <Text style={s.heroIdText} numberOfLines={1}>{user.email || 'Ajouter un e-mail'}</Text>
          </Pressable>
          <Pressable onPress={() => { setIdValue(user.phone || ''); setIdSent(null); setSheet('identifier'); }} accessibilityRole="button" style={s.heroId}>
            <Icon name="phone" size={15} color={colors.onBordeaux} />
            <Text style={s.heroIdText} numberOfLines={1}>{user.phone || 'Ajouter un numéro'}</Text>
          </Pressable>
        </View>
      </View>
      <Gap />

      {/* Carte sable : devenir praticienne / mon espace praticienne */}
      <Pressable onPress={() => router.push(practitioner ? '/espace-praticienne' : '/devenir-praticienne')} accessibilityRole="button" style={({ pressed }) => [s.pro, pressed && { opacity: 0.9 }]}>
        <View style={s.proIcon}>
          <Icon name="briefcase" size={20} color={colors.orText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.proTitle}>{practitioner ? 'Mon espace praticienne' : user.proDraft ? 'Termine ton profil praticienne' : 'Devenir praticienne'}</Text>
          <Text style={s.proSub}>
            {practitioner
              ? `${practitioner.status === 'validee' ? 'En ligne' : 'En vérification'} · ${practitioner.displayName}`
              : user.proDraft
                ? `Étape ${user.proDraft.step} sur 4`
                : 'Diététicienne, naturopathe, hijama, doula… Propose tes services dans Nissali.'}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.orText} />
      </Pressable>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Mes rappels</Label>
        <ListItem icon="bell" title="Prières et adhan" subtitle={prayersOn ? `${prayersOn} rappel${prayersOn > 1 ? 's' : ''} sur 5 · adhan pour ${adhanCount}${ps.notifyOffset ? ` · ${ps.notifyOffset} min avant` : ''}` : 'Rappels coupés'} onPress={() => router.push('/reglages/prieres')} />
        <ListItem icon="drop" title="Pendant mes règles" subtitle={`${ps.periodHome === 'ligne' ? 'Accueil réduit' : 'Horaires affichés'} · rappels ${ps.keepRemindersDuringPeriod ? 'gardés' : 'coupés'} · dhikr ${ps.keepDhikrDuringPeriod === false ? 'coupé' : 'gardé'}`} onPress={() => router.push('/reglages/prieres?section=regles')} />
        <ListItem icon="beads" title="Dhikr" subtitle={`Vibration ${user.dhikr?.haptics === false ? 'coupée' : 'activée'} · ${user.dhikr?.reminder ? `rappel à ${user.dhikr.reminderTime}` : 'pas de rappel'}`} onPress={() => setSheet('dhikr')} />
        <ListItem icon="sliders" title="Notifications" subtitle={`Niveau ${freq?.label?.toLowerCase()} · aperçu ${np.hideNotePreview === false ? 'visible' : 'masqué'}`} onPress={() => router.push('/reglages/notifications')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Mon suivi</Label>
        <ListItem icon="heart" title="Objectif" subtitle={{ suivre: 'Suivre mon cycle', enfant: 'Avoir un enfant', enceinte: 'Je suis enceinte' }[user.onboarding?.goal || 'suivre']} onPress={() => open('goal', { goal: user.onboarding?.goal || 'suivre' })} />
        <ListItem icon="baby" title={user.mode === 'grossesse' ? 'Ma grossesse' : user.mode === 'postpartum' ? 'Post-partum' : 'Mode grossesse'} subtitle={user.mode === 'cycle' ? 'Activer le suivi de grossesse' : 'Voir mon suivi'} onPress={() => router.push('/grossesse')} />
        <ListItem icon="cycle" title="Profil particulier" subtitle={SPECIAL.find((x) => x.key === user.specialProfile)?.label} onPress={() => open('special', { specialProfile: user.specialProfile })} />
        <ListItem icon="drop" title="Contraception" subtitle={CONTRACEPTION.find((x) => x.key === user.contraception?.type)?.label} onPress={() => open('contraception', { ...user.contraception })} />
        <Toggle label="Glaire et température" hint="Dans le Suivi santé (toujours affichées si tu veux un enfant)" value={Boolean(user.fertilitySigns)} onChange={(v) => patch({ fertilitySigns: v })} />
        <ListItem icon="chart" title="Mes graphiques" subtitle="Cycles, poids, sommeil, humeurs" onPress={() => router.push('/sante')} />
        <ListItem icon="calendar" title="Mes rendez-vous" onPress={() => router.push('/rendez-vous')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Compte</Label>
        <ListItem icon="lock" title="Connexion et sécurité" subtitle={user.hasPassword ? 'Mot de passe' : 'Connexion par code'} onPress={() => router.push('/securite')} />
        <ListItem icon="info" title="Confidentialité et données" subtitle="Accords, export, suppression du compte" onPress={() => router.push('/reglages/confidentialite')} />
        <ListItem icon="chat" title="Aide" subtitle="contact@nissali.fr" onPress={() => Linking.openURL('mailto:contact@nissali.fr').catch(() => {})} />
        <ListItem icon="logout" title="Me déconnecter" onPress={logout} last />
      </Card>
      <Gap />
      <T variant="small" style={{ textAlign: 'center' }}>Les règles présentées sont l’avis retenu par notre comité. En cas de doute, rapproche-toi d’une personne de science.</T>
      <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>Nissali · 100 % gratuite · contact@nissali.fr</T>

      <Sheet visible={sheet === 'dhikr'} onClose={() => setSheet(null)} title="Dhikr">
        <Toggle label="Vibration au comptage" value={user.dhikr?.haptics !== false} onChange={(v) => dhikrSettings({ haptics: v })} />
        <Toggle label="Rappel de dhikr chaque jour" value={Boolean(user.dhikr?.reminder)} onChange={(v) => dhikrSettings({ reminder: v })} />
        {user.dhikr?.reminder ? <TimeField label="Heure du rappel" value={user.dhikr.reminderTime || '20:30'} allowUnknown={false} onChange={(t) => t && dhikrSettings({ reminderTime: t })} /> : null}
        <Button title="Ouvrir mon dhikr" variant="outline" onPress={() => { setSheet(null); router.push('/dhikr'); }} />
      </Sheet>
      <Sheet visible={sheet === 'infos'} onClose={() => setSheet(null)} title="Mes informations" footer={<Button title="Enregistrer" onPress={() => patch({ firstName: draft.firstName, age: Number(draft.age), city: draft.city, situation: draft.situation, ...(draft.city !== user.city && draft.city ? { prayerSettings: { followLocation: draft.city.source === 'gps' } } : {}) }).then(() => setSheet(null))} disabled={!(Number(draft.age) >= 15)} />}>
        <Field label="Prénom" value={draft.firstName} onChangeText={(v) => setDraft((d) => ({ ...d, firstName: v }))} />
        <Field label="Âge" value={draft.age} onChangeText={(v) => setDraft((d) => ({ ...d, age: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
        <CityPicker value={draft.city} onChange={(v) => setDraft((d) => ({ ...d, city: v }))} />
        <T variant="fieldLabel">Situation</T>
        <Chips items={[{ key: 'celibataire', label: 'Célibataire' }, { key: 'mariee', label: 'Mariée' }]} value={draft.situation} onChange={(v) => setDraft((d) => ({ ...d, situation: v }))} />
      </Sheet>

      <Sheet visible={sheet === 'goal'} onClose={() => setSheet(null)} title="Mon objectif" footer={<Button title="Enregistrer" onPress={() => patch({ goal: draft.goal }).then(() => setSheet(null))} />}>
        <Chips items={[{ key: 'suivre', label: 'Suivre mon cycle' }, { key: 'enfant', label: 'Avoir un enfant' }, { key: 'enceinte', label: 'Je suis enceinte' }]} value={draft.goal} onChange={(v) => setDraft({ goal: v })} />
        {draft.goal === 'enfant' ? <T variant="small">Tu recevras un rappel le premier jour de ta fenêtre fertile.</T> : null}
        {draft.goal === 'enceinte' ? (
          <Button title="Configurer ma grossesse" variant="outline" onPress={() => { setSheet(null); router.push('/grossesse'); }} />
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'special'} onClose={() => setSheet(null)} title="Profil particulier" footer={<Button title="Enregistrer" onPress={() => patch({ specialProfile: draft.specialProfile }).then(() => setSheet(null))} />}>
        <T variant="muted">Dans ces situations, les cycles sont souvent moins prévisibles : Nissali affiche des périodes plutôt que des dates.</T>
        <Chips items={SPECIAL} value={draft.specialProfile} onChange={(v) => setDraft({ specialProfile: v })} />
      </Sheet>

      <Sheet visible={sheet === 'contraception'} onClose={() => setSheet(null)} title="Contraception" footer={<Button title="Enregistrer" onPress={() => patch({ contraception: { type: draft.type, pillReminder: Boolean(draft.pillReminder), pillTime: draft.pillTime || '21:00' } }).then(() => setSheet(null))} />}>
        <Chips items={CONTRACEPTION} value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
        {draft.type === 'pilule' ? (
          <>
            <Toggle label="Rappel de prise de pilule" value={draft.pillReminder} onChange={(v) => setDraft((d) => ({ ...d, pillReminder: v }))} />
            <Field label="Heure du rappel" value={draft.pillTime || '21:00'} onChangeText={(v) => setDraft((d) => ({ ...d, pillTime: v }))} maxLength={5} />
          </>
        ) : null}
        <T variant="small">Nissali n’est pas un moyen de contraception.</T>
      </Sheet>

      <Sheet visible={sheet === 'identifier'} onClose={() => setSheet(null)} title="Mon identifiant" footer={idSent ? <Button title="Vérifier" onPress={() => verifyId()} loading={busy} disabled={code.length !== 6} /> : <Button title={idValue.includes('@') ? 'Recevoir un code par e-mail' : 'Enregistrer'} onPress={sendIdCode} loading={busy} disabled={idValue.length < 4} />}>
        {!idSent ? (
          <Field label="E-mail ou téléphone" value={idValue} onChangeText={setIdValue} autoCapitalize="none" keyboardType="email-address" hint={idValue.includes('@') ? 'Un code de vérification est envoyé à cette adresse' : 'Ton numéro est enregistré tel quel, sans SMS'} />
        ) : (
          <>
            <T variant="muted">Code envoyé par e-mail à {idSent.target}</T>
            <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) verifyId(v); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.bordeaux, borderRadius: 28, padding: 18, gap: 14 },
  initial: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.onBordeauxSurface, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.extra, fontSize: 24, color: colors.white },
  heroName: { fontFamily: fonts.extra, fontSize: 22, letterSpacing: -0.5, color: colors.white },
  heroSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.onBordeaux },
  modify: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  modifyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  heroIds: { gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: 12 },
  heroId: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  heroIdText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.white },
  pro: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.sable, borderRadius: 24, padding: 16 },
  proIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  proTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  proSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted },
});
