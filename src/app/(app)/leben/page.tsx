import Link from 'next/link';
import { PageTitle } from '@/components/ui';

const modules: Array<{ href: string; title: string; desc: string; ready: boolean }> = [
  { href: '/leben/dokumente', title: 'Dokumente', desc: 'Sicher ablegen, Nachweise, Ablaufdaten', ready: true },
  { href: '/leben/dokumente?ordner=manuals', title: 'Bedienungsanleitungen', desc: 'Handbücher und Anleitungen deiner Geräte', ready: true },
  { href: '/leben/vertraege', title: 'Verträge & Kündigungen', desc: 'Fristen, Entwürfe, Freigaben', ready: true },
  { href: '/leben/dubai', title: 'Dubai', desc: 'Umzug und Wohnung', ready: true },
  { href: '/leben/finanzen', title: 'Finanzen', desc: 'Konten, Rechnungen, Prognose', ready: false },
  { href: '/kalender', title: 'Kalender', desc: 'Woche mit Reitern Mo–So', ready: true },
  { href: '/aufgaben', title: 'Alle Aufgaben', desc: 'Vollständige Liste', ready: true },
  { href: '/leben/einstellungen', title: 'Einstellungen', desc: 'Ruhezeiten, Erinnerungen, Daten', ready: true },
];

export default function LifePage() {
  return (
    <div>
      <PageTitle title="Leben" />
      <ul className="grid gap-2">
        {modules.map((m) => (
          <li key={m.href}>
            <Link href={m.href} className="card flex items-center justify-between gap-3">
              <span><span className="block text-lg font-semibold">{m.title}</span><span className="text-sm text-muted">{m.desc}</span></span>
              {!m.ready && <span className="chip chip-detected">im Aufbau</span>}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">Gesundheit, Fahrzeug, Reisen, Firma und Kontakte erscheinen hier, sobald sie gebraucht werden.</p>
    </div>
  );
}
