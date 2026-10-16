// Exemples de test du cahier des charges, partie 6 (critère de recette 12.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from '../src/utils/dates.js';
import { buildCycles, computeAverages, cycleSummary, phaseBounds, projectCycles, regularity, reliability, weightedAverage, detectOvulation } from '../src/services/cycleCalc.js';
import { pregnancyStatus } from '../src/services/pregnancyCalc.js';
import { fastCounter, missedRamadanDays, planMakeupDays, rhythmAdvice } from '../src/services/fastCalc.js';
import { forbiddenFastReason, ramadanRange, toHijri, whiteDays } from '../src/services/hijri.js';
import { localQibla, localTimings, prayersAfterPurification } from '../src/services/prayerService.js';
import { distanceKm } from '../src/services/geo.js';
import { dhikrReminders } from '../src/services/dhikr.js';
import { jumuaOf } from '../src/services/prayerSource.js';

/** Construit des règles à partir d'une suite de durées de cycle (du plus ancien au plus récent). */
function periodsFromLengths(lastStart, lengths, periodLength = 5) {
  const starts = [lastStart];
  for (const l of [...lengths].reverse()) starts.unshift(addDays(starts[0], -l));
  return starts.map((start, i) => ({ id: String(i), start, end: addDays(start, periodLength - 1), kind: 'hayd' }));
}

test('6.2 — moyenne pondérée : 26, 27, 25, 26, 28, 26 → 555 ÷ 21 = 26,4 → 26 jours', () => {
  assert.equal(weightedAverage([26, 27, 25, 26, 28, 26]) * 21, 555);
  const periods = periodsFromLengths('2026-10-02', [26, 27, 25, 26, 28, 26]);
  const avg = computeAverages(buildCycles(periods), periods);
  assert.equal(avg.cycleLength, 26);
  assert.equal(avg.cyclesUsed, 6);
});

test('6.2 — sans historique et « je ne sais pas » : 28 jours de cycle, 5 jours de règles', () => {
  const avg = computeAverages([], []);
  assert.deepEqual([avg.cycleLength, avg.periodLength, avg.isDefault], [28, 5, true]);
});

test('6.2 — les cycles aberrants (< 15 j ou > 60 j) sont écartés après confirmation', () => {
  const periods = periodsFromLengths('2026-10-02', [28, 70, 28]);
  const cycles = buildCycles(periods);
  assert.equal(cycles.filter((c) => c.aberrant).length, 1);
  periods[1].cycleExcluded = true;
  const avg = computeAverages(buildCycles(periods), periods);
  assert.equal(avg.cycleLength, 28);
});

test('6.3 — dernier J1 le 2 octobre, durée moyenne 26 jours → prochaines règles le 28 octobre', () => {
  const [, next, ...following] = projectCycles({ lastStart: '2026-10-02', cycleLength: 26, periodLength: 5, count: 4 });
  assert.equal(next.start, '2026-10-28');
  assert.equal(following.length, 3, 'les 3 cycles suivants sont prédits');
});

test('6.3 — indice de fiabilité', () => {
  assert.equal(reliability(6, false), 'eleve');
  assert.equal(reliability(4, false), 'moyen');
  assert.equal(reliability(2, false), 'faible');
  assert.equal(reliability(6, true), 'faible');
});

test('6.4 — cycle de 32 jours, règles le 10 octobre → prochaines le 11/11, ovulation le 28/10, fenêtre du 23 au 28/10', () => {
  const summary = cycleSummary({
    periods: [{ id: 'a', start: '2026-10-10', end: '2026-10-14', kind: 'hayd' }],
    declared: { cycleLength: 32 },
    today: '2026-10-15',
  });
  assert.equal(summary.nextPeriod.date, '2026-11-11');
  assert.equal(summary.ovulation.day, '2026-10-28');
  assert.equal(summary.ovulation.fertileStart, '2026-10-23');
  assert.equal(summary.ovulation.fertileEnd, '2026-10-28');
});

