'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Lädt die Serverdaten regelmäßig neu – nur solange die Seite sichtbar ist (spart Akku und Abfragen). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!t) t = setInterval(() => router.refresh(), seconds * 1000); };
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    const onVis = () => (document.visibilityState === 'visible' ? (router.refresh(), start()) : stop());
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [router, seconds]);
  return null;
}
