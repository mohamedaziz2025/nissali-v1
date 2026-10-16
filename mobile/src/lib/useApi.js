import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { getCached } from './api';

/** Lecture d'une ressource, rechargée à chaque retour sur l'écran, avec repli hors connexion. */
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
    }, [load]),
  );

  return { data, setData, error, loading, offline, reload: load };
}