test('6.4 — une hausse de température de 3 jours confirme l’ovulation la veille de la hausse', () => {
  const temps = [36.4, 36.45, 36.4, 36.42, 36.38, 36.44, 36.75, 36.8, 36.78];
  const logs = temps.map((t, i) => ({ day: addDays('2026-10-05', i), temperature: t }));
  assert.deepEqual(detectOvulation(logs, '2026-10-01'), { day: '2026-10-10', method: 'temperature', confirmed: true });
});

test('6.5 — cycle de 28 jours, règles de 5 jours : bornes des phases', () => {
  const [current] = projectCycles({ lastStart: '2026-10-01', cycleLength: 28, periodLength: 5, count: 1 });
  const b = phaseBounds(current);
  assert.deepEqual(b.menstruelle, [1, 5]);
  assert.deepEqual(b.luteale[1], 28);
  // ⚠ Le cahier indique folliculaire J6–J11, ovulatoire J12–J15, lutéale J16–J28 (ovulation à J14),
  // ce qui contredit la règle 6.4 « ovulation = prochaines règles − 14 jours » (→ J15) et son exemple daté.
  // Nous appliquons la règle 6.4. Pour obtenir les bornes de 6.5, régler la phase lutéale à 15 jours
  // dans le back-office (l'exemple daté de 6.4 donnerait alors le 27 octobre).
  assert.deepEqual(b.folliculaire, [6, 12]);
  assert.deepEqual(b.ovulatoire, [13, 16]);
  assert.deepEqual(b.luteale, [17, 28]);

  const [alt] = projectCycles({ lastStart: '2026-10-01', cycleLength: 28, periodLength: 5, lutealLength: 15, count: 1 });
  const b15 = phaseBounds(alt);
  assert.deepEqual([b15.folliculaire, b15.ovulatoire, b15.luteale], [[6, 11], [12, 15], [16, 28]]);
});

test('6.6 — cycles 24, 33, 28, 35, 26, 31 ; J1 le 1er octobre → irrégulier, entre le 25/10 et le 5/11, vers le 31/10', () => {
  const lengths = [24, 33, 28, 35, 26, 31];
  const periods = periodsFromLengths('2026-10-01', lengths);
  const reg = regularity(buildCycles(periods));
  assert.equal(reg.spread, 11);
  assert.equal(reg.irregular, true);
  assert.equal(weightedAverage(lengths) * 21, 630);

  const summary = cycleSummary({ periods, today: '2026-10-08' });
  assert.equal(summary.cycleLength, 30);
  assert.equal(summary.nextPeriod.rangeStart, '2026-10-25');
  assert.equal(summary.nextPeriod.rangeEnd, '2026-11-05');
  assert.equal(summary.nextPeriod.date, '2026-10-31');
  assert.equal(summary.reliability, 'faible');
});

test('6.6 — retard : à J+7, l’appli propose le mode grossesse', () => {
  const periods = periodsFromLengths('2026-09-01', [28, 28, 28]);
  const s = cycleSummary({ periods, today: '2026-10-06' });
  assert.equal(s.lateDays, 7);
  assert.equal(s.askPregnancy, true);
});

test('6.7 — DDR 1er mars 2026, cycle 28 j : DG 15/03, 32 SA + 3 j le 14/10, 3e trimestre, terme 13/12/2026', () => {
  const s = pregnancyStatus({ lmp: '2026-03-01', cycleLength: 28 }, '2026-10-14');
  assert.equal(s.conception, '2026-03-15');
  assert.deepEqual([s.sa.weeks, s.sa.days], [32, 3]);
  assert.equal(s.trimester, 3);
  assert.equal(s.dueDate, '2026-12-13');
  assert.equal(s.month, 7);
  assert.deepEqual([s.sg.weeks, s.sg.days], [30, 3], 'SG = SA − 2 semaines');
});

test('6.7 — même DDR, cycle de 32 jours : DG le 19 mars, terme le 17 décembre 2026', () => {
  const s = pregnancyStatus({ lmp: '2026-03-01', cycleLength: 32 }, '2026-10-14');
  assert.equal(s.conception, '2026-03-19');
  assert.equal(s.dueDate, '2026-12-17');
});

