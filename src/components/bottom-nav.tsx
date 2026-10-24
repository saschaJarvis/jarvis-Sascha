'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Heute', icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.36-6.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: '/eingang', label: 'Eingang', icon: 'M4 13h4l2 3h4l2-3h4M5 5h14l1 8v6H4v-6l1-8Z' },
  { href: '/leben', label: 'Leben', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/jarvis', label: 'Jarvis', icon: 'M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Zm-7 9a7 7 0 0 0 14 0M12 19v2' },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map((it) => {
          const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold ${active ? 'text-sea' : 'text-muted'}`}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
