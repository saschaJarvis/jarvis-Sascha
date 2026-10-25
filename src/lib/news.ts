import { XMLParser } from 'fast-xml-parser';

/**
 * News: Themen und Quellen. Gelesen werden nur öffentliche Feeds (RSS/Atom); angezeigt werden
 * Schlagzeile, kurzer Anriss und Link zur Originalseite – keine ganzen Artikel.
 */

export interface NewsSource {
  key: string;
  name: string;
  domain: string;           // für das Logo (Favicon der Quelle)
  feeds: string[];          // Kandidaten, der erste funktionierende gewinnt
  youtubeHandle?: string;   // YouTube: Kanal über @Handle auflösen
  match?: RegExp;           // optional: nur Beiträge, die passen
  perItemLogo?: boolean;    // gemischte Quelle (Google News): Logo je Artikel vom jeweiligen Verlag
}
export interface NewsTopic { key: string; name: string; emoji: string; logo?: string; sources: NewsSource[] }

const gnews = (q: string, lang: 'de' | 'en' = 'de') => lang === 'de'
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=de&gl=DE&ceid=DE:de`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AE&gl=AE&ceid=AE:en`;

export const TOPICS: NewsTopic[] = [
  {
    key: 'werder', name: 'Werder Bremen', emoji: '💚', logo: 'werder',
    sources: [
      { key: 'kicker', name: 'kicker', domain: 'kicker.de', feeds: [gnews('"Werder" site:kicker.de when:14d')] },
      { key: 'transfermarkt', name: 'Transfermarkt', domain: 'transfermarkt.de', feeds: [gnews('Werder site:transfermarkt.de when:30d')] },
      { key: 'bild', name: 'BILD', domain: 'bild.de', feeds: [gnews('Werder site:www.bild.de when:14d')] },
      { key: 'sportbild', name: 'SPORT BILD', domain: 'sportbild.bild.de', feeds: [gnews('Werder site:sportbild.bild.de when:30d')] },
      { key: 'youtube', name: 'YouTube', domain: 'youtube.com', feeds: [], youtubeHandle: 'werderbremen' },
    ],
  },
  {
    key: 'dubai', name: 'Dubai', emoji: '🏙️',
    sources: [
      { key: 'dubai-de', name: 'Deutsch', domain: 'news.google.com', perItemLogo: true, feeds: [gnews('Dubai OR VAE OR "Vereinigte Arabische Emirate" when:3d')] },
      { key: 'gulfnews', name: 'Gulf News', domain: 'gulfnews.com', feeds: [gnews('Dubai site:gulfnews.com when:3d', 'en')] },
      { key: 'khaleej', name: 'Khaleej Times', domain: 'khaleejtimes.com', feeds: [gnews('Dubai site:khaleejtimes.com when:3d', 'en')] },
      { key: 'thenational', name: 'The National', domain: 'thenationalnews.com', feeds: [gnews('Dubai site:thenationalnews.com when:3d', 'en')] },
    ],
  },
  {
    key: 'immobilien', name: 'Dubai Islands & Immobilien', emoji: '🏝️',
    sources: [
      { key: 'dubai-islands', name: 'Dubai Islands', domain: 'news.google.com', perItemLogo: true, feeds: [gnews('"Dubai Islands" when:60d', 'en')] },
      { key: 'imtiaz', name: 'Imtiaz', domain: 'news.google.com', perItemLogo: true, feeds: [gnews('"Imtiaz Developments" OR "Imtiaz" Beachwalk OR "Imtiaz" Dubai property when:90d', 'en')] },
      { key: 'markt-en', name: 'Markt (EN)', domain: 'news.google.com', perItemLogo: true, feeds: [gnews('Dubai property market OR "Dubai real estate" when:7d', 'en')] },
      { key: 'markt-de', name: 'Markt (DE)', domain: 'news.google.com', perItemLogo: true, feeds: [gnews('Dubai Immobilien OR Immobilienmarkt Dubai when:30d')] },
    ],
  },
  {
    key: 'bundesliga', name: 'Bundesliga', emoji: '⚽',
    sources: [
      { key: 'bl-kicker', name: 'kicker', domain: 'kicker.de', feeds: [gnews('Bundesliga site:kicker.de when:3d')] },
      { key: 'sportschau', name: 'Sportschau', domain: 'sportschau.de', feeds: [gnews('Bundesliga site:sportschau.de when:7d')] },
      { key: 'bl-transfermarkt', name: 'Transfermarkt', domain: 'transfermarkt.de', feeds: [gnews('Bundesliga site:transfermarkt.de when:7d')] },
      { key: 'bl-youtube', name: 'YouTube', domain: 'youtube.com', feeds: [], youtubeHandle: 'bundesliga' },
    ],
  },
];

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  date: Date | null;
  snippet: string | null;
  sourceKey: string;
  publisher: string | null; // Name laut Feed
  thumb: string | null;     // nur YouTube (i.ytimg.com)
  publisherDomain: string | null; // Verlag laut Feed (für Logo bei gemischten Quellen)
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true });
const text = (v: unknown): string => (typeof v === 'string' ? v : v && typeof v === 'object' && '#text' in v ? String((v as Record<string, unknown>)['#text']) : v == null ? '' : String(v));
const arr = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (t: string) => t.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, e: string) => ENT[e]);
const strip = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** RSS 2.0 und Atom (YouTube) einlesen */
export function parseFeed(xml: string, sourceKey: string): NewsItem[] {
  const doc = parser.parse(xml) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (doc.rss) {
    return arr(doc.rss.channel?.item).map((it: Record<string, unknown>) => {
      const publisher = text(it.source) || null;
      const srcUrl = it.source && typeof it.source === 'object' ? String((it.source as Record<string, unknown>)['@url'] ?? '') : '';
      let publisherDomain: string | null = null;
      try { publisherDomain = srcUrl ? new URL(srcUrl).hostname.replace(/^www\./, '') : null; } catch { /* ohne Logo */ }
      let title = strip(text(it.title));
      if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3));
      const desc = strip(text(it.description));
      const snippet = desc && !desc.startsWith(title.slice(0, 30)) ? desc.slice(0, 220) : null;
      const link = text(it.link);
      const d = text(it.pubDate);
      return { id: text(it.guid) || link, title, link, date: d ? new Date(d) : null, snippet, sourceKey, publisher, thumb: null, publisherDomain };
    });
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((e: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const vid = text(e['yt:videoId']);
      const link = arr(e.link).map((l: Record<string, string>) => l['@href']).find(Boolean) ?? `https://www.youtube.com/watch?v=${vid}`;
      const desc = text(e['media:group']?.['media:description']);
      return {
        id: text(e.id) || link, title: strip(text(e.title)), link, date: e.published ? new Date(text(e.published)) : null,
        snippet: desc ? strip(desc).slice(0, 220) : null, sourceKey, publisher: text(e.author?.name) || null,
        thumb: vid && /^[\w-]{6,20}$/.test(vid) ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : null,
        publisherDomain: 'youtube.com',
      };
    });
  }
  return [];
}

/** Gleiche Meldung (gleicher Titel) nur einmal, neueste zuerst */
export function mergeNews(lists: NewsItem[][], max = 120): NewsItem[] {
  const seen = new Set<string>();
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '').slice(0, 60);
  return lists.flat()
    .filter((i) => i.title && /^https:\/\//.test(i.link))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .filter((i) => { const k = key(i.title); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}

export function timeAgo(d: Date | null, now = new Date()): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  const m = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const days = Math.round(h / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

/** Gültiger Hostname für das Logo eines Verlags (nur Buchstaben, Ziffern, Punkte, Bindestriche) */
export const isDomain = (d: string) => /^(?=.{3,100}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d);
