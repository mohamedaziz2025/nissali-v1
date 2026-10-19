// Cahier V3 : répétition des notes (5.2 bis), jeûnes volontaires (5.8), fréquence des notifications (5.12).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { occurrences, repeatLabel } from '../src/services/notes.js';
import { featureList } from '../src/services/marketplace.js';
import { nextVoluntary, suggestType } from '../src/services/voluntary.js';

test('note chaque lundi jusqu’au 31 décembre', () => {
  const n = { day: '2026-10-19', repeat: 'weekly', weekdays: [1], until: '2026-12-31', skips: ['2026-10-26'] };
  const days = occurrences(n, '2026-10-01', '2026-11-10');
  assert.deepEqual(days, ['2026-10-19', '2026-11-02', '2026-11-09']);
  assert.equal(repeatLabel(n), 'Chaque lundi');
});

test('note chaque mois le 31 : dernier jour des mois courts', () => {
  const days = occurrences({ day: '2026-01-31', repeat: 'monthly', skips: [] }, '2026-01-01', '2026-04-30');
  assert.deepEqual(days, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('note une fois, passée ou future, et date de fin respectée', () => {
  assert.deepEqual(occurrences({ day: '2026-10-28', repeat: 'once' }, '2026-10-19', '2026-12-01'), ['2026-10-28']);
  assert.deepEqual(occurrences({ day: '2026-10-01', repeat: 'daily', until: '2026-10-03' }, '2026-09-01', '2026-10-31'), ['2026-10-01', '2026-10-02', '2026-10-03']);
});

test('jeûne volontaire : type proposé selon la date', () => {
  assert.equal(suggestType('2026-10-24'), 'jours_blancs'); // 13 Joumada al-oula 1448
  assert.equal(suggestType('2026-10-19'), 'lundi_jeudi'); // lundi
  assert.equal(suggestType('2026-10-21'), 'autre'); // mercredi
});

test('jeûnes programmés en pause pendant les règles prévues (RG-33)', () => {
  const next = nextVoluntary({ weekdays: [1, 4], blancs: true }, { from: '2026-10-20', days: 10, periodOn: (d) => (d >= '2026-10-26' && d <= '2026-10-30' ? 'regles_prevues' : null) });
  assert.deepEqual(next.map((n) => [n.day, n.type, n.paused]), [
    ['2026-10-22', 'lundi_jeudi', false],
    ['2026-10-24', 'jours_blancs', false],
    ['2026-10-25', 'jours_blancs', false],
    ['2026-10-26', 'jours_blancs', true],
    ['2026-10-29', 'lundi_jeudi', true],
  ]);
});

test('fonctionnalités d’une formule en clair (essai gratuit)', () => {
  assert.deepEqual(featureList({ maxServices: 3, maxBookingsPerMonth: 0, video: true, crm: true, stats: false }), ['3 prestations', 'Rendez-vous illimités', 'Consultations en visio', 'Fiches clientes']);
});