test('6.7 — la date de l’échographie est prioritaire sur la DDR', () => {
  const s = pregnancyStatus({ lmp: '2026-03-01', dueDate: '2026-12-20' }, '2026-10-14');
  assert.equal(s.source, 'echographie');
  assert.equal(s.dueDate, '2026-12-20');
});

test('6.9 — prières à accomplir après la purification (RG-19)', () => {
  const t = { fajr: '06:28', sunrise: '08:11', dhuhr: '13:36', asr: '16:30', maghrib: '19:01', isha: '20:40' };
  assert.deepEqual(prayersAfterPurification('17:10', t).prayers, ['dhuhr', 'asr']);
  assert.deepEqual(prayersAfterPurification('04:00', t).prayers, ['maghrib', 'isha']);
  assert.deepEqual(prayersAfterPurification('22:30', t).prayers, ['maghrib', 'isha']);
  assert.deepEqual(prayersAfterPurification('07:00', t).prayers, ['fajr']);
  assert.deepEqual(prayersAfterPurification('18:55', t).prayers, []);
});

test('6.8 — qibla depuis Paris ≈ 119°', () => {
  assert.equal(Math.round(localQibla(48.8566, 2.3522)), 119);
});

test('6.8 — qibla (grand cercle vers 21,4225° N, 39,8262° E) depuis plusieurs villes', () => {
  // Valeurs de référence : relèvement orthodromique initial, en degrés depuis le nord vrai.
  const cases = [
    ['Londres', 51.5074, -0.1278, 118.99],
    ['Montréal', 45.5017, -73.5673, 58.69],
    ['Casablanca', 33.5731, -7.5898, 93.68],
    ['Djakarta', -6.2088, 106.8456, 295.15],
    ['Oslo', 59.9139, 10.7522, 139.03],
  ];
  for (const [name, lat, lng, expected] of cases) assert.ok(Math.abs(localQibla(lat, lng) - expected) < 0.1, `${name} : ${localQibla(lat, lng)}° au lieu de ${expected}°`);
  assert.equal(Math.round(distanceKm({ lat: 48.8566, lng: 2.3522 }, { lat: 21.4225, lng: 39.8262 })), 4496);
});

test('6.8 — horaires : Asr à « ombre = hauteur », hautes latitudes et ajustements manuels', () => {
  const paris = { lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris', method: 'MWL', highLatitude: 'SEVENTH' };
  const t = localTimings(paris, '2026-10-15');
  const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) => t[p]);
  assert.deepEqual([...order].sort(), order, 'ordre chronologique');
  // Références calculées indépendamment (position du soleil) : midi solaire 13 h 36 min 21 s,
  // ombre = hauteur + ombre de midi atteinte à 16 h 28.
  assert.ok(t.dhuhr >= '13:36' && t.dhuhr <= '13:38', `Dhuhr Paris ${t.dhuhr}`);
  assert.ok(t.asr >= '16:27' && t.asr <= '16:29', `Asr Paris ${t.asr}`);
  // Oslo en juin : le soleil ne descend pas à −18°, la règle du septième de la nuit donne quand même un Fajr et un Isha.
  const oslo = localTimings({ ...paris, lat: 59.9139, lng: 10.7522, tz: 'Europe/Oslo' }, '2026-06-21');
  assert.match(oslo.fajr, /^\d\d:\d\d$/);
  assert.match(oslo.isha, /^\d\d:\d\d$/);
  const tuned = localTimings({ ...paris, adjustments: { fajr: 5, isha: -3 } }, '2026-10-15');
  const minutes = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  assert.equal(minutes(tuned.fajr) - minutes(t.fajr), 5);
  assert.equal(minutes(tuned.isha) - minutes(t.isha), -3);
});

test('6.10 — calendrier hégirien Umm al-Qura, jours blancs et jours interdits', () => {
  assert.deepEqual([toHijri('2026-10-15').day, toHijri('2026-10-15').month, toHijri('2026-10-15').year], [4, 5, 1448]);
  assert.equal(toHijri('2026-10-15', 1).day, 5, 'ajustement +1 jour');
  const r = ramadanRange(1448);
  assert.equal(r.start, '2027-02-08');
  const w = whiteDays('2026-10-15');
  assert.deepEqual(w.days.map((d) => d.day), ['2026-10-24', '2026-10-25', '2026-10-26']);
  assert.equal(w.daysUntil, 9);
  assert.equal(forbiddenFastReason('2026-03-20'), 'Aïd al-Fitr');
});

