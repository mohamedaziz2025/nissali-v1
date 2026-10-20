// 5.2 — Tableau de bord « Aujourd'hui » : une seule requête pour tout l'écran d'accueil.
import { Router } from 'express';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { DailyLog, MadeUpFast, Note, Notification, PrayerLog, Reminder, VoluntaryFast } from '../models/index.js';
import { contextCards } from '../services/contextCard.js';
import { nextVoluntary } from '../services/voluntary.js';
import { HEALTH_ALERTS, PHASES } from '../content/phases.js';
import { loadCycleContext, loadFastContext, prayerPause } from '../services/context.js';
import { buildHealthTips, getWeather } from '../services/health.js';
import { tipOfTheDay } from '../services/healthTips.js';
import { ramadanInfo, toHijri, whiteDays } from '../services/hijri.js';
import { adhanFor } from '../services/adhan.js';
import { dhikrReminders } from '../services/dhikr.js';
import { nextJumua, userTimings } from '../services/prayerSource.js';
import { upcomingNotes } from '../services/notes.js';
import { currentPrayer, getQibla, nextPrayer, prayerOptionsFor, prayersAfterPurification, withInstants, PRAYERS } from '../services/prayerService.js';
import { addDays, diffDays } from '../utils/dates.js';

const router = Router();

export async function reminderOfTheDay(today) {
  const scheduled = await Reminder.findOne({ scheduledFor: today, validated: true }).lean();
  if (scheduled) return scheduled;
  const pool = await Reminder.find({ validated: true, $or: [{ scheduledFor: null }, { scheduledFor: { $exists: false } }] })
    .sort({ createdAt: 1 })
    .lean();
  if (!pool.length) return null;
  return pool[Math.abs(diffDays(today, '2026-01-01')) % pool.length];
}

/** Carte principale selon la situation (RG-08). */
export function cycleCard(ctx, user) {
  const s = ctx.summary;
  const phase = s.phase ? { key: s.phase, ...PHASES[s.phase], tips: undefined, tip: PHASES[s.phase].tips[0] } : null;
  // Frise des 4 phases (carte Règles, maquette V3) : jours du cycle de chaque phase + fenêtre fertile.
  const start = s.projections?.[0]?.start;
  const j = (d) => (start && d ? diffDays(d, start) + 1 : null);
  const frieze = s.phaseBounds
    ? { bounds: s.phaseBounds, fertile: [j(s.ovulation?.fertileStart), j(s.ovulation?.fertileEnd)], ovulationDay: j(s.ovulation?.day), cycleLength: s.cycleLength, cycleDay: s.cycleDay }
    : null;
  const common = { phase, frieze, reliability: s.reliability, alerts: s.alerts.map((a) => ({ key: a, text: HEALTH_ALERTS[a] })) };

  if (user.mode === 'grossesse' && ctx.pregnancy) return { kind: 'grossesse', ...ctx.pregnancy, ...common, phase: null };
  if (s.nifas) return { kind: 'nifas', day: s.nifas.day, max: s.nifas.max, exceeded: s.nifas.exceeded, start: s.nifas.start, ...common, phase: null };
  if (!s.hasData) return { kind: 'vide', ...common };
  if (s.inPeriod) {
    return {
      kind: 'regles',
      periodDay: s.periodDay,
      periodLength: s.periodLength,
      start: s.currentPeriod.start,
      periodId: s.currentPeriod.id,
      askPeriodEnded: s.askPeriodEnded,
      istihada: s.istihada,
      istihadaInfo: s.istihada ? ctx.settings.istihadaInfo : null,
      maxPeriodDays: s.maxPeriodDays,
      // Flux noté aujourd'hui (null si rien n'a été renseigné : aucun choix pré-coché).
      // Flux noté aujourd'hui, traces comprises (4 boutons, V4) ; null si rien n'a été renseigné.
      flowToday: s.currentPeriod.flows?.find((f) => f.day === ctx.today)?.level || null,
      // « Fin prévue vers le … » = J1 + durée moyenne des règles − 1.
      expectedEnd: addDays(s.currentPeriod.start, Math.max(1, s.periodLength) - 1),
      ...common,
    };
  }
  if (s.noPrediction) return { kind: 'postpartum', cycleDay: s.cycleDay, ...common };
  return {
    kind: 'prochaines',
    daysUntil: s.daysUntilNext,
    nextDate: s.nextPeriod.date,
    rangeStart: s.nextPeriod.rangeStart,
    rangeEnd: s.nextPeriod.rangeEnd,
    cycleDay: s.cycleDay,
    cycleLength: s.cycleLength,
    progress: Math.min(1, s.cycleDay / s.cycleLength),
    lateDays: s.lateDays,
    askPregnancy: s.askPregnancy && user.situation === 'mariee',
    lateNotice: s.lateDays >= 7 && user.situation !== 'mariee',
    isDefault: s.isDefault,
    ovulation: s.ovulation,
    ...common,
  };
}

