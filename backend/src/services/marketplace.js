// Espace praticiennes : formules, créneaux disponibles, fiches clientes.
import { distanceKm } from './geo.js';
import { Availability, Booking, ClientRecord, Plan, Practitioner, Service, Subscription, TimeOff } from '../models/index.js';
import { cancelAtPeriodEnd } from './stripe.js';
import { addDays, localParts, minutesToTime, timeToMinutes, weekday, zonedToDate } from '../utils/dates.js';
import { forbidden } from '../utils/http.js';

export const FREE_PLAN_KEY = 'decouverte';
export const TRIAL_PLAN_KEY = 'essai';

/** Essai gratuit créé au premier démarrage ; l'équipe règle ensuite ses fonctionnalités et sa durée. */
export const TRIAL_PLAN = {
  key: TRIAL_PLAN_KEY,
  name: 'Essai gratuit',
  tagline: 'Découvre l’espace pro sans engagement, sans carte bancaire',
  priceMonthly: 0,
  priceYearly: 0,
  order: 0,
  trial: true,
  trialDays: 30,
  features: { maxServices: 3, maxBookingsPerMonth: 0, video: true, crm: true, stats: true, featured: false, verifiedBadge: false, prioritySupport: false },
  highlights: [],
};

export async function ensureTrialPlan() {
  if (!(await Plan.exists({ trial: true }))) await Plan.updateOne({ key: TRIAL_PLAN_KEY }, { $setOnInsert: TRIAL_PLAN }, { upsert: true });
}

/** Essai gratuit proposé à l'inscription (null si l'équipe l'a désactivé). */
export const activeTrialPlan = () => Plan.findOne({ trial: true, active: true }).sort({ order: 1 });

/** Fonctionnalités d'une formule en clair, d'après les réglages du back-office. */
export function featureList(f = {}) {
  const list = [];
  list.push(!f.maxServices ? 'Prestations illimitées' : `${f.maxServices} prestation${f.maxServices > 1 ? 's' : ''}`);
  list.push(!f.maxBookingsPerMonth ? 'Rendez-vous illimités' : `Jusqu’à ${f.maxBookingsPerMonth} rendez-vous par mois`);
  if (f.video) list.push('Consultations en visio');
  if (f.crm) list.push('Fiches clientes');
  if (f.stats) list.push('Statistiques');
  if (f.featured) list.push('Mise en avant dans l’annuaire');
  if (f.verifiedBadge) list.push('Badge vérifiée');
  if (f.prioritySupport) list.push('Support prioritaire');
  return list;
}

export const planCard = (p) => ({
  key: p.key,
  name: p.name,
  tagline: p.tagline,
  priceMonthly: p.priceMonthly,
  priceYearly: p.priceYearly,
  features: p.features,
  highlights: p.highlights?.length ? p.highlights : featureList(p.features),
  included: featureList(p.features),
  trial: Boolean(p.trial),
  trialDays: p.trial ? p.trialDays || 0 : undefined,
});

/** Essai en cours : date de fin et jours restants (null hors essai). */
export function trialInfo(subscription, plan) {
  if (!subscription?.trial) return null;
  const end = subscription.endsAt ? new Date(subscription.endsAt) : null;
  return {
    name: plan?.name || 'Essai gratuit',
    endsAt: end,
    daysLeft: end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000)) : null,
    included: featureList(plan?.features),
  };
}

/**
 * Onglet Praticiennes ouvert ? Par défaut (« auto ») : dès qu'au moins une praticienne est validée
 * par l'équipe ; sinon il reste flouté « Bientôt disponible ». L'équipe peut forcer l'ouverture ou la fermeture.
 */
export async function directoryOpen(settings) {
  if (settings.practitionersMode === 'ouvert') return true;
  if (settings.practitionersMode === 'ferme') return false;
  return Boolean(await Practitioner.exists({ status: 'validee' }));
}
export const ACTIVE_BOOKING = ['en_attente', 'confirmee'];

export async function getPractitionerFor(user) {
  return Practitioner.findOne({ user: user._id });
}