test('6.11 — Ramadan de 30 jours, règles du jour 8 (10 h) au jour 13 (4 h, avant l’aube) → 5 jours manqués', () => {
  const start = '2027-02-08';
  const ramadanDays = Array.from({ length: 30 }, (_, i) => ({ day: addDays(start, i), hijriDay: i + 1, hijriYear: 1448, fajr: '06:30', maghrib: '18:20' }));
  const periods = [{ start: addDays(start, 7), startTime: '10:00', end: addDays(start, 12), endTime: '04:00', kind: 'hayd' }];
  const missed = missedRamadanDays({ ramadanDays, periods, now: { day: '2027-04-01', time: '12:00' } });
  assert.deepEqual(missed.map((m) => m.hijriDay), [8, 9, 10, 11, 12]);
});

test('6.11 — RG-21 : des règles commencées après le coucher du soleil ne comptent pas pour ce jour', () => {
  const ramadanDays = [{ day: '2027-02-10', hijriDay: 3, hijriYear: 1448, fajr: '06:30', maghrib: '18:20' }];
  const periods = [{ start: '2027-02-10', startTime: '18:45', end: '2027-02-15', endTime: '09:00', kind: 'hayd' }];
  assert.equal(missedRamadanDays({ ramadanDays, periods, now: { day: '2027-03-01', time: '12:00' } }).length, 0);
});

test('6.11 — RG-23 : compteur = automatiques + manuels − rattrapés, détail par année', () => {
  const c = fastCounter({
    autoMissed: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: `2026-03-0${d}`, hijriYear: 1447 })),
    manual: [{ hijriYear: 1446, count: 3 }],
    madeUp: [{}, {}, {}, {}],
  });
  assert.deepEqual([c.missed, c.madeUp, c.remaining], [10, 4, 6]);
  assert.deepEqual(c.byYear.map((y) => [y.hijriYear, y.remaining]), [[1446, 0], [1447, 6]]);
});

test('RG-24 — le plan évite les règles prévues, le Ramadan et les jours interdits', () => {
  const blocked = new Set(['2026-10-26']); // lundi pendant des règles prévues
  const plan = planMakeupDays({
    remaining: 4,
    perWeek: 2,
    weekdays: [1, 4],
    from: '2026-10-15',
    blockedReason: (d) => (blocked.has(d) ? 'regles' : null),
  });
  const days = plan.map((p) => p.day);
  assert.equal(days[0], '2026-10-15'); // jeudi
  assert.equal(days.includes('2026-10-26'), false);
  assert.equal(days.length, 4);
});

test('6.7 — cycle de 32 jours : les SG partent de la DG (19 mars), la progression du terme décalé', () => {
  const s = pregnancyStatus({ lmp: '2026-03-01', cycleLength: 32 }, '2026-10-14');
  assert.deepEqual([s.sa.weeks, s.sa.days], [32, 3], 'les SA restent comptées depuis la DDR');
  assert.deepEqual([s.sg.weeks, s.sg.days], [29, 6], '14/10 − 19/03 = 209 jours');
  assert.equal(pregnancyStatus({ lmp: '2026-03-01', cycleLength: 32 }, '2026-12-17').progress, 1);
});

test('6.6 — aménorrhée : alerte au-delà de 3 mois, jamais pendant une grossesse', () => {
  const periods = periodsFromLengths('2026-06-01', [28, 28, 28]);
  assert.ok(cycleSummary({ periods, today: '2026-10-15' }).alerts.includes('amenorrhee'));
  assert.ok(!cycleSummary({ periods, today: '2026-10-15', pregnant: true }).alerts.includes('amenorrhee'));
});

