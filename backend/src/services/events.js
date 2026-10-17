// 5.11 — Événements : présentation, places restantes, commission de 15 % (RG-29).
import { distanceKm } from './geo.js';
import { localParts } from '../utils/dates.js';

export const COMMISSION_RATE = 0.15;

export const commissionFor = (event, amount) => (event.organizerType === 'soeur' && amount > 0 ? Math.round(amount * COMMISSION_RATE * 100) / 100 : 0);

export function presentEvent(e, { from, registration, mine } = {}) {
  const tz = e.timezone || 'Europe/Paris';
  const start = localParts(new Date(e.startAt), tz);
  const end = e.endAt ? localParts(new Date(e.endAt), tz) : null;
  return {
    id: String(e._id),
    title: e.title,
    description: e.description,
    programme: e.programme,
    day: start.day,
    time: start.time,
    endTime: end?.time || null,
    startAt: e.startAt,
    location: e.location,
    distanceKm: from?.lat != null && e.location?.lat != null ? Math.round(distanceKm(from, e.location) * 10) / 10 : null,
    imageUrl: e.imageUrl || null,
    photos: (e.photos || []).filter(Boolean),
    capacity: e.capacity,
    placesLeft: Math.max(0, e.capacity - (e.registrationsCount || 0)),
    price: e.price || 0,
    free: !e.price,
    // Bouton « Réserver ma place » seulement avec un lien HTTPS (sinon « Billetterie à venir »).
    ticketUrl: e.price && /^https:\/\/\S+\.\S+/.test(e.ticketUrl || '') ? e.ticketUrl : null,
    organizerType: e.organizerType,
    organizerName: e.organizerType === 'nissali' ? 'Nissali' : e.organizerName || 'Une sœur',
    cancellationPolicy: e.cancellationPolicy,
    status: e.status,
    ...(mine ? { moderationNote: e.moderationNote || null, registrationsCount: e.registrationsCount || 0, commissionRate: e.organizerType === 'soeur' && e.price ? COMMISSION_RATE : 0 } : {}),
    registered: Boolean(registration && registration.status === 'inscrite'),
    registration: registration ? { status: registration.status, paymentStatus: registration.paymentStatus, amount: registration.amount } : null,
  };
}