/** Formule active de la praticienne (la formule gratuite par défaut). */
export async function activePlanFor(practitioner) {
  const sub = await Subscription.findOne({ practitioner: practitioner._id, status: 'active' }).sort({ createdAt: -1 });
  if (sub?.endsAt && sub.endsAt < new Date()) {
    sub.status = 'expiree';
    await sub.save();
  }
  const key = sub && sub.status === 'active' ? sub.plan : FREE_PLAN_KEY;
  const plan = (await Plan.findOne({ key })) || (await Plan.findOne({ key: FREE_PLAN_KEY }));
  return { plan, subscription: sub && sub.status === 'active' ? sub : null };
}

/**
 * Une seule formule payante à la fois : résilie chez Stripe les abonnements en ligne précédents.
 * Résiliation à la fin de la période : le temps déjà payé est conservé, rien n'est remboursé,
 * et l'ancien abonnement ne peut plus facturer ni renouveler (donc plus de double facturation).
 */
export async function endOtherOnlineSubscriptions(practitionerId, keepId) {
  const filter = {
    practitioner: practitionerId,
    stripeSubscriptionId: { $ne: null },
    status: { $in: ['active', 'en_attente', 'expiree'] },
  };
  if (keepId) filter._id = { $ne: keepId };
  const previous = await Subscription.find(filter).lean();
  for (const sub of previous) {
    try {
      await cancelAtPeriodEnd(sub.stripeSubscriptionId);
    } catch (err) {
      // Stripe injoignable : l'abonnement local sera tout de même « annulee » (webhook ignoré
      // ensuite pour un abonnement annulé) ; à surveiller dans les logs.
      console.warn('[stripe] résiliation de l’abonnement précédent impossible :', err.message);
    }
  }
}

export async function assertFeature(practitioner, feature) {
  const { plan } = await activePlanFor(practitioner);
  if (!plan?.features?.[feature]) throw forbidden('Cette fonctionnalité n’est pas incluse dans ta formule', 'PLAN_UPGRADE_REQUIRED');
  return plan;
}

export async function assertServiceQuota(practitioner) {
  const { plan } = await activePlanFor(practitioner);
  const max = plan?.features?.maxServices ?? 1;
  if (max > 0 && (await Service.countDocuments({ practitioner: practitioner._id, active: true })) >= max) {
    throw forbidden(`Ta formule permet ${max} prestation${max > 1 ? 's' : ''} active${max > 1 ? 's' : ''}`, 'PLAN_UPGRADE_REQUIRED');
  }
}

/** Créneaux libres d'une praticienne pour un jour et une prestation. */
export async function availableSlots(practitioner, service, day, { stepMinutes = 30 } = {}) {
  const tz = practitioner.timezone || 'Europe/Paris';
  const [windows, offs, bookings] = await Promise.all([
    Availability.find({ practitioner: practitioner._id, weekday: weekday(day), active: true }).lean(),
    TimeOff.find({ practitioner: practitioner._id, from: { $lte: day }, to: { $gte: day } }).lean(),
    Booking.find({ practitioner: practitioner._id, day, status: { $in: ACTIVE_BOOKING } }).lean(),
  ]);
  if (offs.length) return [];
  const minStart = new Date(Date.now() + (practitioner.minNoticeHours ?? 12) * 3600_000);
  const taken = bookings.map((b) => [timeToMinutes(b.time), timeToMinutes(b.endTime)]);
  const slots = [];
  for (const w of windows) {
    for (let t = timeToMinutes(w.start); t + service.durationMinutes <= timeToMinutes(w.end); t += stepMinutes) {
      const end = t + service.durationMinutes;
      if (taken.some(([s, e]) => t < e && end > s)) continue;
      const time = minutesToTime(t);
      if (zonedToDate(day, time, tz) < minStart) continue;
      slots.push({ time, endTime: minutesToTime(end) });
    }
  }
  return slots.sort((a, b) => (a.time < b.time ? -1 : 1));
}

/**
 * Première disponibilité d'une praticienne pour une prestation, sur `days` jours.
 * Une seule requête par collection (disponibilités, congés, réservations) : adapté à une liste.
 */