test('6.5 — cycle très court (18 jours) : pas de phase folliculaire négative', () => {
  const [c] = projectCycles({ lastStart: '2026-10-01', cycleLength: 18, periodLength: 6, count: 1 });
  const b = phaseBounds(c);
  assert.equal(b.folliculaire, null);
  assert.deepEqual(b.menstruelle, [1, 6]);
  assert.deepEqual(b.luteale[1], 18);
  for (const k of ['ovulatoire', 'luteale']) if (b[k]) assert.ok(b[k][0] <= b[k][1], k);
});

test('Dhikr — matin après Fajr, soir après Asr, vendredi : Al-Kahf le matin et dernière heure avant Maghrib', () => {
  const settings = { adhkarMorningText: 'matin', adhkarEveningText: 'soir', jumuaText: 'kahf', jumuaLastHourText: 'heure' };
  const friday = { day: '2026-10-16', fajr: '06:27', sunrise: '08:12', dhuhr: '13:36', asr: '16:29', maghrib: '18:59', isha: '20:38' };
  const r = dhikrReminders({ timings: friday, tz: 'Europe/Paris', settings });
  assert.deepEqual(r.map((x) => [x.kind, x.time]), [['adhkar_matin', '06:47'], ['jumua', '09:30'], ['adhkar_soir', '16:49'], ['jumua_derniere_heure', '17:59']]);
  assert.equal(r[0].instant, '2026-10-16T04:47:00.000Z');
  const thursday = dhikrReminders({ timings: { ...friday, day: '2026-10-15' }, tz: 'Europe/Paris', settings, prefs: { adhkarEvening: false } });
  assert.deepEqual(thursday.map((x) => x.kind), ['adhkar_matin']);
  // Été nordique : Fajr 03:09, lever 03:54 → le rappel du matin reste avant le lever.
  const oslo = dhikrReminders({ timings: { ...friday, day: '2026-06-18', fajr: '03:09', sunrise: '03:20', asr: '18:00', maghrib: '22:43' }, tz: 'Europe/Oslo', settings });
  assert.equal(oslo[0].time, '03:10');
});

test('RG-24 bis / ter — 15 oct. 2026, 6 jours à rattraper, Ramadan le 8 févr. 2027 : 116 jours, « 1 jour toutes les 2 semaines »', () => {
  const r = ramadanRange(1448);
  assert.equal(r.start, '2027-02-08');
  const daysLeft = Math.round((Date.parse(r.start) - Date.parse('2026-10-15')) / 86_400_000);
  assert.equal(daysLeft, 116);
  const a = rhythmAdvice(daysLeft, 6);
  assert.equal(a.gap, 19);
  assert.equal(a.phrase, '1 jour toutes les 2 semaines');
  assert.equal(rhythmAdvice(116, 20).phrase, '2 jours par semaine'); // écart 5 → 7 ÷ 5 = 1,4 → 2
  assert.equal(rhythmAdvice(116, 12).phrase, '1 jour par semaine'); // écart 9
  assert.equal(rhythmAdvice(116, 3).phrase, '1 jour par mois'); // écart 38
  assert.equal(rhythmAdvice(10, 12).alert, true);
});

test('Jumu’a de la mosquée : vendredi qui vient, horaires publiés prioritaires, deux Jumu’a (heure de Paris)', () => {
  const mosque = { timezone: 'Europe/Paris', jumua: '13:15', jumua2: '14:15', timetable: [{ day: '2026-10-23', jumua: '13:20' }] };
  const today = jumuaOf(mosque, '2026-10-16'); // vendredi
  assert.equal(today.today, true);
  assert.deepEqual(today.times, ['13:15', '14:15']);
  assert.equal(today.instants[0], '2026-10-16T11:15:00.000Z'); // UTC+2 en octobre
  const next = jumuaOf(mosque, '2026-10-17'); // samedi → vendredi suivant
  assert.equal(next.day, '2026-10-23');
  assert.equal(next.today, false);
  assert.deepEqual(next.times, ['13:20', '14:15']);
  assert.equal(next.published, true);
  assert.equal(jumuaOf({ jumua: '' }, '2026-10-17'), null);
  assert.equal(jumuaOf({ timezone: 'Europe/Paris', jumua: '13:30' }, '2026-11-06').instants[0], '2026-11-06T12:30:00.000Z'); // UTC+1 en novembre
});
