'use client';
import Shell from '@/components/Shell';
import { useFetch } from '@/lib/useFetch';

export default function ProLayout({ children }) {
  const { data } = useFetch('/pro/me');
  const unread = useFetch('/messages/unread');
  return (
    <Shell area="pro" badges={{ '/pro/reservations': data?.counts?.pending || 0, '/pro/messages': unread.data?.pro || 0 }}>
      {children}
    </Shell>
  );
}
