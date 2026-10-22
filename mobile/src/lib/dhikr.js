// 5.7 bis — Comptage du dhikr hors connexion (RG-40) : chaque appui met à jour le total local du jour ;
// l'envoi au serveur est groupé (dernier total de chaque dhikr) et repart au retour du réseau.
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { readJson, writeJson } from './storage';
import { useApi } from './useApi';

const PENDING = 'nissali.dhikrPending';
let pending = null;
let timer = null;
let flushing = null;

async function load() {
  if (!pending) pending = await readJson(PENDING, {});
  return pending;
}

/** Totaux encore à envoyer pour une journée : { clé: total }. */
export async function pendingCounts(day) {
  const p = await load();
  const out = {};
  for (const [k, count] of Object.entries(p)) {
    const [d, key] = k.split('|');
    if (d === day) out[key] = count;
  }
  return out;
}

export async function saveCount(day, key, count) {
  const p = await load();
  p[`${day}|${key}`] = count;
  await writeJson(PENDING, p);
  clearTimeout(timer);
  timer = setTimeout(() => flushDhikr().catch(() => {}), 1200);
}

export async function flushDhikr() {
  if (flushing) return flushing;
  flushing = (async () => {
    const p = await load();
    for (const [k, count] of Object.entries({ ...p })) {
      const [day, key] = k.split('|');
      try {
        await api.put('/dhikr/count', { day, key, count });
        if (p[k] === count) delete p[k];
      } catch (e) {
        if (e.status === 0) break; // toujours hors ligne : on garde tout
        delete p[k]; // refusé (journée trop ancienne…) : abandonné
      }
    }
    await writeJson(PENDING, p);
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
}

AppState.addEventListener('change', (s) => s === 'active' && flushDhikr().catch(() => {}));

/** Dhikr du jour : réponse du serveur + comptages encore à envoyer (hors connexion). */
export function useDhikrData() {
  const res = useApi('/dhikr');
  const [local, setLocal] = useState({});
  const day = res.data?.day;
  const refreshLocal = useCallback(() => {
    if (day) pendingCounts(day).then(setLocal).catch(() => {});
  }, [day]);
  useEffect(() => {
    refreshLocal();
    flushDhikr().catch(() => {});
  }, [refreshLocal, res.data]);
  return { ...res, counts: { ...(res.data?.counts || {}), ...local }, refreshLocal };
}

/** Objectif 0 = « Sans objectif » : on compte librement, jamais « atteint ». */
export const hasGoal = (goal) => goal > 0;
export const isReached = (count, goal) => hasGoal(goal) && count >= goal;
/** Remplissage de l'anneau : selon l'objectif, ou un tour tous les 33 sans objectif. */
export const ringProgress = (count, goal) => (hasGoal(goal) ? count / goal : (count % 33) / 33);

export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
