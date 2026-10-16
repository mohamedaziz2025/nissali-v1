// 5.2 — Tableau de bord « Aujourd'hui » : une seule requête pour tout l'écran d'accueil.
import { Router } from 'express';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { DailyLog, Notification, PrayerLog, Reminder } from '../models/index.js';
import { HEALTH_ALERTS, PHASES } from '../content/phases.js';
import { loadCycleContext, loadFastContext, prayerPause } from '../services/context.js';
import { buildHealthTips, getWeather } from '../services/health.js';
import { tipOfTheDay } from '../services/healthTips.js';
import { ramadanInfo, toHijri, whiteDays } from '../services/hijri.js';
import { adhanFor } from '../services/adhan.js';
import { dhikrReminders } from '../services/dhikr.js';
import { userTimings } from '../services/prayerSource.js';
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
  const [{ timings, meta: source }, qibla, prayerLog, fastCtx, healthLog, reminder, unread] = await Promise.all([
    userTimings(user, settings, today),
    getQibla(options.lat, options.lng),
    PrayerLog.findOne({ user: user._id, day: today }).lean(),
    loadFastContext(user, ctx),
    DailyLog.findOne({ user: user._id, day: today }).lean(),
    reminderOfTheDay(today),
    Notification.countDocuments({ user: user._id, read: false }),
  ]);
  const weather = await weatherPromise;

  const pause = prayerPause(ctx);
  const ramadan = ramadanInfo(today, adj);

  // RG-16 / RG-19 — prières à accomplir après le ghusl, si les règles viennent de se terminer.
  let purification = null;
  const lastEnded = [...ctx.periods].reverse().find((p) => p.end);
  if (lastEnded && !ctx.summary.inPeriod && diffDays(today, lastEnded.end) <= 1) {
    const endTimings = lastEnded.end === today ? timings : (await userTimings(user, settings, lastEnded.end)).timings;
    const rule = lastEnded.endTime ? prayersAfterPurification(lastEnded.endTime, endTimings, settings.purificationMarginMinutes) : null;
    purification = { periodId: lastEnded.id, end: lastEnded.end, endTime: lastEnded.endTime || null, prayers: rule?.prayers || null, endSigns: settings.endSigns };
  }

  const nextPlanned = fastCtx.planDays[0] || null;
  const white = whiteDays(today, adj, settings.excludeDhulHijja13);
  const pregnant = user.mode === 'grossesse';

  res.json({
    today,
    time,
    timezone: tz,
    hijri: toHijri(today, adj),
    user: { firstName: user.firstName, mode: user.mode, situation: user.situation, goal: user.onboarding?.goal, onboardingCompleted: user.onboarding?.completed },
    cycle: cycleCard(ctx, user),
    prayers: {
      city: user.city?.name || 'Paris',
      // Source des horaires (5.7) : ville ou mosquée choisie, repli sur le calcul (RG-16 bis).
      sourceInfo: source,
      // Coordonnées utilisées pour l'API Aladhan (position GPS exacte ou ville choisie).
      location: { lat: options.lat, lng: options.lng, timezone: options.tz, source: user.city?.source || 'manuel', updatedAt: user.city?.updatedAt || null },
      method: { key: options.method, highLatitude: options.highLatitude, adjustments: options.adjustments },
      timings: withInstants(timings, tz),
      next: nextPrayer(timings, time),
      current: currentPrayer(timings, time),
      checked: Object.fromEntries(PRAYERS.map((p) => [p, Boolean(prayerLog?.[p])])),
      paused: pause.paused,
      pauseReason: pause.reason,
      dhikr: pause.paused && user.prayerSettings?.dhikrDuringPeriod ? settings.dhikrDuringPeriod : null,
      qibla,
      source: timings.source,
      reminders: dhikrReminders({ timings, tz, prefs: user.prayerSettings, settings }),
      adhan: adhanFor(user.prayerSettings),
    },
    purification,
    whiteDays: { daysUntil: white.daysUntil, inProgress: white.inProgress, days: white.days, monthName: white.monthName },
    fasts: { remaining: fastCtx.counter.remaining, missed: fastCtx.counter.missed, madeUp: fastCtx.counter.madeUp, nextPlanned: nextPlanned?.day || null },
    ramadan: { current: ramadan.current, daysUntil: ramadan.daysUntil ?? null, day: ramadan.day ?? null, hijriYear: ramadan.hijriYear, start: ramadan.start },
    health: {
      mood: healthLog?.mood || null,
      symptoms: healthLog?.symptoms || [],
      sleepHours: healthLog?.sleepHours ?? null,
      weight: healthLog?.weight ?? null,
      energy: healthLog?.energy ?? null,
    },
    // Conseil santé du jour (bibliothèque par phase, RG-08 ter) + conseils météo (Open-Meteo).
    healthTip: await tipOfTheDay(pregnant ? 'grossesse' : ctx.summary.phase, today),
    tips: buildHealthTips({ phase: null, weather, ramadan: ramadan.current, pregnant: false }),
    weather,
    reminder: reminder ? { kind: reminder.kind, text: reminder.text, source: reminder.source } : null,
    notificationsUnread: unread,
    tomorrow: addDays(today, 1),
  });
});

export default router;
