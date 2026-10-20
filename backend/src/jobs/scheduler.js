// Tâches planifiées : notifications du 5.12 (discrètes, RG-17), rappels de prière en push,
// rappels de rendez-vous, clôture des réservations passées, purge RGPD (8.2).
import cron from 'node-cron';
import { syncAllJumua } from '../services/mawaqit.js';
import { broadcastJob } from '../services/broadcasts.js';
import { Booking, Event, EventRegistration, FastPlan, Plan, Practitioner, PushSubscription, Subscription, User } from '../models/index.js';
import { loadCycleContext, loadFastContext, nowFor, prayerPause } from '../services/context.js';
import { ramadanInfo, whiteDays } from '../services/hijri.js';
import { dhikrReminders } from '../services/dhikr.js';
import { notify, push } from '../services/notifications.js';
import { PRAYER_LABELS, PRAYERS } from '../services/prayerService.js';
import { userTimings } from '../services/prayerSource.js';
import { addDays } from '../utils/dates.js';

let running = false;

/** Notifications du jour pour une utilisatrice (dédoublonnées par clé). */
export async function runUserNotifications(user) {
  if (!user.consents?.health?.accepted || !user.onboarding?.completed) return;
  const prefs = user.notificationPrefs || {};
  const ctx = await loadCycleContext(user);
  const { today, time, settings, summary } = ctx;
  const adj = settings.hijriAdjustment || 0;
  const id = user._id;

  if (user.mode === 'cycle' && summary.nextPeriod) {
    // Règles prévues : 2 jours avant (« Petit rappel du jour » sur l'écran verrouillé)
    if (prefs.periodSoon !== false && summary.daysUntilNext === 2 && time >= '09:00') {
      await notify(id, { key: `period-soon-${summary.nextPeriod.date}`, type: 'regles_prevues', detail: 'Tes règles sont prévues dans 2 jours.', link: '/cycle' });
    }
    // Fenêtre fertile : premier jour, en mode « Je veux un enfant »
    if (prefs.fertileWindow !== false && user.onboarding?.goal === 'enfant' && summary.ovulation?.fertileStart === today && time >= '09:00') {
      await notify(id, { key: `fertile-${today}`, type: 'fenetre_fertile', detail: 'Ta fenêtre fertile commence aujourd’hui.', link: '/cycle' });
    }
  }
  // Fin des règles : le lendemain de la durée habituelle si pas de fin saisie (RG-12)
  if (prefs.periodEndQuestion !== false && summary.inPeriod && summary.askPeriodEnded && summary.periodDay === summary.periodLength + 1 && time >= '10:00') {
    await notify(id, { key: `period-end-q-${summary.currentPeriod.start}`, type: 'fin_regles', detail: 'Tes règles sont-elles terminées ?', link: '/aujourdhui' });
  }
  // Ramadan : 7 jours avant, puis au début
  const ramadan = ramadanInfo(today, adj);
  if (prefs.ramadan !== false && time >= '09:00') {
    if (!ramadan.current && ramadan.daysUntil === 7) await notify(id, { key: `ramadan-7-${ramadan.hijriYear}`, type: 'ramadan', detail: 'Ramadan commence dans 7 jours.', link: '/jeunes' });
    if (ramadan.current && ramadan.day === 1) await notify(id, { key: `ramadan-start-${ramadan.hijriYear}`, type: 'ramadan', body: 'Ramadan Moubarak', detail: 'Ramadan commence aujourd’hui. Ton compteur se remplira tout seul pendant tes règles.', link: '/jeunes' });
  }
  // Jours blancs : la veille du 13
  const white = whiteDays(today, adj, settings.excludeDhulHijja13);
  if (prefs.whiteDays !== false && white.daysUntil === 1 && time >= '18:00') {
    await notify(id, { key: `white-${white.days[0].day}`, type: 'jours_blancs', detail: 'Les jours blancs commencent demain.', link: '/jeunes' });
  }
  // Jour de rattrapage : la veille au soir (V1.1)
  if (prefs.fastMakeup !== false) {
    const plan = await FastPlan.findOne({ user: id, active: true }).lean();
    if (plan && time >= plan.reminderTime) {
      const fasts = await loadFastContext(user, ctx);
      if (fasts.planDays.some((d) => d.day === addDays(today, 1))) {
        await notify(id, { key: `makeup-${addDays(today, 1)}`, type: 'rattrapage', detail: 'Demain est un jour de rattrapage prévu dans ton plan.', link: '/jeunes' });
      }
    }
  }
  // Pilule
  if (user.contraception?.pillReminder && time >= (user.contraception.pillTime || '21:00')) {
    await notify(id, { key: `pill-${today}`, type: 'pilule', detail: 'C’est l’heure de ta pilule.', link: '/aujourdhui' }, { sendPush: true });
  }
}

async function notificationsJob() {
  if (running) return;
  running = true;
  try {
    const cursor = User.find({ role: 'user', status: 'active', 'onboarding.completed': true }).cursor();
    for await (const user of cursor) {
      try {
        await runUserNotifications(user);
      } catch (err) {
        console.warn('[jobs] notification', String(user._id), err.message);
      }
    }
    // 5.12 — Événements : rappel la veille aux inscrites.
    const tomorrow = await Event.find({ status: 'publie', reminderSent: false, startAt: { $lte: new Date(Date.now() + 24 * 3600_000), $gte: new Date() } });
    for (const e of tomorrow) {
      const regs = await EventRegistration.find({ event: e._id, status: 'inscrite' }).select('user').lean();
      for (const r of regs) await notify(r.user, { key: `event-reminder-${e.id}`, type: 'evenement', title: 'Nissali', body: 'Ton événement, c’est demain', detail: `Rappel : « ${e.title} » demain${e.location?.city ? ` à ${e.location.city}` : ''}.`, link: `/evenement/${e.id}` });
      e.reminderSent = true;
      await e.save();
    }
    // Rappel de rendez-vous la veille
    const soon = await Booking.find({ status: 'confirmee', reminderSent: false, startAt: { $lte: new Date(Date.now() + 24 * 3600_000), $gte: new Date() } });
    for (const b of soon) {
      const p = await Practitioner.findById(b.practitioner).lean();
      await notify(b.client, { key: `booking-reminder-${b.id}`, type: 'reservation', body: 'Rendez-vous demain', detail: `Rappel : « ${b.serviceName} » avec ${p?.displayName || 'ta praticienne'} le ${b.day} à ${b.time}.`, link: '/praticiennes/rendez-vous' });
      b.reminderSent = true;
      await b.save();
    }
  } finally {
    running = false;
  }
}

