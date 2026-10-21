// Mise à jour Accueil (page 7) — carte Jours blancs, sous la carte Règles. Affiche les 3 dates grégoriennes
// (13, 14, 15 du mois hégirien) ; pendant les jours blancs, bouton « J'ai jeûné » (même action que Jeûnes ›
// Surérogatoires). Si elle a ses règles pendant les jours blancs : carte grisée, sans bouton.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { useToast } from './ui';
import { api } from '../lib/api';

import { tr } from '../lib/i18n';
import { MONTHS_SHORT as FMT_MONTHS_SHORT } from '../lib/format';
const MONTHS_SHORT = FMT_MONTHS_SHORT;
const dayOf = (iso) => Number(iso.slice(8, 10));
const monthOf = (iso) => MONTHS_SHORT[Number(iso.slice(5, 7)) - 1];

/** « 24, 25 et 26 oct. » */
function datesLabel(days) {
  const nums = days.map((d) => dayOf(d.day));
  const month = monthOf(days[days.length - 1].day);
  const sameMonth = days.every((d) => monthOf(d.day) === month);
  if (sameMonth) return tr("les {0} et {1} {2}", [nums.slice(0, -1).join(', '), nums[nums.length - 1], month]);
  return `les ${days.map((d) => `${dayOf(d.day)} ${monthOf(d.day)}`).join(', ')}`;
}

export default function WhiteDaysCard({ whiteDays, inPeriod, today, onChanged }) {
  const toast = useToast();
  if (!whiteDays?.days?.length) return null;
  const { daysUntil, inProgress, days, fastedToday } = whiteDays;

  const jeuner = async () => {
    try {
      await api.post('/fasts/voluntary', { day: today, type: 'jours_blancs' });
      toast(tr("Qu’Allah l’accepte de toi !"));
      onChanged?.();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (inProgress && inPeriod) {
    return (
      <View style={[s.card, s.cardOff]}>
        <View style={[s.icon, s.iconOff]}>
          <Icon name="moon" size={18} color={colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titleOff}>{tr("Jours blancs · pas cette fois")}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={() => router.push('/jeunes?section=blancs')} accessibilityRole="button" style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}>
      <View style={s.icon}>
        <Icon name="moon" size={18} color={colors.bordeaux} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.surtitle}>{tr("JOURS BLANCS")}</Text>
        <Text style={s.title}>{inProgress ? tr("Aujourd’hui, 1er jour blanc") : tr("Dans {0} jour{1}", [daysUntil, daysUntil > 1 ? 's' : ''])}</Text>
        <Text style={s.sub}>{inProgress ? tr("Jeûne recommandé jusqu’au {0} {1}", [dayOf(days[days.length - 1].day), monthOf(days[days.length - 1].day)]) : tr("Jeûne recommandé {0}", [datesLabel(days)])}</Text>
      </View>
      {inProgress ? (
        <Pressable onPress={jeuner} disabled={fastedToday} accessibilityRole="button" accessibilityLabel={fastedToday ? tr("Déjà noté") : tr("J’ai jeûné")} style={[s.btn, fastedToday && s.btnDone]}>
          {fastedToday ? <Icon name="check" size={15} color={colors.orText} strokeWidth={2.6} /> : <Text style={s.btnText}>{tr("J’ai jeûné")}</Text>}
        </Pressable>
      ) : (
        <Icon name="chevronRight" size={18} color={colors.muted} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.line },
  cardOff: { backgroundColor: colors.ivoire, borderColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sable, alignItems: 'center', justifyContent: 'center' },
  iconOff: { backgroundColor: colors.line },
  surtitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.orText },
  title: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  titleOff: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.muted },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  btn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  btnDone: { backgroundColor: colors.sable, paddingHorizontal: 10 },
  btnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
});
