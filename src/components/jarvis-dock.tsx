'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { JarvisChat } from '@/app/(app)/jarvis/chat';

/**
 * Jarvis-Knopf unten rechts auf jeder Seite: öffnet den Chat mit Claude als Panel und hört sofort zu.
 * Der Verlauf bleibt erhalten, solange die App offen ist (auch beim Seitenwechsel).
 */
export function JarvisDock({ available, consented }: { available: boolean; consented: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [listen, setListen] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { setOpen(false); }, [path]);

  if (!available || path.startsWith('/jarvis')) return null;

  return (
    <>
      {!open && (
        <button type="button" onClick={() => { setOpen(true); setListen((n) => n + 1); }}
          aria-label="Mit Jarvis sprechen" title="Mit Jarvis sprechen"
          className="jarvis-fab fixed right-4 z-30 grid h-16 w-16 place-items-center rounded-full border border-sea text-glow"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" />
          </svg>
        </button>
      )}
      {/* Panel bleibt eingehängt, damit der Gesprächsverlauf erhalten bleibt */}
      <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none invisible'}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-paper/70 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mit Jarvis sprechen"
          className={`absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-xl overflow-y-auto border-t border-sea bg-paper p-3 outline-none transition-transform duration-300 xl:bottom-6 xl:right-6 xl:left-auto xl:w-[30rem] xl:border ${open ? 'translate-y-0' : 'translate-y-full xl:translate-y-[120%]'}`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + .75rem)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="mono text-[.7rem] font-semibold uppercase tracking-[.25em] text-sea glow">◉ Jarvis · Claude</span>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet" aria-label="Schließen">✕</button>
          </div>
          <JarvisChat consented={consented} listenSignal={listen} id="ask-dock" />
        </div>
      </div>
    </>
  );
}