export async function nextSlot(practitioner, service, days = 21) {
  const tz = practitioner.timezone || 'Europe/Paris';
  const today = localParts(new Date(), tz).day;
  const last = addDays(today, days - 1);
  const [windows, offs, bookings] = await Promise.all([
    Availability.find({ practitioner: practitioner._id, active: true }).lean(),
    TimeOff.find({ practitioner: practitioner._id, from: { $lte: last }, to: { $gte: today } }).lean(),
    Booking.find({ practitioner: practitioner._id, day: { $gte: today, $lte: last }, status: { $in: ACTIVE_BOOKING } }).select('day time endTime').lean(),
  ]);
  if (!windows.length) return null;
  const minStart = new Date(Date.now() + (practitioner.minNoticeHours ?? 12) * 3600_000);
  for (let i = 0; i < days; i += 1) {
    const day = addDays(today, i);
    if (offs.some((o) => o.from <= day && o.to >= day)) continue;
    const taken = bookings.filter((b) => b.day === day).map((b) => [timeToMinutes(b.time), timeToMinutes(b.endTime)]);
    const todays = windows.filter((w) => w.weekday === weekday(day)).sort((a, b) => (a.start < b.start ? -1 : 1));
    for (const w of todays) {
      for (let t = timeToMinutes(w.start); t + service.durationMinutes <= timeToMinutes(w.end); t += 30) {
        if (taken.some(([s, e]) => t < e && t + service.durationMinutes > s)) continue;
        const time = minutesToTime(t);
        if (zonedToDate(day, time, tz) < minStart) continue;
        return { day, time, serviceId: String(service._id) };
      }
    }
  }
  return null;
}

/** Prochains jours ayant au moins un créneau. */
export async function nextAvailableDays(practitioner, service, count = 14) {
  const today = localParts(new Date(), practitioner.timezone || 'Europe/Paris').day;
  const days = [];
  for (let i = 0; i < 60 && days.length < count; i += 1) {
    const day = addDays(today, i);
    const slots = await availableSlots(practitioner, service, day);
    if (slots.length) days.push({ day, slots });
  }
  return days;
}

/** Met à jour la fiche cliente lors d'une réservation confirmée. */
export async function touchClientRecord(booking) {
  const record = await ClientRecord.findOneAndUpdate(
    { practitioner: booking.practitioner, client: booking.client },
    { $inc: { bookingCount: 1 }, $set: { lastBookingAt: booking.startAt } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const status = record.bookingCount >= 5 ? 'fidele' : record.bookingCount >= 2 ? 'reguliere' : 'nouvelle';
  if (record.status !== 'inactive' && record.status !== status) {
    record.status = status;
    await record.save();
  }
  return record;
}

export async function refreshRating(practitionerId) {
  const { Review } = await import('../models/index.js');
  const stats = await Review.aggregate([
    { $match: { practitioner: practitionerId, hidden: false } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Practitioner.updateOne(
    { _id: practitionerId },
    { $set: { rating: stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0, reviewsCount: stats[0]?.count || 0 } },
  );
}

export function publicPractitioner(p, { plan } = {}, from = null) {
  return {
    id: p.id || String(p._id),
    displayName: p.displayName,
    specialty: p.specialty,
    categories: p.categories,
    description: p.description,
    photoUrl: p.photoUrl,
    city: p.location?.city,
    region: p.location?.region || '',
    address: p.location?.address,
    // RG-26 : le numéro n'est visible que si la praticienne a choisi de l'afficher.
    phone: p.showPhone && p.phone ? p.phone : null,
    diplomas: p.diplomas || [],
    distanceKm: from?.lat != null && p.location?.lat != null ? Math.round(distanceKm(from, p.location) * 10) / 10 : null,
    createdAt: p.createdAt,
    languages: p.languages,
    inPerson: p.inPerson,
    supportsVideo: Boolean(p.supportsVideo && plan?.features?.video),
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    verified: Boolean(plan?.features?.verifiedBadge),
    featured: Boolean(plan?.features?.featured),
  };
}