/** Prières : push à l'heure de chaque prière, sauf pendant les règles (RG-15). */
async function prayerPushJob() {
  const subs = await PushSubscription.distinct('user');
  for (const userId of subs) {
    const user = await User.findById(userId);
    if (!user || user.prayerSettings?.notifications === false || !user.city) continue;
    const { today, time } = nowFor(user);
    const ctx = await loadCycleContext(user);
    const { timings, opts: options } = await userTimings(user, ctx.settings, today);
    // Rappels de dhikr (matin, soir, vendredi) à l'heure calculée pour sa position.
    for (const r of dhikrReminders({ timings, tz: options.tz, prefs: user.prayerSettings, settings: ctx.settings })) {
      if (r.time === time) await push(user._id, { title: r.title, body: r.body, link: '/aujourdhui' });
    }
    const due = PRAYERS.find((p) => timings[p] === time);
    if (!due) continue;
    const pause = prayerPause(ctx);
    if (pause.paused) {
      if (user.prayerSettings?.dhikrDuringPeriod) await push(user._id, { title: 'Nissali', body: ctx.settings.dhikrDuringPeriod || 'Un moment pour le dhikr' });
      continue;
    }
    await push(user._id, { title: `${PRAYER_LABELS[due]} · ${timings[due]}`, body: `C’est l’heure de ${PRAYER_LABELS[due]}`, link: '/aujourdhui' });
  }
}

/** Réservations passées → terminées ; purge des comptes inactifs depuis 3 ans (8.2). */
/** Essai gratuit des praticiennes : rappel 3 jours avant la fin, puis bascule sur la formule gratuite. */
async function trialJob() {
  const now = new Date();
  const subs = await Subscription.find({ trial: true, status: 'active', endsAt: { $ne: null, $lte: new Date(now.getTime() + 3 * 86_400_000) } }).lean();
  for (const sub of subs) {
    const p = await Practitioner.findById(sub.practitioner).select('user').lean();
    if (!p) continue;
    if (sub.endsAt <= now) {
      await Subscription.updateOne({ _id: sub._id, status: 'active' }, { $set: { status: 'expiree' } });
      const free = await Plan.findOne({ key: 'decouverte' }).select('name').lean();
      await notify(p.user, { key: `trial-ended-${sub._id}`, type: 'abonnement', title: 'Nissali Pro', body: 'Ton essai gratuit est terminé', detail: `Tu es passée sur la formule ${free?.name || 'gratuite'}. Choisis une formule pour retrouver toutes les fonctionnalités.`, link: '/pro/abonnement' });
    } else {
      const days = Math.max(1, Math.ceil((sub.endsAt.getTime() - now.getTime()) / 86_400_000));
      await notify(p.user, { key: `trial-soon-${sub._id}`, type: 'abonnement', title: 'Nissali Pro', body: `Ton essai gratuit se termine dans ${days} jour${days > 1 ? 's' : ''}`, detail: 'Choisis une formule pour garder tes fonctionnalités après l’essai.', link: '/pro/abonnement' });
    }
  }
}

async function dailyMaintenance() {
  await trialJob().catch((e) => console.error('[jobs] essai gratuit', e));
  await Booking.updateMany({ status: 'confirmee', endAt: { $lt: new Date(Date.now() - 2 * 3600_000) } }, { $set: { status: 'terminee' } });
  const threeYears = new Date(Date.now() - 3 * 365 * 86_400_000);
  const inactive = await User.find({ role: 'user', lastActiveAt: { $lt: threeYears } }).select('_id').lean();
  if (inactive.length) {
    const { purgeUser } = await import('../services/purge.js');
    for (const u of inactive) await purgeUser(u._id);
    console.log(`[jobs] ${inactive.length} compte(s) inactif(s) depuis 3 ans supprimé(s)`);
  }
}

export function startScheduler() {
  cron.schedule('*/10 * * * *', () => notificationsJob().catch((e) => console.error('[jobs]', e)));
  cron.schedule('* * * * *', () => prayerPushJob().catch((e) => console.error('[jobs] prières', e)));
  // 8.3 / 8.4 — notifications programmées, articles publiés avec push, envois décalés (nuit, prière).
  cron.schedule('* * * * *', () => broadcastJob().catch((e) => console.error('[jobs] notifications équipe', e)));
  // Jumu'a des mosquées partenaires depuis Mawaqit (si MAWAQIT_API_TOKEN est défini), chaque nuit.
  cron.schedule('40 3 * * *', () => syncAllJumua().catch((e) => console.error('[jobs] mawaqit', e)));
  cron.schedule('15 3 * * *', () => dailyMaintenance().catch((e) => console.error('[jobs] maintenance', e)));
  setTimeout(() => dailyMaintenance().catch(() => {}), 10_000);
  console.log('[jobs] tâches planifiées démarrées');
}
