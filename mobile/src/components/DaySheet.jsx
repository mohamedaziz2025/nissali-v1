// 4.7 · 6.3 — Détail d'un jour (feuille ouverte en touchant une date du calendrier) : date, jour du cycle, phase,
// date hégirienne ; jeûne prévu ou fait, notes, règles et flux, symptômes ; prévisions si le jour est futur.
// Boutons : futur → « Ajouter une note ce jour-là » ; aujourd'hui ou passé → note, Suivi santé, règles ce jour-là.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { longDate } from '../lib/format';
import { colors, fonts, MOODS, SYMPTOMS } from '../theme';
import Icon from './Icon';
import { Button, Loader, Sheet, T } from './ui';

const FLOW = { traces: 'Traces', leger: 'Léger', moyen: 'Moyen', abondant: 'Abondant' };

function Line({ icon, color = colors.bordeaux, title, value, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={s.line}>
      <View style={s.lineIcon}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={s.lineTitle} numberOfLines={2}>{title}</Text>
      {value ? <Text style={s.lineValue} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Icon name="chevronRight" size={15} color={colors.muted} /> : null}
    </Comp>
  );
}

export default function DaySheet({ day, onClose, onStartPeriod }) {
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
  const mood = d?.log?.mood ? MOODS.find((m) => m.key === d.log.mood)?.label : null;
  const symptoms = (d?.log?.symptoms || []).map((k) => SYMPTOMS[k] || k);
  const empty = d && !d.fast && !d.notes.length && !d.period && !mood && !symptoms.length && !d.forecast;

  return (
    <Sheet
      visible={Boolean(day)}
      onClose={onClose}
      title={day ? longDate(day) : ''}
      footer={
        d ? (
          future ? (
            <Button title="Ajouter une note ce jour-là" icon="plus" onPress={() => go(`/notes/nouvelle?day=${d.day}`)} />
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Ajouter une note" small variant="outline" onPress={() => go(`/notes/nouvelle?day=${d.day}`)} style={{ flex: 1 }} />
                <Button title="Suivi santé" small variant="outline" onPress={() => go(`/sante?day=${d.day}`)} style={{ flex: 1 }} />
              </View>
              {d.period ? null : (
                <Button
                  title="Mes règles ont commencé ce jour-là"
                  onPress={() => {
                    onClose();
                    onStartPeriod?.(d.day);
                  }}
                />
              )}
            </View>
          )
        ) : null
      }
    >
      {!d && !error ? <Loader /> : null}
      {error ? <T variant="muted">{error.message}</T> : null}
      {d ? (
        <>
          <Text style={s.meta}>
            {[d.cycleDay ? `Jour ${d.cycleDay} du cycle` : null, d.phase?.label, d.hijri].filter(Boolean).join(' · ')}
          </Text>
          <View>
            {d.period ? <Line icon="drop" title={d.period.kind === 'nifas' ? `Nifas · jour ${d.period.day}` : `Règles · jour ${d.period.day}`} value={d.period.flow ? `Flux ${FLOW[d.period.flow].toLowerCase()}` : null} onPress={() => go('/mes-regles')} /> : null}
            {d.fast ? <Line icon="moon" color={colors.orText} title={d.fast.label} value={d.fast.status === 'fait' ? 'Jeûné' : 'Prévu'} onPress={() => go('/jeunes')} /> : null}
            {d.notes.map((n) => (
              <Line key={n.id} icon="note" color={colors.orText} title={n.text} value={[n.time, n.repeat !== 'once' ? n.repeatLabel : null].filter(Boolean).join(' · ') || null} onPress={() => go(`/notes/nouvelle?id=${n.id}`)} />
            ))}
            {mood ? <Line icon="sparkle" title="Humeur" value={mood} /> : null}
            {symptoms.length ? <Line icon="heart" title={symptoms.join(', ')} /> : null}
            {d.forecast?.period ? <Line icon="calendar" title="Règles prévues (estimation)" /> : null}
            {d.forecast?.ovulation ? <Line icon="calendar" color={colors.orText} title="Ovulation estimée" /> : d.forecast?.fertile ? <Line icon="calendar" title="Fenêtre fertile (estimation)" /> : null}
          </View>
          {empty ? <T variant="muted">Rien de noté ce jour-là.</T> : null}
          {future ? <T variant="small">Les prévisions sont indicatives.</T> : null}
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  meta: { fontFamily: fonts.semi, fontSize: 13.5, lineHeight: 19, color: colors.orText },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  lineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  lineTitle: { flex: 1, fontFamily: fonts.semi, fontSize: 14.5, color: colors.prune },
  lineValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, maxWidth: '45%' },
});