router.get('/', requireAuth, requireHealthConsent, async (req, res) => {
  const user = req.user;
  const ctx = await loadCycleContext(user);
  const { today, time, tz, settings } = ctx;
  const adj = settings.hijriAdjustment || 0;
  const options = prayerOptionsFor(user, settings);

  const weatherPromise = getWeather(options.lat, options.lng).catch(() => null);
  const [{ timings, meta: source }, qibla, prayerLog, fastCtx, healthLog, reminder, unread, lastWeight] = await Promise.all([
    userTimings(user, settings, today),
    getQibla(options.lat, options.lng),
    PrayerLog.findOne({ user: user._id, day: today }).lean(),
    loadFastContext(user, ctx),
    DailyLog.findOne({ user: user._id, day: today }).lean(),
    reminderOfTheDay(today),
    Notification.countDocuments({ user: user._id, read: false }),
    DailyLog.findOne({ user: user._id, weight: { $exists: true, $ne: null } }).sort({ day: -1 }).select('day weight').lean(),
  ]);
  const weather = await weatherPromise;

  const pause = prayerPause(ctx);
  const ramadan = ramadanInfo(today, adj);

  // RG-16 / RG-19 — prières à accomplir après le ghusl, si les règles viennent de se terminer.
  // 4.2 · 1.4 : visible jusqu'à ce que tout soit coché, ou jusqu'au Fajr qui suit la fin.
  let purification = null;
  const lastEnded = [...ctx.periods].reverse().find((p) => p.end);
  const withinWindow = lastEnded && (lastEnded.end === today || (lastEnded.end === addDays(today, -1) && time < timings.fajr));
  if (lastEnded && !ctx.summary.inPeriod && withinWindow) {
    const endTimings = lastEnded.end === today ? timings : (await userTimings(user, settings, lastEnded.end)).timings;
    const rule = lastEnded.endTime ? prayersAfterPurification(lastEnded.endTime, endTimings, settings.purificationMarginMinutes) : null;
    const after = lastEnded.after || { ghusl: false, prayersDone: [] };
    const LABELS = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
    const prayers = (rule?.prayers || []).map((p) => ({ key: p, label: LABELS[p], time: endTimings[p], due: lastEnded.end < today || endTimings[p] <= time, done: after.prayersDone.includes(p) }));
    const done = (after.ghusl ? 1 : 0) + prayers.filter((p) => p.done).length;
    purification = {
      periodId: lastEnded.id,
      start: lastEnded.start,
      end: lastEnded.end,
      endTime: lastEnded.endTime || null,
      days: diffDays(lastEnded.end, lastEnded.start) + 1,
      prayers,
      next: rule?.next || null,
      ghusl: after.ghusl,
      done,
      total: 1 + prayers.length,
      ruleText: settings.purificationRuleText || 'Avis retenu par notre comité : purification avant le coucher du soleil, avec le temps du ghusl et d’une partie de la prière → Dhuhr et Asr ; avant l’aube → Maghrib et Isha.',
      endSigns: settings.endSigns,
    };
  }

  const nextPlanned = fastCtx.planDays[0] || null;
  // RG-46 — cartes contextuelles (la première non masquée est affichée).
  const [fastedMade, fastedVol, jumua, tomorrowTimings] = await Promise.all([
    MadeUpFast.exists({ user: user._id, day: today }),
    VoluntaryFast.exists({ user: user._id, day: today }),
    nextJumua(user, settings, today, time).catch(() => null),
    userTimings(user, settings, addDays(today, 1)).catch(() => null),
  ]);
  const cycleInfo = cycleCard(ctx, user);
  const contexts = contextCards({
    today,
    time,
    timings,
    tomorrowFajr: tomorrowTimings?.timings?.fajr,
    cycle: cycleInfo,
    inPeriod: pause.paused,
    purification,
    ramadan,
    fastCtx,
    user,
    settings,
    fastedToday: Boolean(fastedMade || fastedVol),
    jumua,
  });
  const white = whiteDays(today, adj, settings.excludeDhulHijja13);
  const pregnant = user.mode === 'grossesse';

  res.json({
    today,
    time,
    timezone: tz,
    hijri: toHijri(today, adj),
    user: { firstName: user.firstName, mode: user.mode, situation: user.situation, goal: user.onboarding?.goal, onboardingCompleted: user.onboarding?.completed },
    cycle: cycleInfo,
    contexts,
    prayers: {
      city: user.city?.name || 'Paris',
      // Source des horaires (5.7) : ville ou mosquée choisie, repli sur le calcul (RG-16 bis).
      sourceInfo: source,
      // Coordonnées utilisées pour l'API Aladhan (position GPS exacte ou ville choisie).
      location: { lat: options.lat, lng: options.lng, timezone: options.tz, source: user.city?.source || 'manuel', updatedAt: user.city?.updatedAt || null },
      method: { key: options.method, highLatitude: options.highLatitude, adjustments: options.adjustments },
      timings: withInstants(timings, tz),
      next: nextPrayer(timings, time),
      tomorrowFajr: tomorrowTimings?.timings?.fajr || null,
      current: currentPrayer(timings, time),
      checked: Object.fromEntries(PRAYERS.map((p) => [p, Boolean(prayerLog?.[p])])),
      paused: pause.paused,
      pauseReason: pause.reason,
      dhikr: pause.paused && user.prayerSettings?.dhikrDuringPeriod ? settings.dhikrDuringPeriod : null,
      qibla,
      source: timings.source,
      reminders: dhikrReminders({ timings, tz, prefs: user.prayerSettings, settings }),
      adhan: adhanFor(user.prayerSettings),
      // 4.1 — pendant les règles : horaires affichés (défaut) ou carte réduite à une ligne ; rappels coupés sauf choix contraire.
      periodHome: user.prayerSettings?.periodHome || 'horaires',
      remindersDuringPeriod: Boolean(user.prayerSettings?.keepRemindersDuringPeriod),
    },
    purification,
    whiteDays: { daysUntil: white.daysUntil, inProgress: white.inProgress, days: white.days, monthName: white.monthName },
    fasts: {
      remaining: fastCtx.counter.remaining,
      missed: fastCtx.counter.missed,
      madeUp: fastCtx.counter.madeUp,
      nextPlanned: nextPlanned?.day || null,
      // Rappels la veille au soir (heure réglable) : jours de rattrapage et jeûnes volontaires programmés.
      reminderTime: fastCtx.plan?.reminderTime || '21:00',
      planNext: fastCtx.planDays.slice(0, 3).map((p) => p.day),
      voluntaryReminderTime: user.voluntaryPlan?.reminderTime || '21:00',
      voluntaryNext: nextVoluntary(user.voluntaryPlan, {
        from: addDays(today, 1),
        days: 14,
        adj: settings.hijriAdjustment || 0,
        excl: settings.excludeDhulHijja13 !== false,
        periodOn: fastCtx.periodOn,
        done: new Set((await VoluntaryFast.find({ user: user._id, day: { $gt: today } }).select('day').lean()).map((v) => v.day)),
        limit: 4,
      })
        .filter((v) => !v.paused)
        .map((v) => v.day),
    },
    ramadan: { current: ramadan.current, daysUntil: ramadan.daysUntil ?? null, day: ramadan.day ?? null, hijriYear: ramadan.hijriYear, start: ramadan.start },
    health: {
      mood: healthLog?.mood || null,
      symptoms: healthLog?.symptoms || [],
      sleepHours: healthLog?.sleepHours ?? null,
      weight: healthLog?.weight ?? null,
      // Dernière mesure réelle (date comprise) ; null → « Ajouter mon poids », jamais une valeur fictive.
      lastWeight: lastWeight ? { day: lastWeight.day, weight: lastWeight.weight } : null,
      energy: healthLog?.energy ?? null,
    },
    // Conseil santé du jour (bibliothèque par phase, RG-08 ter) + conseils météo (Open-Meteo).
    healthTip: await tipOfTheDay(pregnant ? 'grossesse' : ctx.summary.phase, today),
    tips: buildHealthTips({ phase: null, weather, ramadan: ramadan.current, pregnant: false }),
    weather,
    reminder: reminder ? { kind: reminder.kind, text: reminder.text, source: reminder.source } : null,
    // 5.2 · 5 — Mes notes : les prochaines notes et rappels.
    // Empreinte des notes : les rappels du téléphone sont reprogrammés dès qu'une note change.
    notesStamp: await Note.find({ user: user._id }).sort({ updatedAt: -1 }).select('updatedAt').lean().then((l) => `${l.length}-${l[0]?.updatedAt?.getTime?.() || 0}`),
    notes: (await upcomingNotes(user._id, today, { days: 60, limit: 3 })).map((n) => ({ noteId: n.noteId, day: n.day, time: n.time, text: n.text, type: n.type, repeat: n.repeat, repeatLabel: n.repeatLabel, remind: n.remind })),
    notificationsUnread: unread,
    tomorrow: addDays(today, 1),
  });
});

export default router;
