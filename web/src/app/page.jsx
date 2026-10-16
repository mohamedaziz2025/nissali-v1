'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Home() {
  const { status, user, practitioner } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anon') router.replace('/connexion');
    else if (user?.role === 'admin') router.replace('/admin');
    else if (practitioner) router.replace('/pro');
    else router.replace('/inscription');
  }, [status, user, practitioner, router]);
  return (
    <main className="auth-main">
      <Loading />
    </main>
  );
}
