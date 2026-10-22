import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getCached, onDataChange } from './api';
import { today as serverToday } from './format';

/**
 * Lecture d'une ressource, rechargée à chaque retour sur l'écran, au retour de l'appli au premier plan, au
 * changement de jour (appli restée ouverte à minuit : jour des règles, prières…) et après une saisie du cycle
 * faite sur un autre écran ; avec repli hors connexion.
 */
export function useApi(path, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path && enabled));
  const [offline, setOffline] = useState(false);
  const current = useRef(path);
  useEffect(() => {
    current.current = path;
  }, [path]);
  // Numéro de la dernière requête : une réponse lente plus ancienne n'écrase jamais une réponse plus récente.
  const seq = useRef(0);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (!path || !enabled) return;
    const n = ++seq.current;
    if (!hasData.current) setLoading(true);
    try {
      const res = await getCached(path);
      if (current.current !== path || n !== seq.current) return;
      hasData.current = true;
      setData(res.data);
      setOffline(res.offline);
      setError(null);
    } catch (err) {
      if (n === seq.current) setError(err);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path, enabled]);

  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
      // Passage à minuit pendant que l'écran est affiché.
      let day = serverToday();
      const timer = setInterval(() => {
        const d = serverToday();
        if (d !== day) {
          day = d;
          load();
        }
      }, 60_000);
      return () => {
        sub.remove();
        clearInterval(timer);
      };
    }, [load]),
  );

  // Saisie faite ailleurs (règles, flux, grossesse…) : recharge même si l'écran est en arrière-plan.
  useEffect(() => (path && enabled ? onDataChange(path, () => load()) : undefined), [path, enabled, load]);

  return { data, setData, error, loading, offline, reload: load };
}
