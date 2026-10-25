'use client';
import { useEffect, useState } from 'react';

const fmt = (tz: string, d: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);

/** Live-Uhren Dubai + Deutschland (aktualisiert jede 20 s). */
export function DualClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`hud-num ${className}`} suppressHydrationWarning>
      DXB <b className="text-ink">{fmt('Asia/Dubai', now)}</b>
      <span className="mx-2 text-sea">◆</span>
      DE <b className="text-ink">{fmt('Europe/Berlin', now)}</b>
    </span>
  );
}
