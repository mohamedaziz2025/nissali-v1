import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getCached } from './api';

/**
 * Lecture d'une ressource, rechargée à chaque retour sur l'écran et au retour de l'appli au premier plan
 * (le jour a pu changer : jour des règles, prières…), avec repli hors connexion.
 */
export function useApi(path, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path && enabled));
  const [offline, setOffline] = useState(false);
  const current = useRef(path);
  current.current = path;

  const load = useCallback(async () => {
    if (!path || !enabled) return;
    setLoading((l) => l || !data);
    try {
      const res = await getCached(path);
      if (current.current !== path) return;
      setData(res.data);
      setOffline(res.offline);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
      return () => sub.remove();
    }, [load]),
  );

  return { data, setData, error, loading, offline, reload: load };
}
