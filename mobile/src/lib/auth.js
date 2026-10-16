// Session : une seule connexion pour l'espace personnel et l'espace pro.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { api, flushOutbox, onUnauthorized } from './api';
import { clearCache, getToken, readJson, setToken, writeJson } from './storage';
import { registerPushToken } from './notifications';

const AuthContext = createContext(null);
const SESSION_KEY = 'nissali.session';

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | anon | ready
  const [session, setSession] = useState(null); // { user, practitioner }
  const [transition, setTransition] = useState(null); // espace en cours d'ouverture (animation)

  const apply = useCallback(async (payload) => {
    setSession(payload);
    await writeJson(SESSION_KEY, payload);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api.get('/auth/me');
      await apply(payload);
      setStatus('ready');
      return payload;
    } catch (err) {
      if (err.status === 0) {
        // hors connexion : on garde la dernière session connue
        const cached = await readJson(SESSION_KEY);
        if (cached) {
          setSession(cached);
          setStatus('ready');
          return cached;
        }
      }
      if (err.status === 401) {
        await setToken(null);
        setSession(null);
        setStatus('anon');
      }
      return null;
    }
  }, [apply]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return setStatus('anon');
      const me = await refresh();
      flushOutbox().catch(() => {});
      // Notifications push (annonces de l'équipe, messages) ; relais par le centre de notifications sinon.
      if (me) registerPushToken().catch(() => {});
    })();
    onUnauthorized(async () => {
      await setToken(null);
      setSession(null);
      setStatus('anon');
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      flushOutbox().catch(() => {});
      getToken().then((t) => t && refresh());
    });
    return () => sub.remove();
  }, [refresh]);

  const signIn = useCallback(
    async (payload) => {
      if (payload.token) await setToken(payload.token);
      await apply({ user: payload.user, practitioner: payload.practitioner });
      registerPushToken().catch(() => {});
      setStatus('ready');
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // déconnexion locale même sans réseau
    }
    await setToken(null);
    await clearCache();
    setSession(null);
    setStatus('anon');
    router.replace('/bienvenue');
  }, []);

  /**
   * Bascule espace personnel ↔ espace pro, sans se déconnecter.
   * Instantanée (même hors connexion) : l'écran change tout de suite, le serveur est prévenu ensuite.
   */
  const switchSpace = useCallback(
    async (space) => {
      if (!session?.user) return;
      setTransition(space);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await apply({ ...session, user: { ...session.user, lastSpace: space } });
      setTimeout(() => router.replace(space === 'pro' ? '/pro' : '/'), 120);
      setTimeout(() => setTransition(null), 750);
      api
        .put('/me/space', { space })
        .then((payload) => apply(payload))
        .catch(() => {});
    },
    [apply, session],
  );

  const value = useMemo(
    () => ({ status, session, user: session?.user, practitioner: session?.practitioner, signIn, signOut, refresh, setSession: apply, switchSpace, transition }),
    [status, session, signIn, signOut, refresh, apply, switchSpace, transition],
  );
  return createElement(AuthContext.Provider, { value }, children);
}

export const useAuth = () => useContext(AuthContext);
