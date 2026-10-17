// Webhook Stripe de bout en bout (base MongoDB en mémoire, appels Stripe simulés) :
// signature, activation d'un paiement et remplacement de formule (une seule formule payante à la fois).
// Les clés Stripe sont posées avant l'import des modules, qui lisent l'environnement au chargement.
process.env.STRIPE_SECRET_KEY ??= 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_secret';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

// Base en mémoire indisponible (binaire mongod absent, machine hors ligne) : le fichier est
// ignoré au lieu de mettre toute la suite en échec.
let mongo = null;
try {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
} catch (err) {
  console.warn('mongodb-memory-server indisponible, tests du webhook Stripe ignorés :', err.message);
}
const t = mongo ? test : test.skip;

const { Subscription } = await import('../src/models/index.js');
const { default: stripeRoutes } = await import('../src/routes/stripe.js');

const app = express();
app.use('/api/stripe', stripeRoutes);
const server = app.listen(0);
const webhookUrl = `http://127.0.0.1:${server.address().port}/api/stripe/webhook`;

// Appels sortants vers Stripe simulés : aucun accès réseau, et on peut vérifier ce qui est demandé.
const stripeCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  stripeCalls.push({ url: String(url), method: options.method || 'GET', body: String(options.body || '') });
  const body = options.method === 'GET' ? { id: 'sub_nouveau', status: 'active', current_period_end: PERIOD_END } : { id: 'sub_ancien', cancel_at_period_end: true };
  return { ok: true, status: 200, json: async () => body };
};

after(async () => {
  globalThis.fetch = realFetch;
  server.close();
  if (mongo) {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

function signedPost(event) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${payload}`).digest('hex');
  return realFetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
    body: payload,
  });
}

/** Une praticienne avec une formule payante en cours et une nouvelle demande en attente. */
async function fixture() {
  const practitioner = new mongoose.Types.ObjectId();
  const ancien = await Subscription.create({ practitioner, plan: 'essentiel', amount: 19, status: 'active', endsAt: new Date(Date.now() + 86400_000), stripeSubscriptionId: 'sub_ancien' });
  const nouveau = await Subscription.create({ practitioner, plan: 'premium', amount: 39, status: 'en_attente', paymentReference: 'NIS-AAA' });
  return { ancien, nouveau };
}

t('signature absente ou invalide : 400 et aucun effet', async () => {
  const res = await realFetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"checkout.session.completed"}' });
  assert.equal(res.status, 400);
});

t('checkout.session.completed : active la formule et résilie l’abonnement Stripe précédent', async () => {
  const { ancien, nouveau } = await fixture();
  stripeCalls.length = 0;
  const res = await signedPost({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', payment_status: 'paid', subscription: 'sub_nouveau', customer: 'cus_1', payment_intent: 'pi_1', metadata: { subscriptionId: String(nouveau._id) } } },
  });
  assert.equal(res.status, 200);

  const active = await Subscription.findById(nouveau._id);
  assert.equal(active.status, 'active');
  assert.equal(active.stripeSubscriptionId, 'sub_nouveau');
  assert.equal(Math.round(active.endsAt.getTime() / 1000), PERIOD_END);
  // Pas de double facturation : l'autre formule de la praticienne est annulée…
  assert.equal((await Subscription.findById(ancien._id)).status, 'annulee');
  // …et son abonnement Stripe est bien résilié en fin de période.
  const cancel = stripeCalls.find((c) => c.url.endsWith('/subscriptions/sub_ancien'));
  assert.ok(cancel, 'l’abonnement Stripe précédent doit être résilié');
  assert.match(cancel.body, /cancel_at_period_end=true/);
});

t('invoice.paid : renouvellement reconnu avec la forme d’API récente (parent.subscription_details)', async () => {
  const practitioner = new mongoose.Types.ObjectId();
  const sub = await Subscription.create({ practitioner, plan: 'premium', amount: 39, status: 'active', stripeSubscriptionId: 'sub_nouveau' });
  stripeCalls.length = 0;
  const res = await signedPost({ id: 'evt_2', type: 'invoice.paid', data: { object: { id: 'in_1', parent: { subscription_details: { subscription: 'sub_nouveau' } } } } });
  assert.equal(res.status, 200);
  assert.deepEqual(stripeCalls.map((c) => c.method), ['GET'], 'l’abonnement Stripe doit être relu pour la nouvelle période');
  assert.equal((await Subscription.findById(sub._id)).status, 'active');
});

t('invoice.paid tardif : ne réactive pas une formule remplacée', async () => {
  const practitioner = new mongoose.Types.ObjectId();
  const sub = await Subscription.create({ practitioner, plan: 'essentiel', amount: 19, status: 'annulee', stripeSubscriptionId: 'sub_ancien' });
  stripeCalls.length = 0;
  // Forme d'API ancienne (invoice.subscription) : la facture du renouvellement peut arriver après le remplacement.
  const res = await signedPost({ id: 'evt_3', type: 'invoice.paid', data: { object: { id: 'in_2', subscription: 'sub_ancien' } } });
  assert.equal(res.status, 200);
  assert.equal(stripeCalls.length, 0, 'aucun appel Stripe pour un abonnement déjà annulé');
  assert.equal((await Subscription.findById(sub._id)).status, 'annulee');
});
