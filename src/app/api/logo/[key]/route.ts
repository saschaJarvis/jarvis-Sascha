import { NextResponse } from 'next/server';
import { TOPICS } from '@/lib/news';

/**
 * Logos der Nachrichtenquellen = deren eigene Website-Icons (Favicons), über den Server geladen
 * (Inhalts-Sicherheitsrichtlinie erlaubt nur Bilder von Jarvis selbst). Nur feste Quellen, keine freien Adressen.
 */
const DOMAINS: Record<string, string> = Object.fromEntries([
  ...TOPICS.flatMap((t) => t.sources.map((s) => [s.key, s.domain] as const)),
  ['werder', 'werder.de'],
]);

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const domain = DOMAINS[key];
  if (!domain) return new NextResponse('unbekannt', { status: 404 });
  const tries = [`https://www.google.com/s2/favicons?domain=${domain}&sz=64`, `https://${domain}/favicon.ico`];
  for (const url of tries) {
    try {
      const r = await fetch(url, { next: { revalidate: 7 * 86_400 }, signal: AbortSignal.timeout(5000) });
      const type = r.headers.get('content-type') ?? '';
      if (!r.ok || !/^image\//.test(type)) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 200_000) continue;
      return new NextResponse(buf, { headers: { 'content-type': type, 'cache-control': 'public, max-age=604800, immutable', 'x-content-type-options': 'nosniff' } });
    } catch { /* nächster Versuch */ }
  }
  // Ersatz: neutrales Zeichen mit Anfangsbuchstaben (kein fremdes Logo nachgebaut)
  const letter = (domain[0] ?? '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a2638"/><text x="16" y="22" font-family="monospace" font-size="17" text-anchor="middle" fill="#3fd2ff">${letter}</text></svg>`;
  return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
}
