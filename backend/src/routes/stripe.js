// Webhook Stripe : confirmation des paiements d'abonnement des praticiennes.
// Monté AVANT le parseur JSON global (express.raw) : la signature Stripe porte sur le corps brut.
// Reçoit le paiement, bascule l'abonnement local en « active » et notifie la praticienne.
import express, { Router } from 'express';
import { Practitioner, Subscription } from '../models/index.js';
import { notify } from '../services/notifications.js';
import { mapStripeStatus, retrieveSubscription, stripeEnabled, verifyStripeSignature } from '../services/stripe.js';

const router = Router();

router.get('/config', (_req, res) => res.json({ enabled: stripeEnabled() }));

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeEnabled()) return res.status(503).json({ error: 'Paiement en ligne non configuré', code: 'STRIPE_DISABLED' });
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) {
    return res.status(400).json({ error: 'Signature invalide', code: 'INVALID_SIGNATURE' });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Corps JSON invalide' });
  }
  try {
    await handle(event);
  } catch (err) {
    // 200 pour ne pas faire retenter Stripe à l'infini sur nos erreurs internes.
    console.error(`[stripe:webhook] ${event.type}:`, err.message);
  }
  res.json({ received: true });
});

async function handle(event) {
  const object = event.data?.object || {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const sub = await findBySession(object);
      if (!sub) return;
      sub.stripeSessionId = object.id;
      sub.stripeSubscriptionId = object.subscription || sub.stripeSubscriptionId;
      sub.stripeCustomerId = object.customer || sub.stripeCustomerId;
      sub.paymentReference = object.payment_intent || sub.paymentReference;
      let stripeSub = null;
      try {
        stripeSub = object.subscription ? await retrieveSubscription(object.subscription) : null;
      } catch (err) {
        console.warn('[stripe:webhook] abonnement non récupéré :', err.message);
      }
      await activate(sub, stripeSub);
      return;
    }
    case 'invoice.paid': {
      // Renouvellement (ou paiement récupéré) : la période et le statut viennent de Stripe.
      const sub = object.subscription ? await Subscription.findOne({ stripeSubscriptionId: object.subscription }) : null;
      if (!sub) return;
      let stripeSub = null;
      try {
        stripeSub = await retrieveSubscription(object.subscription);
      } catch (err) {
        console.warn('[stripe:webhook] abonnement non récupéré :', err.message);
      }
      if (!stripeSub || mapStripeStatus(stripeSub.status) === 'active') await activate(sub, stripeSub);
      return;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = await Subscription.findOne({ stripeSubscriptionId: object.id });
      if (!sub) return;
      sub.cancelAtPeriodEnd = Boolean(object.cancel_at_period_end);
      const end = stripePeriodEnd(object);
      if (end) sub.endsAt = end;
      const mapped = event.type === 'customer.subscription.deleted' ? 'annulee' : mapStripeStatus(object.status);
      if (mapped === 'active') {
        await activate(sub, object);
        return;
      }
      if (sub.status !== mapped) {
        sub.status = mapped;
        await sub.save();
        await notifyPractitioner(sub, 'Abonnement modifié', `Ton abonnement « ${sub.plan} » est passé au statut « ${mapped} ».`);
      }
      return;
    }
    case 'invoice.payment_failed': {
      const sub = object.subscription ? await Subscription.findOne({ stripeSubscriptionId: object.subscription }) : null;
      if (!sub || sub.status !== 'active') return;
      sub.status = 'en_attente';
      await sub.save();
      await notifyPractitioner(sub, 'Paiement en échec', `Le renouvellement de ta formule « ${sub.plan} » a échoué. Mets à jour ton moyen de paiement pour la garder active.`);
      return;
    }
    default:
      return undefined;
  }
}

/** Abonnement local concerné par une session Checkout (par les métadonnées, sinon par la session). */
async function findBySession(session) {
  const meta = session.metadata || {};
  if (meta.subscriptionId) {
    const sub = await Subscription.findById(meta.subscriptionId);
    if (sub) return sub;
  }
  if (session.id) {
    const bySession = await Subscription.findOne({ stripeSessionId: session.id });
    if (bySession) return bySession;
  }
  return null;
}

/** Active l'abonnement (une seule formule active à la fois) et notifie la praticienne à l'activation. */
async function activate(sub, stripeSub) {
  const wasActive = sub.status === 'active';
  await Subscription.updateMany({ practitioner: sub.practitioner, status: 'active', _id: { $ne: sub._id } }, { $set: { status: 'annulee' } });
  sub.status = 'active';
  sub.startedAt = sub.startedAt || new Date();
  // Fin de période fournie par Stripe, sinon recalculée selon la facturation.
  sub.endsAt = stripePeriodEnd(stripeSub) || periodEnd(sub.billing);
  sub.cancelAtPeriodEnd = Boolean(stripeSub?.cancel_at_period_end);
  await sub.save();
  // On ne notifie qu'à l'activation (premier paiement ou paiement récupéré), pas à chaque renouvellement.
  if (!wasActive) await notifyPractitioner(sub, 'Ta formule est active', `Paiement confirmé : ta formule « ${sub.plan} » est active jusqu’au ${sub.endsAt.toISOString().slice(0, 10)}.`, `sub-${sub.id}-active`);
}

/** Fin de période d'un abonnement Stripe (selon la version d'API : abonnement ou première ligne). */
function stripePeriodEnd(stripeSub) {
  const seconds = stripeSub?.current_period_end || stripeSub?.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}

function periodEnd(billing) {
  const end = new Date();
  end.setUTCMonth(end.getUTCMonth() + (billing === 'annuel' ? 12 : 1));
  return end;
}

async function notifyPractitioner(sub, title, detail, key) {
  const p = await Practitioner.findById(sub.practitioner).lean();
  if (!p?.user) return;
  await notify(p.user, { key: key || `sub-${sub.id}-${sub.status}`, type: 'pro', title: 'Nissali Pro', body: title, detail, link: '/pro/abonnement' });
}

export default router;
