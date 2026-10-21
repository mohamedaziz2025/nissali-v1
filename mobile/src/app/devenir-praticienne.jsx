// 4.14 — Configurer mon profil praticienne (4 écrans) : 9.5 métier, lieux, ville ; 9.6 présentation et tarif ;
// 9.7 justificatifs (identité obligatoire, diplôme et RC Pro facultatifs, RPPS pour les diététiciennes, matériel
// stérile pour la hijama) ; 9.8 aperçu et envoi ; 9.9 dossier envoyé. Brouillon gardé à chaque écran
// (« Plus tard » → profil « à compléter »). Un seul compte (RG-50) : le profil s'ajoute au compte perso.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import { SignupShell } from '../components/Signup';
import { Checkbox, Chip, Field, Loader, T, Toggle, useToast } from '../components/ui';
import { api, assetUrl, request, uploadImage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const DOCS = [
  { kind: 'identity', label: tr("Pièce d’identité"), required: true, hint: tr("Carte d’identité, passeport ou titre de séjour") },
  { kind: 'diploma', label: tr("Diplôme ou certificat"), hint: tr("Facultatif : vérifié, il t’apporte le badge « Diplômée »") },
  { kind: 'rcPro', label: tr("Assurance RC Pro"), hint: tr("Facultatif") },
];

async function uploadDoc(kind, asset) {
  const form = new FormData();
  if (Platform.OS === 'web') form.append('file', await (await fetch(asset.uri)).blob(), asset.name || 'document');
  else form.append('file', { uri: asset.uri, name: asset.name || 'document', type: asset.mimeType || 'application/octet-stream' });
  return request('POST', `/pro-profile/documents/${kind}`, form, { timeout: 60000 });
}

export default function BecomePractitioner() {
  const { from } = useLocalSearchParams();
  const fromSignup = from === 'inscription';
  const toast = useToast();
  const { setSession, refresh } = useAuth();
  const [info, setInfo] = useState(null);
  const [d, setD] = useState({ specialty: null, otherSpecialty: '', places: { visio: false, domicile: false, cabinet: false }, address: '', city: '', lastName: '', description: '', service: { name: '', durationMinutes: 60, price: '' }, showPhone: false, rpps: '', sterile: false, photoUrl: null, charter: false });
  const [docs, setDocs] = useState({});
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    api
      .get('/pro-profile')
      .then((r) => {
        if (r.practitioner) return router.replace('/espace-praticienne');
        setInfo(r);
        setDocs(r.draft.documents || {});
        setD((x) => ({ ...x, city: r.city, ...r.draft.data, places: { ...x.places, ...(r.draft.data?.places || {}) }, service: { ...x.service, ...(r.draft.data?.service || {}) } }));
        setStep(Math.min(4, Math.max(1, r.draft.step || 1)));
      })
      .catch((e) => setError(e.message));
  }, []);

  const leave = () => {
    refresh?.().catch(() => {});
    router.replace(fromSignup ? '/accueil?step=notifications' : '/profil');
  };
  const saveDraft = async (nextStep, later = false) => {
    const data = { ...d, service: { ...d.service, price: d.service.price === '' ? '' : Number(d.service.price) } };
    await api.put('/pro-profile/draft', { step: nextStep, data, later });
  };
  const later = async () => {
    setBusy(true);
    try {
      await saveDraft(step, true);
      toast(tr("Brouillon enregistré : tu pourras terminer depuis ton profil"));
      leave();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!info && !error) return <View style={{ flex: 1, backgroundColor: colors.ivoire }}><Loader /></View>;
  const cat = info?.categories.find((c) => c.key === d.specialty);
  const name = `${info?.firstName || ''} ${d.lastName ? `${d.lastName.trim()[0].toUpperCase()}.` : ''}`.trim();
  const desc = d.description.trim();
  const price = Number(d.service.price);

  const valid = {
    1: Boolean(d.specialty) && (d.specialty !== 'autre' || (d.otherSpecialty.trim().length >= 3 && d.otherSpecialty.trim().length <= 40)) && (d.places.visio || d.places.domicile || d.places.cabinet) && (!d.places.cabinet || d.address.trim().length >= 5) && d.city.trim().length > 1,
    2: d.lastName.trim().length >= 1 && desc.length >= 50 && desc.length <= 600 && d.service.name.trim().length >= 2 && d.service.price !== '' && price >= 0 && d.service.durationMinutes >= 10,
    3: Boolean(docs.identity) && (!cat?.requiresRpps || /^\d{11}$/.test(d.rpps)) && (!cat?.requiresSterile || d.sterile),
    4: d.charter,
  }[step];

  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      if (step < 4) {
        await saveDraft(step + 1);
        setStep(step + 1);
      } else {
        await saveDraft(4);
        const r = await api.post('/pro-profile/submit', { charter: true });
        await setSession(r);
        setSent(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickDoc = async (kind) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.size && a.size > 10 * 1024 * 1024) return toast(tr("10 Mo maximum"), 'error');
    setUploading(kind);
    try {
      const meta = await uploadDoc(kind, a);
      setDocs((x) => ({ ...x, [kind]: meta }));
      toast(tr("Document ajouté"));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(null);
    }
  };
  const takePhoto = async (kind) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast(tr("Autorise l’appareil photo dans les réglages"), 'error');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, exif: false });
    if (r.canceled) return;
    const a = r.assets[0];
    setUploading(kind);
    try {
      const meta = await uploadDoc(kind, { uri: a.uri, name: 'photo.jpg', mimeType: 'image/jpeg' });
      setDocs((x) => ({ ...x, [kind]: meta }));
      toast(tr("Document ajouté"));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(null);
    }
  };
  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (r.canceled) return;
    try {
      const up = await uploadImage('/pro-profile/photo', 'photo', r.assets[0].uri, r.assets[0].mimeType);
      set('photoUrl')(up.photoUrl);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (sent) {
    return (
      <SignupShell section="Profil praticienne" index={4} count={4} title={tr("Dossier envoyé")} subtitle={tr("Merci ! L’équipe vérifie ta pièce d’identité sous 48 h.")} onNext={leave} nextLabel={fromSignup ? tr("Continuer mon inscription") : tr("Retour à mon profil")}>
        {[
          ['check', 'Profil rempli', true],
          ['clock', 'Vérification (48 h)', false],
          ['star', 'Fiche en ligne', false],
        ].map(([icon, label, done], i) => (
          <View key={label} style={s.timeline}>
            <View style={[s.dot, done && s.dotDone]}>
              <Icon name={icon} size={15} color={done ? colors.white : colors.bordeaux} />
            </View>
            <Text style={[s.timelineText, i === 1 && { color: colors.bordeaux }]}>{label}</Text>
          </View>
        ))}
        <T variant="small">{tr("Tu recevras une notification et un e-mail au résultat. Ta fiche ne montre jamais tes données personnelles (cycle, notes, prières).")}</T>
      </SignupShell>
    );
  }

  const titles = {
    1: [tr("Ton métier"), tr("Liste des métiers proposés dans Nissali (aucun métier médical).")],
    2: [tr("Ta présentation"), tr("Ce que les sœurs verront sur ta fiche.")],
    3: [tr("Tes justificatifs"), tr("Chiffrés et vus seulement par l’équipe Nissali.")],
    4: [tr("Aperçu"), tr("Ta fiche telle que les sœurs la verront.")],
  }[step];

  const content = {
    1: (
      <>
        <View style={s.chips}>
          {info.categories.map((c) => (
            <Chip key={c.key} label={c.label} selected={d.specialty === c.key} onPress={() => set('specialty')(c.key)} />
          ))}
        </View>
        {d.specialty === 'autre' ? <Field label={tr("Ton métier")} value={d.otherSpecialty} onChangeText={(v) => set('otherSpecialty')(v.slice(0, 40))} placeholder={tr("3 à 40 caractères")} hint={tr("Masqué sur ta fiche jusqu’à validation par l’équipe")} /> : null}
        <T variant="fieldLabel">{tr("Où reçois-tu ?")}</T>
        <View style={s.chips}>
          {[['visio', 'En visio'], ['domicile', 'À domicile'], ['cabinet', 'En cabinet']].map(([k, l]) => (
            <Chip key={k} label={l} selected={d.places[k]} onPress={() => setD((x) => ({ ...x, places: { ...x.places, [k]: !x.places[k] } }))} />
          ))}
        </View>
        {d.places.cabinet ? <Field label={tr("Adresse du cabinet")} value={d.address} onChangeText={set('address')} placeholder={tr("Jamais affichée : seule la ville l’est")} /> : null}
        <Field label={tr("Ville")} value={d.city} onChangeText={set('city')} placeholder={tr("Ta ville d’exercice")} />
      </>
    ),
    2: (
      <>
        <View style={s.photoRow}>
          <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={tr("Ajouter une photo ou un logo")} style={s.photo}>
            {d.photoUrl ? <Image source={{ uri: assetUrl(d.photoUrl) }} style={s.photoImg} /> : <Text style={s.photoInitials}>{(info.firstName || '?')[0]}{d.lastName ? d.lastName[0].toUpperCase() : ''}</Text>}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.photoTitle}>{tr("Photo ou logo")}</Text>
            <T variant="small">{tr("Facultatif : sinon tes initiales.")}</T>
          </View>
        </View>
        <Field label={tr("Ton nom")} value={d.lastName} onChangeText={set('lastName')} placeholder={tr("Seule l’initiale est affichée")} hint={tr("Nom affiché : {0}", [name])} />
        <View style={{ gap: 6 }}>
          <T variant="fieldLabel">{tr("Présentation")}</T>
          <TextInput value={d.description} onChangeText={(v) => set('description')(v.slice(0, 600))} multiline placeholder={tr("Ton approche, ton parcours, ce que tu proposes…")} placeholderTextColor={colors.muted} style={s.area} accessibilityLabel={tr("Présentation")} />
          <Text style={[s.counter, (desc.length < 50 || desc.length > 600) && { color: colors.danger }]}>{desc.length} {tr("/ 600 · 50 minimum")}</Text>
        </View>
        <T variant="fieldLabel">{tr("Ton premier tarif")}</T>
        <Field value={d.service.name} onChangeText={(v) => setD((x) => ({ ...x, service: { ...x.service, name: v } }))} placeholder={tr("Intitulé (ex. Première consultation)")} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={tr("Durée (min)")} value={String(d.service.durationMinutes || '')} onChangeText={(v) => setD((x) => ({ ...x, service: { ...x.service, durationMinutes: Number(v.replace(/\D/g, '').slice(0, 3)) || 0 } }))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={tr("Prix (€)")} value={String(d.service.price)} onChangeText={(v) => setD((x) => ({ ...x, service: { ...x.service, price: v.replace(/[^\d]/g, '').slice(0, 5) } }))} keyboardType="number-pad" hint={d.service.price !== '' ? tr("Affiché « dès {0} € »", [price]) : null} />
          </View>
        </View>
        <Toggle label={tr("Afficher mon téléphone")} hint={info.phone ? tr("{0} · la messagerie reste toujours ouverte", [info.phone]) : tr("Ajoute un numéro dans ton profil")} value={d.showPhone} onChange={set('showPhone')} />
      </>
    ),
    3: (
      <>
        {DOCS.map((doc) => (
          <View key={doc.kind} style={[s.doc, docs[doc.kind] && s.docDone]}>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>
                {doc.label}
                {doc.required ? <Text style={{ color: colors.bordeaux }}> {tr("· obligatoire")}</Text> : null}
              </Text>
              <Text style={s.docHint} numberOfLines={2}>{docs[doc.kind] ? `✓ ${docs[doc.kind].name}` : doc.hint}</Text>
            </View>
            {uploading === doc.kind ? (
              <Loader />
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Platform.OS !== 'web' ? (
                  <Pressable onPress={() => takePhoto(doc.kind)} accessibilityRole="button" accessibilityLabel={tr("Photographier : {0}", [doc.label])} style={s.docBtn}>
                    <Icon name="eye" size={16} color={colors.bordeaux} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => pickDoc(doc.kind)} accessibilityRole="button" accessibilityLabel={tr("Choisir un fichier : {0}", [doc.label])} style={s.docBtn}>
                  <Icon name={docs[doc.kind] ? 'edit' : 'plus'} size={16} color={colors.bordeaux} />
                </Pressable>
              </View>
            )}
          </View>
        ))}
        <T variant="small">{tr("PDF, JPG ou PNG, 10 Mo maximum.")}</T>
        {cat?.requiresRpps ? <Field label={tr("Numéro RPPS")} value={d.rpps} onChangeText={(v) => set('rpps')(v.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" placeholder={tr("11 chiffres")} hint={tr("Obligatoire : diététicienne est un titre protégé")} /> : null}
        {cat?.requiresSterile ? (
          <Checkbox checked={d.sterile} onChange={set('sterile')}>
            <T>{tr("J’utilise du matériel stérile à usage unique et j’informe sur les contre-indications.")} <T variant="small">{tr("(obligatoire)")}</T></T>
          </Checkbox>
        ) : null}
      </>
    ),
    4: (
      <>
        <View style={s.preview}>
          <View style={s.previewPhoto}>{d.photoUrl ? <Image source={{ uri: assetUrl(d.photoUrl) }} style={s.photoImg} /> : <Text style={s.photoInitials}>{(info.firstName || '?')[0]}{d.lastName ? d.lastName[0].toUpperCase() : ''}</Text>}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.previewName}>{name}</Text>
            <Text style={s.previewMeta}>{d.specialty === 'autre' ? tr("Praticienne") : cat?.label} · {d.city}</Text>
            <Text style={s.previewMeta}>{tr("Nouvelle sur Nissali")}</Text>
            <View style={s.tags}>
              {d.places.cabinet ? <Text style={s.tag}>{tr("Cabinet")}</Text> : null}
              {d.places.visio ? <Text style={s.tag}>{tr("Visio")}</Text> : null}
              {d.places.domicile ? <Text style={s.tag}>{tr("Domicile")}</Text> : null}
            </View>
          </View>
          <Text style={s.previewPrice}>{tr("dès")} {price} €</Text>
        </View>
        {cat?.disclaimer ? <T variant="small">{tr("Mention ajoutée sur ta fiche : «")} {cat.disclaimer} ».</T> : null}
        {[
          [1, 'Métier, lieux et ville', `${d.specialty === 'autre' ? d.otherSpecialty : cat?.label} · ${d.city}`],
          [2, 'Présentation et tarif', `${d.service.name} · ${d.service.durationMinutes} min · ${price} €`],
          [3, 'Justificatifs', `${Object.values(docs).filter(Boolean).length} document(s)`],
        ].map(([n, label, value]) => (
          <Pressable key={n} onPress={() => setStep(n)} accessibilityRole="button" style={s.recap}>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>{label}</Text>
              <Text style={s.docHint} numberOfLines={1}>{value}</Text>
            </View>
            <Text style={s.link}>{tr("Modifier")}</Text>
          </Pressable>
        ))}
        <Checkbox checked={d.charter} onChange={set('charter')}>
          <T>
            {tr("J’accepte la")} <T color={colors.bordeaux} onPress={() => router.push('/legal?doc=charte')}>{tr("charte des praticiennes Nissali")}</T>.
          </T>
        </Checkbox>
      </>
    ),
  }[step];

  return (
    <SignupShell
      section="Profil praticienne"
      index={step}
      count={4}
      title={titles[0]}
      subtitle={titles[1]}
      onBack={step > 1 ? () => setStep(step - 1) : () => (router.canGoBack() ? router.back() : leave())}
      onNext={next}
      nextLabel={step === 4 ? tr("Envoyer pour vérification") : tr("Continuer")}
      canNext={valid}
      busy={busy}
      error={error}
      secondary={
        <Pressable onPress={later} disabled={busy} accessibilityRole="button" style={s.later}>
          <Text style={s.laterText}>{tr("Plus tard")}</Text>
        </Pressable>
      }
    >
      {content}
    </SignupShell>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoInitials: { fontFamily: fonts.extra, fontSize: 24, color: colors.bordeaux },
  photoTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  area: { minHeight: 140, borderRadius: 20, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, padding: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.prune, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'right' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  docDone: { borderStyle: 'solid', borderColor: colors.sable, backgroundColor: colors.sable },
  docTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  docHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  docBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: colors.line },
  previewPhoto: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewName: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  previewMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  previewPrice: { fontFamily: fonts.extra, fontSize: 14, color: colors.bordeaux },
  tags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { fontFamily: fonts.bold, fontSize: 11, color: colors.bordeaux, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.or, borderColor: colors.or },
  timelineText: { fontFamily: fonts.bold, fontSize: 16, color: colors.prune },
});
