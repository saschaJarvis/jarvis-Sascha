import Link from 'next/link';

export function Certainty({ value }: { value: 'detected' | 'inferred' | 'verified' | string | null | undefined }) {
  if (!value) return <span className="chip chip-detected">unbekannt</span>;
  const map: Record<string, [string, string]> = {
    verified: ['chip-verified', 'bestätigt'],
    inferred: ['chip-inferred', 'vermutet'],
    detected: ['chip-detected', 'erkannt'],
  };
  const [cls, label] = map[value] ?? ['chip-detected', value];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function PageTitle({ eyebrow, title, back }: { eyebrow?: string; title: string; back?: { href: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && <Link href={back.href} className="btn-quiet -ml-3 mb-1 inline-flex items-center">‹ {back.label}</Link>}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight">{title}</h1>
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between"><h2 className="eyebrow">{title}</h2>{aside}</div>
      {children}
    </section>
  );
}

const dtf = (tz: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, ...opts });

export function formatDue(d: Date | string | null, tz: string, now = new Date()): string | null {
  if (!d) return null;
  const date = new Date(d);
  const dayKey = (x: Date) => dtf(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const diffDays = Math.round((Date.parse(dayKey(date).split('.').reverse().join('-')) - Date.parse(dayKey(now).split('.').reverse().join('-'))) / 86_400_000);
  const time = dtf(tz, { hour: '2-digit', minute: '2-digit' }).format(date);
  if (diffDays < 0) return `überfällig seit ${dtf(tz, { day: 'numeric', month: 'long' }).format(date)}`;
  if (diffDays === 0) return `heute, ${time}`;
  if (diffDays === 1) return `morgen, ${time}`;
  if (diffDays < 7) return `${dtf(tz, { weekday: 'long' }).format(date)}, ${time}`;
  return dtf(tz, { day: 'numeric', month: 'long', year: diffDays > 300 ? 'numeric' : undefined }).format(date);
}

export function formatDateTime(d: Date | string, tz: string): string {
  return dtf(tz, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}
