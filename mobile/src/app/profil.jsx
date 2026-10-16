// 5.13 — Profil et réglages : informations, notifications, appel à la prière, consentements,
// export des données, suppression du compte (RG-07), bascule vers l'espace pro.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { AdhanSoundSheet } from '../components/AdhanSound';
import { CityPicker } from '../components/forms';
import Icon from '../components/Icon';
import ProSpaceCard from '../components/ProSpaceCard';
import { Button, Card, Chips, CodeInput, Field, Gap, Label, ListItem, Row, Screen, Sheet, Stepper, T, Toggle, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { onAdhan, playAdhan, stopAdhan } from '../lib/adhan';
import { syncLocation } from '../lib/location';
import { useApi } from '../lib/useApi';
import { cancelAll } from '../lib/notifications';
import { colors, PRAYER_LABELS, PRAYERS } from '../theme';

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
  const adhans = useApi('/prayers/adhans');
  const adhanOn = user?.prayerSettings?.adhan !== false && user?.prayerSettings?.adhanMode !== 'notification';
  const [preview, setPreview] = useState(null);
  const [adhanSound, setAdhanSound] = useState(false);
  useEffect(() => onAdhan((a) => setPreview(a?.prayer === 'Aperçu' ? a.key : null)), []);
  if (!user) return null;

  const patch = async (body, message = 'Enregistré') => {
    try {
      await setSession(await api.patch('/me', body));
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  // GPS activé : la position du téléphone remplace la ville ; désactivé : la ville choisie reste fixe.
  const followLocation = async (on) => {
    if (!on) return patch({ prayerSettings: { followLocation: false } }, 'Horaires calculés pour ta ville enregistrée');
    const session = await syncLocation(user, { ask: true, force: true });
    if (session) {
      await setSession(session);
      toast(`Horaires à ta position : ${session.user.city?.name}`);
    } else {
      await patch({ prayerSettings: { followLocation: true } }, 'Autorise la localisation dans les réglages du téléphone');
    }
  };
  const consent = async (key, value) => {
    try {
      await setSession(await api.patch('/me/consents', { [key]: value }));
      if (key === 'health' && !value) router.replace('/consentement');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const open = (name, initial = {}) => {
    setDraft(initial);
    setSheet(name);
  };

  const exportData = async () => {
    try {
      const data = await api.get('/me/export');
      await Share.share({ title: 'Mes données Nissali', message: JSON.stringify(data, null, 2) });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const deleteAccount = () => {
    Alert.alert('Supprimer mon compte', 'Ton compte et toutes tes données (cycle, santé, jeûnes, rendez-vous) seront définitivement supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/me');
            await cancelAll();
            await signOut();
          } catch (e) {
            toast(e.message, 'error');
          }
        },
      },
    ]);
  };

  const sendIdCode = async () => {
    setBusy(true);
    try {
      const r = await api.post('/me/identifier/otp', { identifier: idValue });
      setIdSent(r);
      if (r.devCode) toast(`Code de test : ${r.devCode}`);
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

  const c = user.consents || {};
  const situationLabel = user.situation === 'mariee' ? 'Mariée' : 'Célibataire';

  return (
    <Screen back title="Mon profil">
      <Card style={{ gap: 4 }}>
        <Row gap={14}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }}>
            <T variant="h2" color={colors.bordeaux}>{(user.firstName || '?')[0]}</T>
          </View>
          <View style={{ flex: 1 }}>
            <Row gap={8}>
              <T variant="h3" style={{ flexShrink: 1 }} numberOfLines={1}>{user.firstName}</T>
              <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: practitioner ? '#F3E6D6' : colors.blush }}>
                <T variant="small" style={{ fontSize: 11.5, color: practitioner ? colors.or : colors.muted, fontWeight: '700' }}>{practitioner ? 'Praticienne' : 'Personnel'}</T>
              </View>
            </Row>
            <T variant="muted">
              {user.age ? `${user.age} ans · ` : ''}
              {user.city?.name} · {situationLabel}
            </T>
            <T variant="small" numberOfLines={1}>{user.email || user.phone}</T>
          </View>
        </Row>
        <Gap h={6} />
        <ListItem icon="user" title="Mes informations" subtitle="Prénom, âge, ville, situation" onPress={() => open('infos', { firstName: user.firstName, age: String(user.age || ''), city: user.city, situation: user.situation })} />
        <ListItem icon="mail" title="E-mail" subtitle={user.email || 'Ajouter une adresse e-mail'} onPress={() => { setIdValue(user.email || ''); setIdSent(null); setSheet('identifier'); }} />
        <ListItem icon="phone" title="Téléphone" subtitle={user.phone || 'Ajouter un numéro'} onPress={() => { setIdValue(user.phone || ''); setIdSent(null); setSheet('identifier'); }} />
        <ListItem icon="lock" title="Connexion et sécurité" subtitle={user.hasPassword ? 'Code ou mot de passe' : 'Connexion par code'} onPress={() => router.push('/securite')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Mon suivi</Label>
        <ListItem icon="heart" title="Objectif" subtitle={{ suivre: 'Suivre mon cycle', enfant: 'Avoir un enfant', enceinte: 'Je suis enceinte' }[user.onboarding?.goal || 'suivre']} onPress={() => open('goal', { goal: user.onboarding?.goal || 'suivre' })} />
        <ListItem icon="baby" title={user.mode === 'grossesse' ? 'Ma grossesse' : user.mode === 'postpartum' ? 'Post-partum' : 'Mode grossesse'} subtitle={user.mode === 'cycle' ? 'Activer le suivi de grossesse' : 'Voir mon suivi'} onPress={() => router.push('/grossesse')} />
        <ListItem icon="cycle" title="Profil particulier" subtitle={SPECIAL.find((s) => s.key === user.specialProfile)?.label} onPress={() => open('special', { specialProfile: user.specialProfile })} />
        <ListItem icon="drop" title="Contraception" subtitle={CONTRACEPTION.find((x) => x.key === user.contraception?.type)?.label} onPress={() => open('contraception', { ...user.contraception })} />
        <ListItem icon="chart" title="Ma santé et mes graphiques" onPress={() => router.push('/sante')} />
        <ListItem icon="calendar" title="Mes rendez-vous" onPress={() => router.push('/rendez-vous')} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label color={colors.or}>Prières</Label>
        <Toggle
          label="Horaires à ma position exacte (GPS)"
          hint={user.prayerSettings?.followLocation !== false ? `Actuellement : ${user.city?.name || '—'}${user.city?.source === 'gps' ? ' · position du téléphone' : ''}` : `Ville fixe : ${user.city?.name || '—'}`}
          value={user.prayerSettings?.followLocation !== false}
          onChange={followLocation}
        />
        <Toggle label="Notification à l’heure de chaque prière" value={user.prayerSettings?.notifications} onChange={(v) => patch({ prayerSettings: { notifications: v } })} />
        {/* 07 — Son de l'adhan : réglage distinct des rappels (il ne les réactive jamais). */}
        <ListItem icon="volume" title="Son de l’adhan" subtitle={adhanOn ? `Activé · ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((k) => user.prayerSettings?.adhanPrayers?.[k] !== false).length} prière(s) · ${adhans.data?.items?.find((a) => a.key === (user.prayerSettings?.adhanVoice || 'a9'))?.label || 'Mishary Rashid Alafasy'}` : 'Désactivé · notification seule'} onPress={() => setAdhanSound(true)} />
        <ListItem icon="compass" title="Qibla" onPress={() => router.push('/qibla')} />
        <ListItem icon="clock" title="Ajuster les horaires" subtitle="± quelques minutes pour suivre ta mosquée" onPress={() => open('adjust', { ...(user.prayerSettings?.adjustments || {}) })} last />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label color={colors.or}>Rappels de dhikr</Label>
        <T variant="small">Envoyés aux horaires de prière de ta position.</T>
        <Toggle label="Adhkar du matin" hint="20 min après Fajr" value={user.prayerSettings?.adhkarMorning !== false} onChange={(v) => patch({ prayerSettings: { adhkarMorning: v } })} />
        <Toggle label="Adhkar du soir" hint="20 min après Asr" value={user.prayerSettings?.adhkarEvening !== false} onChange={(v) => patch({ prayerSettings: { adhkarEvening: v } })} />
        <Toggle label="Vendredi (Jumu’a)" hint="Sourate Al-Kahf et salawat le matin, du’a à la dernière heure avant Maghrib" value={user.prayerSettings?.jumua !== false} onChange={(v) => patch({ prayerSettings: { jumua: v } })} />
        <Toggle label="Dhikr pendant mes règles" hint="À l’heure de chaque prière, à la place de la notification" value={user.prayerSettings?.dhikrDuringPeriod} onChange={(v) => patch({ prayerSettings: { dhikrDuringPeriod: v } })} />
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Notifications discrètes</Label>
        <T variant="small">Aucun mot sensible ne s’affiche sur l’écran verrouillé : seulement « Petit rappel du jour ».</T>
        {[
          ['periodSoon', 'Règles prévues (2 jours avant)'],
          ['fertileWindow', 'Fenêtre fertile (objectif enfant)'],
          ['periodEndQuestion', 'Question sur la fin des règles'],
          ['fastMakeup', 'Jour de rattrapage (la veille)'],
          ['ramadan', 'Ramadan'],
          ['whiteDays', 'Jours blancs'],
          ['dailyReminder', 'Petit rappel du jour'],
        ].map(([k, l]) => (
          <Toggle key={k} label={l} value={user.notificationPrefs?.[k] !== false} onChange={(v) => patch({ notificationPrefs: { [k]: v } })} />
        ))}
      </Card>
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Mes consentements</Label>
        <Toggle label="Traitement de mes données de santé" hint="Obligatoire pour le suivi" value={c.health?.accepted} onChange={(v) => consent('health', v)} />
        <Toggle label="Actualités par e-mail" value={c.marketingEmail?.accepted} onChange={(v) => consent('marketingEmail', v)} />
        <Toggle label="Actualités par SMS" value={c.marketingSms?.accepted} onChange={(v) => consent('marketingSms', v)} />
        <Toggle label="Actualités par WhatsApp" value={c.marketingWhatsapp?.accepted} onChange={(v) => consent('marketingWhatsapp', v)} />
      </Card>
      <Gap />

      <ProSpaceCard />
      <Gap />

      <Card style={{ gap: 4 }}>
        <ListItem icon="share" title="Exporter mes données" onPress={exportData} />
        <ListItem icon="info" title="Conditions d’utilisation" onPress={() => router.push('/legal?doc=cgu')} />
        <ListItem icon="info" title="Politique de confidentialité" onPress={() => router.push('/legal?doc=confidentialite')} />
        <ListItem icon="logout" title="Me déconnecter" onPress={signOut} />
        <ListItem icon="trash" title="Supprimer mon compte" subtitle="Définitif, toutes tes données sont effacées" onPress={deleteAccount} last />
      </Card>
      <Gap />
      <T variant="small" style={{ textAlign: 'center' }}>Les règles présentées sont l’avis retenu par notre comité. En cas de doute, rapproche-toi d’une personne de science.</T>
      <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>Nissali · 100 % gratuite · nissali@gmail.com</T>

      <Sheet visible={sheet === 'infos'} onClose={() => setSheet(null)} title="Mes informations" footer={<Button title="Enregistrer" onPress={() => patch({ firstName: draft.firstName, age: Number(draft.age), city: draft.city, situation: draft.situation, ...(draft.city !== user.city && draft.city ? { prayerSettings: { followLocation: draft.city.source === 'gps' } } : {}) }).then(() => setSheet(null))} disabled={!(Number(draft.age) >= 15)} />}>
        <Field label="Prénom" value={draft.firstName} onChangeText={(v) => setDraft((d) => ({ ...d, firstName: v }))} />
        <Field label="Âge" value={draft.age} onChangeText={(v) => setDraft((d) => ({ ...d, age: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
        <CityPicker value={draft.city} onChange={(v) => setDraft((d) => ({ ...d, city: v }))} />
        <T variant="fieldLabel">Situation</T>
        <Chips items={[{ key: 'celibataire', label: 'Célibataire' }, { key: 'mariee', label: 'Mariée' }]} value={draft.situation} onChange={(v) => setDraft((d) => ({ ...d, situation: v }))} />
      </Sheet>

      <Sheet
        visible={sheet === 'adhan'}
        onClose={() => {
          stopAdhan();
          setSheet(null);
        }}
        title="Voix de l’adhan"
        footer={
          <Button
            title="Enregistrer"
            onPress={() => {
              stopAdhan();
              patch({ prayerSettings: { adhanVoice: draft.adhanVoice } }).then(() => setSheet(null));
            }}
          />
        }
      >
        <T variant="small">Enregistrements diffusés par Aladhan. L’adhan choisi est joué à l’heure de chaque prière.</T>
        {(adhans.data?.items || []).map((a) => {
          const selected = draft.adhanVoice === a.key;
          const isPlaying = preview === a.key;
          return (
            <Row key={a.key} gap={10} style={[s.voice, selected && s.voiceSelected]}>
              <Pressable onPress={() => setDraft({ adhanVoice: a.key })} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <T variant="medium">{a.label}</T>
                  <T variant="small">{a.detail}</T>
                </View>
              </Pressable>
              <Pressable
                onPress={() => (isPlaying ? stopAdhan() : playAdhan({ ...a, prayer: 'Aperçu' }))}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Arrêter' : `Écouter ${a.label}`}
                hitSlop={6}
                style={s.play}
              >
                <Icon name={isPlaying ? 'stop' : 'volume'} size={18} color={colors.bordeaux} />
              </Pressable>
            </Row>
          );
        })}
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

      <Sheet visible={sheet === 'adjust'} onClose={() => setSheet(null)} title="Ajuster mes horaires" footer={<Button title="Enregistrer" onPress={() => patch({ prayerSettings: { adjustments: draft } }).then(() => setSheet(null))} />}>
        {PRAYERS.map((p) => (
          <Stepper key={p} label={PRAYER_LABELS[p]} value={draft[p] || 0} onChange={(v) => setDraft((d) => ({ ...d, [p]: v }))} min={-30} max={30} suffix=" min" />
        ))}
        <T variant="small">La méthode de calcul est choisie par notre comité. Ajuste de quelques minutes pour t’aligner sur ta mosquée.</T>
      </Sheet>

      <Sheet visible={sheet === 'identifier'} onClose={() => setSheet(null)} title="Mon identifiant" footer={idSent ? <Button title="Vérifier" onPress={() => verifyId()} loading={busy} disabled={code.length !== 6} /> : <Button title="Recevoir un code" onPress={sendIdCode} loading={busy} disabled={idValue.length < 4} />}>
        {!idSent ? (
          <Field label="E-mail ou téléphone" value={idValue} onChangeText={setIdValue} autoCapitalize="none" keyboardType="email-address" />
        ) : (
          <>
            <T variant="muted">Code envoyé à {idSent.target}</T>
            <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) verifyId(v); }} />
            {idSent.devCode ? <T variant="small">Code de test : {idSent.devCode}</T> : null}
          </>
        )}
      </Sheet>
      <AdhanSoundSheet visible={adhanSound} onClose={() => setAdhanSound(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  voice: { borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.white },
  voiceSelected: { borderColor: colors.bordeaux, backgroundColor: colors.blush },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.bordeaux },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});
