'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DualClock } from './hud-clock';

const items = [
  { href: '/', label: 'Heute', icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.36-6.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: '/eingang', label: 'Eingang', icon: 'M4 13h4l2 3h4l2-3h4M5 5h14l1 8v6H4v-6l1-8Z' },
  { href: '/news', label: 'News', icon: 'M4 5h13v14H6a2 2 0 0 1-2-2V5Zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3' },
  { href: '/leben', label: 'Leben', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/jarvis', label: 'Jarvis', icon: 'M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Zm-7 9a7 7 0 0 0 14 0M12 19v2' },
];

const deskLinks = [
  { href: '/', label: 'Brücke' },
  { href: '/aufgaben', label: 'Aufgaben' },
  { href: '/kalender', label: 'Kalender' },
  { href: '/eingang', label: 'Eingang' },
  { href: '/leben/dokumente', label: 'Dokumente' },
  { href: '/leben/vertraege', label: 'Verträge' },
  { href: '/leben/dubai', label: 'Dubai' },
  { href: '/leben/finanzen', label: 'Geld' },
  { href: '/news', label: 'News' },
  { href: '/jarvis', label: 'Jarvis' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export interface Ambient { weather: string | null; fx: string | null; fxTitle?: string }

/** Kopfzeile wie eine Kommandobrücke: Marke, Uhren, Wetter, Kurs, Navigation (PC), Sicherheitsstatus. */
export function TopBar({ ambient }: { ambient: Ambient }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Jarvis – Brücke">
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="#3fd2ff" strokeWidth="1.2" />
            <circle cx="12" cy="12" r="6.5" fill="none" stroke="#3fd2ff" strokeOpacity=".5" strokeDasharray="2 2" />
            <circle cx="12" cy="12" r="2.6" fill="#8fe6ff" />
          </svg>
          <span className="leading-none">
            <span className="mono block text-[.85rem] font-semibold tracking-[.22em] text-sea glow sm:text-[.95rem] sm:tracking-[.38em]">J.A.R.V.I.S.</span>
            <span className="mono hidden text-[.58rem] tracking-[.25em] text-muted sm:block">MAINZ ⇄ DUBAI · COMMAND</span>
          </span>
        </Link>

        <div className="mono hidden flex-1 items-center justify-center gap-4 text-[.72rem] uppercase tracking-widest text-muted md:flex">
          <DualClock />
          {ambient.weather && <><span className="text-sea">◆</span><span className="text-ink">{ambient.weather}</span></>}
          {ambient.fx && <><span className="text-sea">◆</span><span title={ambient.fxTitle} className="text-ink">{ambient.fx}</span></>}
        </div>
        <DualClock className="mono ml-auto whitespace-nowrap text-[.62rem] text-muted md:hidden" />

        <nav aria-label="Bereiche" className="hidden xl:block">
          <ul className="flex gap-1">
            {deskLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}
                  className={`mono block border px-2 py-1 text-[.66rem] uppercase tracking-widest ${isActive(path, l.href) ? 'border-sea text-sea' : 'border-line text-muted hover:text-ink'}`}>
                  {l.label} ↗
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <span className="mono hidden items-center gap-1.5 text-[.66rem] uppercase tracking-widest text-good lg:flex" title="Angemeldet mit Authenticator (2FA)">
          <span className="blink inline-block h-2 w-2 rounded-full bg-good" /> gesichert
        </span>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur xl:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((it) => {
          const active = isActive(path, it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? 'page' : undefined}
                className={`mono flex min-h-16 flex-col items-center justify-center gap-1 text-[.68rem] font-semibold uppercase tracking-widest ${active ? 'text-sea glow' : 'text-muted'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Breite je Seite: Brücke nutzt den ganzen Bildschirm, alle anderen Seiten bleiben lesbar schmal. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const wide = path === '/';
  return (
    <main className={`mx-auto px-4 pb-40 pt-5 xl:pb-28 ${wide ? 'max-w-[1800px]' : 'max-w-3xl'}`}>{children}</main>
  );
}
