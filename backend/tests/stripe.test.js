// Paiement en ligne des abonnements praticiennes : signature du webhook Stripe et corps de requête.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { mapStripeStatus, stripeForm, verifyStripeSignature } from '../src/services/stripe.js';

test('stripeForm — notation x-www-form-urlencoded imbriquée de Stripe', () => {
  const body = stripeForm({
    mode: 'subscription',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: 1900, recurring: { interval: 'month' } } }],
    metadata: { planKey: 'essentiel' },
    allow_promotion_codes: true,
    empty: null,
  }).toString();
  assert.equal(
    body,
    'mode=subscription' +
      '&line_items%5B0%5D%5Bquantity%5D=1' +
      '&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=eur' +
      '&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1900' +
      '&line_items%5B0%5D%5Bprice_data%5D%5Brecurring%5D%5Binterval%5D=month' +
      '&metadata%5BplanKey%5D=essentiel' +
      '&allow_promotion_codes=true',
  );
});

test('verifyStripeSignature — accepte une signature valide et rejette le reste', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = (t) => crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');

  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${sign(timestamp)}`, secret), true);
  // Signature forgée (même longueur, mauvais contenu).
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${'a'.repeat(64)}`, secret), false);
  // Horodatage trop ancien : rejeu refusé.
  assert.equal(verifyStripeSignature(payload, `t=${timestamp - 10_000},v1=${sign(timestamp - 10_000)}`, secret), false);
  // En-tête absent ou secret manquant.
  assert.equal(verifyStripeSignature(payload, '', secret), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${sign(timestamp)}`, ''), false);
});

test('mapStripeStatus — statuts Stripe vers statuts locaux', () => {
  assert.equal(mapStripeStatus('active'), 'active');
  assert.equal(mapStripeStatus('trialing'), 'active');
  assert.equal(mapStripeStatus('canceled'), 'annulee');
  assert.equal(mapStripeStatus('past_due'), 'en_attente');
  assert.equal(mapStripeStatus('unpaid'), 'en_attente');
});
