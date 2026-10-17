// Paiement des abonnements praticiennes via Stripe Checkout (mode abonnement).
// Appels REST avec fetch, comme les autres prestataires (SMS, mosquées, géo) : pas de SDK.
// Les prix restent gérés dans le back-office ; Stripe reçoit le montant calculé à la volée.
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const API = 'https://api.stripe.com/v1';

/** Paiement en ligne actif ? Vide = l'équipe confirme les règlements manuellement (comme avant). */
export const stripeEnabled = () => Boolean(env.stripe.secretKey && env.stripe.webhookSecret);

/** Applatit un objet en x-www-form-urlencoded avec la notation Stripe : `a[0][b]=…`. */
export function stripeForm(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    appendValue(prefix ? `${prefix}[${key}]` : key, value, out);
  }
  return out;
}

function appendValue(name, value, out) {
  if (Array.isArray(value)) value.forEach((v, i) => appendValue(`${name}[${i}]`, v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) appendValue(`${name}[${k}]`, v, out);
  else out.append(name, String(value));
}

async function stripeFetch(path, { method = 'POST', form } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form ? stripeForm(form).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json?.error?.message || res.statusText}`);
  return json;
}

/** Client Stripe de la praticienne : créé une fois, réutilisé pour tous ses paiements. */
export async function ensureCustomer(practitioner, user) {
  if (practitioner.stripeCustomerId) return practitioner.stripeCustomerId;
  const customer = await stripeFetch('/customers', {
    form: {
      email: user?.email || undefined,
      name: practitioner.displayName,
      metadata: { practitionerId: String(practitioner._id) },
    },
  });
  practitioner.stripeCustomerId = customer.id;
  await practitioner.save();
  return customer.id;
}

/**
 * Session Stripe Checkout pour un abonnement (mode « subscription », renouvellement automatique).
 * Le prix est calculé depuis la formule (mensuelle ou annuelle) au moment du clic.
 */
export async function createSubscriptionCheckout({ practitioner, user, plan, billing, subscriptionId, returnUrl }) {
  const interval = billing === 'annuel' ? 'year' : 'month';
  const amountCents = Math.round((billing === 'annuel' ? plan.priceYearly : plan.priceMonthly) * 100);
  const customerId = await ensureCustomer(practitioner, user);
  const label = `Nissali Pro — formule ${plan.name} (${billing})`;
  const meta = { practitionerId: String(practitioner._id), planKey: plan.key, billing, subscriptionId: String(subscriptionId) };
  return stripeFetch('/checkout/sessions', {
    form: {
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.stripe.currency,
            unit_amount: amountCents,
            recurring: { interval },
            product_data: { name: label, metadata: { planKey: plan.key } },
          },
        },
      ],
      subscription_data: { metadata: meta },
      metadata: meta,
      success_url: `${returnUrl}?paiement=ok`,
      cancel_url: `${returnUrl}?paiement=annule`,
      allow_promotion_codes: true,
    },
  });
}

/** Portail client Stripe : le praticienne gère moyen de paiement et résiliation. */
export async function createPortalSession(customerId, returnUrl) {
  return stripeFetch('/billing_portal/sessions', { form: { customer: customerId, return_url: returnUrl } });
}

/** Abonnement Stripe (pour connaître la fin de période courante). */
export async function retrieveSubscription(stripeSubscriptionId) {
  return stripeFetch(`/subscriptions/${stripeSubscriptionId}`, { method: 'GET' });
}

/** Demande de résiliation à la fin de la période en cours (formule conservée jusqu'au bout). */
export async function cancelAtPeriodEnd(stripeSubscriptionId) {
  return stripeFetch(`/subscriptions/${stripeSubscriptionId}`, { form: { cancel_at_period_end: 'true' } });
}

/** Statut d'un abonnement Stripe → statut local. Les impayés retournent « en_attente ». */
export function mapStripeStatus(status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'canceled') return 'annulee';
  return 'en_attente';
}

/**
 * Abonnement Stripe d'une facture, quelle que soit la version d'API du compte :
 * `invoice.subscription` (avant 2025-03-31) ou `invoice.parent.subscription_details.subscription`.
 */
export function subscriptionIdOf(invoice) {
  const ref = invoice?.subscription || invoice?.parent?.subscription_details?.subscription;
  if (!ref) return null;
  return (typeof ref === 'string' ? ref : ref.id) || null;
}

/** Un abonnement résilié ou remplacé chez nous ne doit pas être réactivé par un webhook en retard. */
export const canActivate = (localStatus) => localStatus !== 'annulee';

/**
 * Vérifie la signature d'un webhook Stripe (en-tête `Stripe-Signature`) contre le corps brut.
 * Payload signé = `${timestamp}.${rawBody}`, HMAC SHA-256 avec le secret du webhook.
 * Rejette aussi un horodatage trop éloigné (rejeu).
 */
export function verifyStripeSignature(rawBody, header, secret = env.stripe.webhookSecret, toleranceSeconds = 300) {
  if (!secret) return false;
  const parts = Object.create(null);
  for (const piece of String(header || '').split(',')) {
    const [key, value] = piece.split('=');
    if (!key || value === undefined) continue;
    (parts[key.trim()] ||= []).push(value.trim());
  }
  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 || [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  return signatures.some((s) => {
    const b = Buffer.from(s, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
