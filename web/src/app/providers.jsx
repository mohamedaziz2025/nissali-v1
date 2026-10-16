'use client';
import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/lib/session';

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
