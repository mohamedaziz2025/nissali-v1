// 4.3 / RG-46 — Carte contextuelle de l'accueil : jamais plus d'une à la fois (le serveur envoie les cas par ordre de
// priorité), seulement quand c'est utile. Masquer (croix) : la carte disparaît jusqu'au lendemain pour ce cas,
// le choix est gardé sur le téléphone.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, sendOrQueue } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { useToast } from './ui';

const HIDDEN = 'nissali.contextHidden';
const STYLE = {
  ghusl: { bg: colors.blush, icon: 'drop' },
  retard: { bg: colors.white, icon: 'clock', border: true },
  jeune: { bg: colors.sable, icon: 'fasts' },
  jeune_fait: { bg: colors.sable, icon: 'moon' },
  ramadan: { bg: colors.bordeaux, icon: 'moon', dark: true },
  veille: { bg: colors.sable, icon: 'calendar' },
  vendredi: { bg: colors.sable, icon: 'home' },
};

export default function ContextCard({ cards = [], today, onStartPeriod, onChanged }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    readJson(HIDDEN, {}).then(setHidden).catch(() => setHidden({}));
  }, []);
  if (!hidden) return null;
  const card = cards.find((c) => hidden[c.key] !== today);
  if (!card) return null;
  const st = STYLE[card.key] || STYLE.veille;

  const hide = async () => {
    const next = { ...hidden, [card.key]: today };
    setHidden(next);
    await writeJson(HIDDEN, next).catch(() => {});
  };
  const open = () => {
    if (card.key === 'ghusl') router.push('/ghusl');
    else if (card.key === 'retard') onStartPeriod?.();
    else if (card.key === 'ramadan' || card.key.startsWith('jeune') || card.key === 'veille') router.push(card.fast?.kind === 'volontaire' ? '/jeunes?tab=volontaires' : '/jeunes');
    else if (card.key === 'vendredi') router.push('/horaires');
  };
  // B — « Oui, j'ai jeûné » : coche le jour (rattrapage) ou l'ajoute aux jeûnes de l'année. Rien n'est coché tout seul (RG-32).
  const fasted = async () => {
    setBusy(true);
    try {
      if (card.fast?.kind === 'rattrapage') await sendOrQueue('POST', '/fasts/made-up', { day: today });
      else await api.post('/fasts/voluntary', { day: today, type: card.fast?.type || 'autre' });
      toast('Qu’Allah l’accepte de toi !');
      onChanged?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const notFasted = async () => {
    await hide();
    toast('D’accord, rien n’est coché. Tu peux décaler ce jour dans ton programme.');
  };

  const dark = st.dark;
  const actionBtn = (title, onPress, primary = true) => (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={[s.btn, primary ? (dark ? s.btnLight : s.btnPrimary) : s.btnGhost]}>
      <Text style={[s.btnText, primary ? { color: dark ? colors.bordeaux : colors.white } : { color: colors.prune }]}>{title}</Text>
    </Pressable>
  );

  return (
    <Pressable onPress={open} accessibilityRole="button" style={[s.card, { backgroundColor: st.bg }, st.border && s.border]}>
      <View style={s.row}>
        <View style={[s.icon, dark && { backgroundColor: colors.onBordeauxSurface }]}>
          <Icon name={st.icon} size={19} color={dark ? colors.white : colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, dark && { color: colors.white }]}>{card.title}</Text>
          <Text style={[s.sub, dark && { color: colors.onBordeaux }]}>{card.subtitle}</Text>
        </View>
        {card.key === 'ghusl' ? actionBtn('Continuer', () => router.push('/ghusl')) : null}
        {card.key === 'retard' ? actionBtn('Noter', () => onStartPeriod?.()) : null}
        {card.dismissable && card.key !== 'retard' && card.key !== 'ramadan' ? (
          <Pressable onPress={hide} accessibilityRole="button" accessibilityLabel="Masquer jusqu’à demain" hitSlop={10} style={s.close}>
            <Icon name="close" size={14} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {card.key === 'jeune' ? (
        <View style={s.bar}>
          <Text style={s.barTime}>{card.fajr}</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.round(card.progress * 100)}%` }]} />
          </View>
          <Text style={s.barTime}>{card.maghrib}</Text>
        </View>
      ) : null}
      {card.key === 'jeune_fait' ? (
        <View style={s.actions}>
          <View style={{ flex: 1 }}>{actionBtn('Oui, j’ai jeûné', fasted)}</View>
          <View style={{ flex: 1 }}>{actionBtn('Non', notFasted, false)}</View>
        </View>
      ) : null}
      {card.key === 'ramadan' ? <View style={{ alignSelf: 'flex-start' }}>{actionBtn('Voir mes jours', () => router.push('/jeunes'))}</View> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, padding: 16, gap: 12 },
  border: { borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 1 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.bordeaux },
  btnLight: { backgroundColor: colors.white },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineField },
  btnText: { fontFamily: fonts.bold, fontSize: 13.5 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTime: { fontFamily: fonts.bold, fontSize: 12, color: colors.orText, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.white, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.or },
  actions: { flexDirection: 'row', gap: 10 },
});
