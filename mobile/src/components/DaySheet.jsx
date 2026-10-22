// Mise à jour Cycle · 6.4 — Détail d'un jour (feuille sur le calendrier) : date, jour du cycle, date hégirienne.
// Bandeau règles si c'est un jour de règles (gouttes = flux, « Modifier » → 6.5) ; sinon phase et prévision.
// Mon journal du jour : Humeur, Symptômes (→ 6.7 sur ce jour), Note (→ Nouvelle note ce jour-là).
// Ce jour-là : prières en pause, jeûne prévu, notes et rappels du jour.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { addDays, dayMonth, longDate } from '../lib/format';
import { colors, fonts, MOODS, SYMPTOMS } from '../theme';
import { BloodDrops, FLOW_DROPS } from './Flow';
import Icon from './Icon';
import { Button, Loader, Sheet, T } from './ui';

import { tr } from '../lib/i18n';
const FLOW = { traces: tr("traces"), leger: tr("flux léger"), moyen: tr("flux moyen"), abondant: tr("flux abondant") };

function Line({ icon, color = colors.bordeaux, title, value, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={s.line}>
      <Icon name={icon} size={16} color={color} />
      <Text style={s.lineTitle} numberOfLines={2}>{title}</Text>
      {value ? <Text style={s.lineValue} numberOfLines={1}>{value}</Text> : null}
    </Comp>
  );
}

function Chip({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.chip, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={15} color={colors.bordeaux} />
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function DaySheet({ day, onClose, onStartPeriod, periodLength = 5 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(null);
    setError(null);
    if (day) api.get(`/cycle/day/${day}`).then(setData).catch(setError);
  }, [day]);

  const d = data;
  const future = d && d.day > d.today;
  const go = (to) => {
    onClose();
    router.push(to);
  };
  const hijri = d?.hijri ? d.hijri.replace(/\s\d{4}$/, '') : null;
  const mood = d?.log?.mood ? MOODS.find((m) => m.key === d.log.mood)?.label : null;
  const symptoms = (d?.log?.symptoms || []).map((k) => SYMPTOMS[k] || k);
  const hayd = d?.period && d.period.kind !== 'nifas';
  const expectedEnd = d?.period ? addDays(d.period.start, periodLength - 1) : null;

  return (
    <Sheet
      visible={Boolean(day)}
      onClose={onClose}
      title={day ? longDate(day) : ''}
      footer={
        d && !future && !d.period ? (
          <Button
            title={tr("Mes règles ont commencé ce jour-là")}
            variant="outline"
            onPress={() => {
              onClose();
              onStartPeriod?.(d.day);
            }}
          />
        ) : null
      }
    >
      {!d && !error ? <Loader /> : null}
      {error ? <T variant="muted">{error.message}</T> : null}
      {d ? (
        <>
          <Text style={s.meta}>{[d.cycleDay ? tr("Jour {0} du cycle", [d.cycleDay]) : null, hijri].filter(Boolean).join(' · ')}</Text>

          {d.period ? (
            <View style={s.banner}>
              <BloodDrops count={FLOW_DROPS[d.period.flow] || 1} color={colors.white} size={13} />
              <View style={{ flex: 1 }}>
                <Text style={s.bannerTitle}>{d.period.kind === 'nifas' ? tr("Nifas") : tr("Règles notées")}{d.period.flow ? ` · ${FLOW[d.period.flow]}` : ''}</Text>
                <Text style={s.bannerSub}>{d.period.kind === 'nifas' ? tr("Jour {0}", [d.period.day]) : d.period.end ? tr("Terminées le {0}", [dayMonth(d.period.end)]) : tr("Fin prévue vers le {0}", [dayMonth(expectedEnd)])}</Text>
              </View>
              <Pressable onPress={() => go(d.period.kind === 'nifas' ? '/grossesse' : '/mes-regles')} accessibilityRole="button" style={s.modify}>
                <Text style={s.modifyText}>{tr("Modifier")}</Text>
              </Pressable>
            </View>
          ) : d.phase || d.forecast ? (
            <View style={s.phase}>
              <Text style={s.phaseTitle}>
                {d.forecast?.period ? tr("Règles prévues (estimation)") : d.forecast?.ovulation ? tr("Ovulation (estimation)") : d.forecast?.fertile ? tr("Fenêtre fertile (estimation)") : d.phase ? tr("Phase {0}", [d.phase.label.toLowerCase()]) : ''}
              </Text>
              {future ? <Text style={s.phaseSub}>{tr("Les prévisions sont indicatives.")}</Text> : null}
            </View>
          ) : null}

          <Text style={s.section}>{tr("MON JOURNAL DU JOUR")}</Text>
          <View style={s.chips}>
            {!future ? <Chip icon="sparkle" label={mood ? tr("Humeur · {0}", [mood]) : tr("Humeur")} onPress={() => go(`/sante?day=${d.day}`)} /> : null}
            {!future ? <Chip icon="plus" label={symptoms.length ? tr("Symptômes · {0}", [symptoms.length]) : tr("Symptômes")} onPress={() => go(`/sante?day=${d.day}`)} /> : null}
            <Chip icon="edit" label={tr("Note")} onPress={() => go(`/notes/nouvelle?day=${d.day}`)} />
          </View>

          {hayd || d.fast || d.notes.length ? (
            <>
              <Text style={s.section}>{tr("CE JOUR-LÀ")}</Text>
              <View style={{ gap: 8 }}>
                {hayd ? <Line icon="pause" color={colors.orText} title={tr("Prières en pause")} value={tr("horaires affichés")} /> : null}
                {d.fast ? <Line icon="moon" color={colors.orText} title={d.fast.label} value={d.fast.status === 'fait' ? tr("Jeûné") : tr("Prévu")} onPress={() => go('/jeunes')} /> : null}
                {d.notes.map((n) => (
                  <Line key={n.id} icon="note" color={colors.or} title={n.text} value={[n.time, n.repeat && n.repeat !== 'once' ? n.repeatLabel : null].filter(Boolean).join(' · ') || null} onPress={() => go(`/notes/nouvelle?id=${n.id}`)} />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: -6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bordeaux, borderRadius: 18, padding: 14 },
  bannerTitle: { fontFamily: fonts.extra, fontSize: 14.5, color: colors.white },
  bannerSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.onBordeaux, marginTop: 2 },
  modify: { backgroundColor: colors.onBordeauxSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  modifyText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  phase: { backgroundColor: colors.blush, borderRadius: 18, padding: 14, gap: 2 },
  phaseTitle: { fontFamily: fonts.extra, fontSize: 14.5, color: colors.prune },
  phaseSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  section: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  chipText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: 14, paddingHorizontal: 14, minHeight: 46 },
  lineTitle: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.prune },
  lineValue: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, maxWidth: '45%' },
});
