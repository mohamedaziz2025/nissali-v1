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

import { preference, tr } from '../lib/i18n';

/** Libellé du choix de langue (le choix lui-même est détaillé dans les réglages). */
const LANG_LABEL = {
  system: tr("Langue du système"),
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};
const SPECIAL = [
  { key: 'aucun', label: tr("Aucun") },
  { key: 'adolescente', label: tr("Adolescente") },
  { key: 'arret_pilule', label: tr("Arrêt de la pilule") },
  { key: 'allaitement', label: tr("Allaitement") },
  { key: 'premenopause', label: tr("Préménopause") },
];
const CONTRACEPTION = [
  { key: 'aucune', label: tr("Aucune") },
  { key: 'pilule', label: tr("Pilule") },
  { key: 'sterilet', label: tr("Stérilet") },
  { key: 'implant', label: tr("Implant") },
  { key: 'preservatif', label: tr("Préservatif") },
  { key: 'autre', label: tr("Autre") },
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
        toast(tr("Numéro enregistré"));
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
      toast(tr("Identifiant vérifié"));
      setSheet(null);
      setIdSent(null);
      setCode('');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const situationLabel = user.situation === 'mariee' ? tr("Mariée") : user.situation === 'celibataire' ? tr("Célibataire") : null;
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
    Alert.alert(tr("Te déconnecter ?"), tr("Tu pourras te reconnecter à tout moment."), [
      { text: tr("Annuler"), style: 'cancel' },
      { text: tr("Me déconnecter"), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <Screen back title={tr("Mon profil")}>
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
          <Pressable onPress={() => open('infos', { firstName: user.firstName, age: String(user.age || ''), city: user.city, situation: user.situation })} accessibilityRole="button" accessibilityLabel={tr("Modifier mes informations")} hitSlop={8} style={s.modify}>
            <Text style={s.modifyText}>{tr("Modifier")}</Text>
          </Pressable>
        </Row>
        <View style={s.heroIds}>
          <Pressable onPress={() => { setIdValue(user.email || ''); setIdSent(null); setSheet('identifier'); }} accessibilityRole="button" style={s.heroId}>
            <Icon name="mail" size={15} color={colors.onBordeaux} />
            <Text style={s.heroIdText} numberOfLines={1}>{user.email || tr("Ajouter un e-mail")}</Text>
          </Pressable>
          <Pressable onPress={() => { setIdValue(user.phone || ''); setIdSent(null); setSheet('identifier'); }} accessibilityRole="button" style={s.heroId}>
            <Icon name="phone" size={15} color={colors.onBordeaux} />
            <Text style={s.heroIdText} numberOfLines={1}>{user.phone || tr("Ajouter un numéro")}</Text>
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
          <Text style={s.proTitle}>{practitioner ? tr("Mon espace praticienne") : user.proDraft ? tr("Termine ton profil praticienne") : tr("Devenir praticienne")}</Text>
          <Text style={s.proSub}>
            {practitioner
              ? `${(practitioner.status === 'validee' ? tr("En ligne") : tr("En vérification"))} · ${practitioner.displayName}`
              : user.proDraft
                ? tr("Étape {0} sur 4", [user.proDraft.step])
                : tr("Diététicienne, naturopathe, hijama, doula… Propose tes services dans Nissali.")}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.orText} />
      </Pressable>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>{tr("Mes rappels")}</Label>
        <ListItem icon="bell" title={tr("Prières et adhan")} subtitle={prayersOn ? tr("{0} rappel{1} sur 5 · adhan pour {2}{3}", [prayersOn, prayersOn > 1 ? 's' : '', adhanCount, (ps.notifyOffset ? tr(" · {0} min avant", [ps.notifyOffset]) : '')]) : tr("Rappels coupés")} onPress={() => router.push('/reglages/prieres')} />
        <ListItem icon="drop" title={tr("Pendant mes règles")} subtitle={tr("{0} · rappels {1} · dhikr {2}", [(ps.periodHome === 'ligne' ? tr("Accueil réduit") : tr("Horaires affichés")), (ps.keepRemindersDuringPeriod ? tr("gardés") : tr("coupés")), (ps.keepDhikrDuringPeriod === false ? tr("coupé") : tr("gardé"))])} onPress={() => router.push('/reglages/prieres?section=regles')} />
        <ListItem icon="beads" title={tr("Dhikr")} subtitle={tr("Vibration {0} · {1}", [(user.dhikr?.haptics === false ? tr("coupée") : tr("activée")), (user.dhikr?.reminder ? tr("rappel à {0}", [user.dhikr.reminderTime]) : tr("pas de rappel"))])} onPress={() => setSheet('dhikr')} />
        <ListItem icon="sliders" title={tr("Notifications")} subtitle={tr("Niveau {0} · aperçu {1}", [freq?.label?.toLowerCase(), (np.hideNotePreview === false ? 'visible' : tr("masqué"))])} onPress={() => router.push('/reglages/notifications')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>{tr("Mon suivi")}</Label>
        <ListItem icon="heart" title={tr("Objectif")} subtitle={{ suivre: tr("Suivre mon cycle"), enfant: tr("Avoir un enfant"), enceinte: tr("Je suis enceinte") }[user.onboarding?.goal || 'suivre']} onPress={() => open('goal', { goal: user.onboarding?.goal || 'suivre' })} />
        <ListItem icon="baby" title={user.mode === 'grossesse' ? tr("Ma grossesse") : user.mode === 'postpartum' ? tr("Post-partum") : tr("Mode grossesse")} subtitle={user.mode === 'cycle' ? tr("Activer le suivi de grossesse") : tr("Voir mon suivi")} onPress={() => router.push('/grossesse')} />
        <ListItem icon="cycle" title={tr("Profil particulier")} subtitle={SPECIAL.find((x) => x.key === user.specialProfile)?.label} onPress={() => open('special', { specialProfile: user.specialProfile })} />
        <ListItem icon="drop" title={tr("Contraception")} subtitle={CONTRACEPTION.find((x) => x.key === user.contraception?.type)?.label} onPress={() => open('contraception', { ...user.contraception })} />
        <Toggle label={tr("Glaire et température")} hint={tr("Dans le Suivi santé (toujours affichées si tu veux un enfant)")} value={Boolean(user.fertilitySigns)} onChange={(v) => patch({ fertilitySigns: v })} />
        <ListItem icon="chart" title={tr("Mes graphiques")} subtitle={tr("Cycles, poids, sommeil, humeurs")} onPress={() => router.push('/sante')} />
        <ListItem icon="calendar" title={tr("Mes rendez-vous")} onPress={() => router.push('/rendez-vous')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>{tr("Compte")}</Label>
        <ListItem icon="lock" title={tr("Connexion et sécurité")} subtitle={user.hasPassword ? tr("Mot de passe") : tr("Connexion par code")} onPress={() => router.push('/securite')} />
        <ListItem icon="info" title={tr("Confidentialité et données")} subtitle={tr("Accords, export, suppression du compte")} onPress={() => router.push('/reglages/confidentialite')} />
        <ListItem icon="globe" title={tr("Langue")} subtitle={LANG_LABEL[preference] || LANG_LABEL.system} onPress={() => router.push('/reglages/langue')} />
        <ListItem icon="chat" title={tr("Aide")} subtitle="contact@nissali.fr" onPress={() => Linking.openURL('mailto:contact@nissali.fr').catch(() => {})} />
        <ListItem icon="logout" title={tr("Me déconnecter")} onPress={logout} last />
      </Card>
      <Gap />
      <T variant="small" style={{ textAlign: 'center' }}>{tr("Les règles présentées sont l’avis retenu par notre comité. En cas de doute, rapproche-toi d’une personne de science.")}</T>
      <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>{tr("Nissali · 100 % gratuite · contact@nissali.fr")}</T>

      <Sheet visible={sheet === 'dhikr'} onClose={() => setSheet(null)} title={tr("Dhikr")}>
        <Toggle label={tr("Vibration au comptage")} value={user.dhikr?.haptics !== false} onChange={(v) => dhikrSettings({ haptics: v })} />
        <Toggle label={tr("Rappel de dhikr chaque jour")} value={Boolean(user.dhikr?.reminder)} onChange={(v) => dhikrSettings({ reminder: v })} />
        {user.dhikr?.reminder ? <TimeField label={tr("Heure du rappel")} value={user.dhikr.reminderTime || '20:30'} allowUnknown={false} onChange={(t) => t && dhikrSettings({ reminderTime: t })} /> : null}
        <Button title={tr("Ouvrir mon dhikr")} variant="outline" onPress={() => { setSheet(null); router.push('/dhikr'); }} />
      </Sheet>
      <Sheet visible={sheet === 'infos'} onClose={() => setSheet(null)} title={tr("Mes informations")} footer={<Button title={tr("Enregistrer")} onPress={() => patch({ firstName: draft.firstName, age: Number(draft.age), city: draft.city, situation: draft.situation, ...(draft.city !== user.city && draft.city ? { prayerSettings: { followLocation: draft.city.source === 'gps' } } : {}) }).then(() => setSheet(null))} disabled={!(Number(draft.age) >= 15)} />}>
        <Field label={tr("Prénom")} value={draft.firstName} onChangeText={(v) => setDraft((d) => ({ ...d, firstName: v }))} />
        <Field label={tr("Âge")} value={draft.age} onChangeText={(v) => setDraft((d) => ({ ...d, age: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
        <CityPicker value={draft.city} onChange={(v) => setDraft((d) => ({ ...d, city: v }))} />
        <T variant="fieldLabel">{tr("Situation")}</T>
        <Chips items={[{ key: 'celibataire', label: tr("Célibataire") }, { key: 'mariee', label: tr("Mariée") }]} value={draft.situation} onChange={(v) => setDraft((d) => ({ ...d, situation: v }))} />
      </Sheet>

      <Sheet visible={sheet === 'goal'} onClose={() => setSheet(null)} title={tr("Mon objectif")} footer={<Button title={tr("Enregistrer")} onPress={() => patch({ goal: draft.goal }).then(() => setSheet(null))} />}>
        <Chips items={[{ key: 'suivre', label: tr("Suivre mon cycle") }, { key: 'enfant', label: tr("Avoir un enfant") }, { key: 'enceinte', label: tr("Je suis enceinte") }]} value={draft.goal} onChange={(v) => setDraft({ goal: v })} />
        {draft.goal === 'enfant' ? <T variant="small">{tr("Tu recevras un rappel le premier jour de ta fenêtre fertile.")}</T> : null}
        {draft.goal === 'enceinte' ? (
          <Button title={tr("Configurer ma grossesse")} variant="outline" onPress={() => { setSheet(null); router.push('/grossesse'); }} />
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'special'} onClose={() => setSheet(null)} title={tr("Profil particulier")} footer={<Button title={tr("Enregistrer")} onPress={() => patch({ specialProfile: draft.specialProfile }).then(() => setSheet(null))} />}>
        <T variant="muted">{tr("Dans ces situations, les cycles sont souvent moins prévisibles : Nissali affiche des périodes plutôt que des dates.")}</T>
        <Chips items={SPECIAL} value={draft.specialProfile} onChange={(v) => setDraft({ specialProfile: v })} />
      </Sheet>

      <Sheet visible={sheet === 'contraception'} onClose={() => setSheet(null)} title={tr("Contraception")} footer={<Button title={tr("Enregistrer")} onPress={() => patch({ contraception: { type: draft.type, pillReminder: Boolean(draft.pillReminder), pillTime: draft.pillTime || '21:00' } }).then(() => setSheet(null))} />}>
        <Chips items={CONTRACEPTION} value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
        {draft.type === 'pilule' ? (
          <>
            <Toggle label={tr("Rappel de prise de pilule")} value={draft.pillReminder} onChange={(v) => setDraft((d) => ({ ...d, pillReminder: v }))} />
            <Field label={tr("Heure du rappel")} value={draft.pillTime || '21:00'} onChangeText={(v) => setDraft((d) => ({ ...d, pillTime: v }))} maxLength={5} />
          </>
        ) : null}
        <T variant="small">{tr("Nissali n’est pas un moyen de contraception.")}</T>
      </Sheet>

      <Sheet visible={sheet === 'identifier'} onClose={() => setSheet(null)} title={tr("Mon identifiant")} footer={idSent ? <Button title={tr("Vérifier")} onPress={() => verifyId()} loading={busy} disabled={code.length !== 6} /> : <Button title={idValue.includes('@') ? tr("Recevoir un code par e-mail") : tr("Enregistrer")} onPress={sendIdCode} loading={busy} disabled={idValue.length < 4} />}>
        {!idSent ? (
          <Field label={tr("E-mail ou téléphone")} value={idValue} onChangeText={setIdValue} autoCapitalize="none" keyboardType="email-address" hint={idValue.includes('@') ? tr("Un code de vérification est envoyé à cette adresse") : tr("Ton numéro est enregistré tel quel, sans SMS")} />
        ) : (
          <>
            <T variant="muted">{tr("Code envoyé par e-mail à")} {idSent.target}</T>
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
