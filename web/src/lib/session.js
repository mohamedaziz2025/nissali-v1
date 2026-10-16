'use client';
import { useRouter } from 'next/navigation';
import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, practitioner: null });
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setState({ status: 'ready', user: r.user, practitioner: r.practitioner });
      return r;
    } catch {
      setState({ status: 'anon', user: null, practitioner: null });
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback((payload) => setState({ status: 'ready', user: payload.user, practitioner: payload.practitioner }), []);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setState({ status: 'anon', user: null, practitioner: null });
    router.replace('/connexion');
  }, [router]);

  return createElement(SessionContext.Provider, { value: { ...state, refresh, signIn, signOut } }, children);
}

export const useSession = () => useContext(SessionContext);
