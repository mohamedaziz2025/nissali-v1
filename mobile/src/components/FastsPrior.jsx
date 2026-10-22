// 08 / 09 / 10 — « Ajouter des jours déjà rattrapés » : par nombre (dates facultatives) ou par dates, rattaché
// à l'année de Ramadan choisie. Nouveau solde affiché avant confirmation ; nombre nul, négatif ou supérieur
// au solde refusé ; date en double refusée ; un seul envoi même après deux clics.
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { longDate, shortDate } from '../lib/format';
import { colors, fonts } from '../theme';
import { DateField } from './forms';
import Icon from './Icon';
import { Button, Chip, Sheet, T, useToast } from './ui';

import { tr } from '../lib/i18n';
const plural = (n, word = 'jour') => `${n} ${word}${n > 1 ? 's' : ''}`;
const newRequestId = () => tr("prior-{0}-{1}", [Date.now(), Math.random().toString(36).slice(2, 10)]);

function confirmAsync(title, message) {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n${message}`));
  return new Promise((resolve) => Alert.alert(title, message, [{ text: tr("Annuler"), style: 'cancel', onPress: () => resolve(false) }, { text: tr("Confirmer"), onPress: () => resolve(true) }]));
}

/**
 * year : { hijriYear, missed, madeUp, remaining } du Ramadan choisi.
 * entry : ajout existant à corriger ({ id, mode, count, dates, hijriYear }).
 */
export function PriorSheet({ visible, onClose, year, years = [], onYear, entry, onSaved }) {
  const toast = useToast();
  const [mode, setMode] = useState('nombre');
  const [count, setCount] = useState(1);
  const [dates, setDates] = useState([]);
  const [showDates, setShowDates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(newRequestId());
  const sending = useRef(false);

  useEffect(() => {
    if (!visible) return;
    requestId.current = newRequestId();
    setMode(entry?.mode || 'nombre');
    setCount(entry?.count || 1);
    setDates(entry?.dates || []);
    setShowDates(Boolean(entry?.dates?.length));
    setError(null);
  }, [visible, entry]);

  const available = (year?.remaining || 0) + (entry && entry.hijriYear === year?.hijriYear ? entry.count : 0);
  const already = (year?.madeUp || 0) - (entry && entry.hijriYear === year?.hijriYear ? entry.count : 0);
  const n = mode === 'dates' ? dates.length : count;
  const newBalance = available - n;
  const over = n > available;

  const addDate = (d) => {
    if (!d) return;
    if (dates.includes(d)) return setError(tr("Cette date est déjà choisie"));
    if (mode === 'nombre' && dates.length >= count) return setError(tr("Tu as déjà choisi {0}", [plural(count, 'date')]));
    setError(null);
    setDates((list) => [...list, d].sort());
  };
  const switchMode = (m) => {
    setMode(m);
    setError(null);
    if (m === 'dates') setShowDates(true);
  };

  const submit = async () => {
    if (sending.current) return; // double clic
    if (n < 1) return setError(mode === 'dates' ? tr("Choisis au moins une date") : tr("Le nombre de jours doit être au moins 1"));
    if (over) return setError(tr("Tu ne peux pas ajouter plus de {0} : c’est ton solde", [plural(available)]));
    if (mode === 'nombre' && !dates.length) {
      const ok = await confirmAsync('Confirmer le nombre', `Ajouter ${plural(count)} déjà rattrapé${count > 1 ? 's' : ''} sans date au Ramadan ${year.hijriYear} ?`);
      if (!ok) return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const body = { hijriYear: year.hijriYear, mode, ...(mode === 'nombre' ? { count } : {}), dates };
      if (entry) await api.patch(`/fasts/prior/${entry.id}`, body);
      else await api.post('/fasts/prior', { ...body, requestId: requestId.current });
      toast(entry ? tr("Ajout corrigé") : tr("{0} ajouté{1} à ton historique", [plural(n), n > 1 ? 's' : '']));
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (!year) return null;
  const allDone = available <= 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr("Déjà rattrapés")}
      footer={
        <View style={{ gap: 10 }}>
          {!allDone ? <Button title={`Confirmer ${n > 1 ? `ces ${n} jours` : n === 1 ? 'ce jour' : ''}`.trim()} onPress={submit} loading={busy} disabled={busy || n < 1 || over} /> : null}
          <Button title={tr("Annuler")} variant="outline" onPress={onClose} />
          <T variant="small" style={{ textAlign: 'center' }}>{tr("Ces jours seront ajoutés à ton historique.")}</T>
        </View>
      }
    >
      <T variant="muted" style={{ marginTop: -10 }}>{tr("Ajoute les jours jeûnés avant d’utiliser Nissali.")}</T>
      {years.length > 1 && !entry ? (
        <View style={s.wrap}>
          {years.map((y) => (
            <Chip key={y} label={tr("Ramadan {0}", [y])} selected={y === year.hijriYear} onPress={() => onYear?.(y)} />
          ))}
        </View>
      ) : (
        <T variant="bold">{tr("Ramadan")} {year.hijriYear}</T>
      )}
      {allDone ? (
        <View style={s.done}>
          <Icon name="check" size={20} color={colors.success} strokeWidth={2.6} />
          <Text style={s.doneText}>{tr("Tous tes jours sont rattrapés")}</Text>
        </View>
      ) : (
        <>
          <View style={s.modes} accessibilityRole="radiogroup">
            {[
              ['nombre', tr("Par nombre")],
              ['dates', tr("Par date")],
            ].map(([k, l]) => (
              <Pressable key={k} onPress={() => switchMode(k)} accessibilityRole="radio" accessibilityState={{ checked: mode === k }} style={[s.mode, mode === k && s.modeOn]}>
                {mode === k ? <Icon name="check" size={15} color={colors.white} strokeWidth={2.6} /> : null}
                <Text style={[s.modeText, mode === k && { color: colors.white }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'nombre' ? (
            <>
              <Text style={s.question}>{tr("Jours supplémentaires déjà rattrapés")}</Text>
              <View style={s.stepper}>
                <Pressable onPress={() => { setCount((c) => Math.max(1, c - 1)); setError(null); }} disabled={count <= 1} accessibilityRole="button" accessibilityLabel={tr("Un jour de moins")} style={[s.stepBtn, count <= 1 && { opacity: 0.4 }]}>
                  <Text style={s.stepText}>−</Text>
                </Pressable>
                <Text style={s.count}>{plural(count)}</Text>
                <Pressable onPress={() => { setCount((c) => Math.min(available, c + 1)); setError(null); }} disabled={count >= available} accessibilityRole="button" accessibilityLabel={tr("Un jour de plus")} style={[s.stepBtn, count >= available && { opacity: 0.4 }]}>
                  <Text style={s.stepText}>+</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setShowDates((v) => !v)} accessibilityRole="button" style={s.optional}>
                <Icon name="calendar" size={17} color={colors.muted} />
                <Text style={s.optionalText}>{tr("Dates facultatives")}{dates.length ? ` · ${dates.length}/${count}` : ''}</Text>
                <Text style={s.link}>{showDates ? tr("Masquer") : tr("Ajouter des dates")}</Text>
                <Icon name="chevronRight" size={15} color={colors.bordeaux} />
              </Pressable>
            </>
          ) : (
            <Text style={s.question}>{tr("Choisis les dates déjà jeûnées")}</Text>
          )}

          {mode === 'dates' || showDates ? (
            <>
              {dates.length ? (
                <View style={s.wrap}>
                  {dates.map((d) => (
                    <Chip key={d} label={`${shortDate(d)} ✕`} selected onPress={() => setDates((list) => list.filter((x) => x !== d))} />
                  ))}
                </View>
              ) : null}
              {mode === 'dates' || dates.length < count ? <DateField key={dates.length} label={null} value={null} placeholder={tr("Ajouter une date")} onChange={addDate} /> : null}
            </>
          ) : null}

          <View style={s.balance}>
            <View style={s.balanceCol}>
              <T variant="small">{tr("Solde actuel")}</T>
              <Text style={s.balanceValue}>{plural(available)}</Text>
            </View>
            <View style={s.balanceSep} />
            <View style={s.balanceCol}>
              <T variant="small" color={colors.bordeaux}>{tr("Nouveau solde")}</T>
              <Text style={[s.balanceValue, { color: colors.bordeaux, fontSize: 24 }]}>{over ? '—' : plural(Math.max(0, newBalance))}</Text>
            </View>
          </View>
          <T variant="small" style={{ textAlign: 'center', marginTop: -6 }}>
            {already} {tr("déjà enregistré")}{already > 1 ? 's' : ''} + {n} {tr("ajouté")}{n > 1 ? 's' : ''} = {already + n} {tr("rattrapé")}{already + n > 1 ? 's' : ''} {tr("sur")} {year.missed}.
          </T>
        </>
      )}
      {error ? <T variant="small" color={colors.danger}>{error}</T> : null}
      {entry?.createdAt ? <T variant="small">{tr("Ajout du")} {longDate(entry.createdAt.slice(0, 10))}</T> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modes: { flexDirection: 'row', gap: 10 },
  mode: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, borderWidth: 1.5, borderColor: '#EAD1D6', backgroundColor: colors.white },
  modeOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  modeText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  question: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.prune },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.bold, fontSize: 26, color: colors.bordeaux, marginTop: -2 },
  count: { fontFamily: fonts.title, fontSize: 26, color: colors.prune, minWidth: 110, textAlign: 'center' },
  optional: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ivoire, borderRadius: 14, paddingHorizontal: 12, minHeight: 46, borderWidth: 1, borderColor: colors.line },
  optionalText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  balance: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, borderRadius: 18, paddingVertical: 14 },
  balanceCol: { flex: 1, alignItems: 'center', gap: 2 },
  balanceSep: { width: 1, height: 40, backgroundColor: '#EAD1D6' },
  balanceValue: { fontFamily: fonts.title, fontSize: 21, color: colors.prune },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F1EA', borderRadius: 16, padding: 14 },
  doneText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.success },
});
