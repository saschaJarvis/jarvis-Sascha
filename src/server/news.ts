import 'server-only';
import { after } from 'next/server';
import { toGerman, translatorAvailable } from './translate';
import { mergeNews, parseFeed, TOPICS, type NewsItem, type NewsSource, type NewsTopic } from '@/lib/news';

/**
 * Feeds abrufen (Server, 15 Min. Zwischenspeicher). Nur feste, bekannte Adressen – keine Nutzereingaben.
 */
const ALLOWED_HOSTS = new Set(['news.google.com', 'www.youtube.com']);
const MAX_BYTES = 3 * 1024 * 1024;
const fake = () => process.env.NEWS_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase';

async function get(url: string, revalidate = 900): Promise<string> {
  const u = new URL(url);
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error('Quelle nicht erlaubt');
  const r = await fetch(url, {
    headers: { 'accept-language': 'de-DE,de;q=0.9', 'user-agent': 'Mozilla/5.0 (Jarvis News; persönlicher Feed-Leser)' },
    next: { revalidate }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  if (t.length > MAX_BYTES) throw new Error('zu groß');
  return t;
}

/** YouTube-Kanal-ID über das @Handle ermitteln (1 Tag zwischengespeichert) */
async function youtubeFeed(handle: string): Promise<string> {
  const html = await get(`https://www.youtube.com/@${encodeURIComponent(handle)}`, 86_400);
  const id = html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/)?.[1] ?? html.match(/channel\/(UC[\w-]{22})/)?.[1];
  if (!id) throw new Error('Kanal nicht gefunden');
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
}

export interface SourceResult { source: NewsSource; items: NewsItem[]; error?: string }

async function loadSource(src: NewsSource): Promise<SourceResult> {
  if (fake()) return { source: src, items: parseFeed(fakeFeed(src), src.key) };
  const candidates = src.youtubeHandle ? [await youtubeFeed(src.youtubeHandle).catch(() => '')].filter(Boolean) : src.feeds;
  let lastErr = src.youtubeHandle ? 'Kanal nicht gefunden' : 'kein Feed';
  for (const url of candidates) {
    try {
      const items = parseFeed(await get(url), src.key).filter((i) => !src.match || src.match.test(i.title));
      return { source: src, items };
    } catch (e) { lastErr = (e as Error).message; }
  }
  console.error('[news]', src.key, lastErr);
  return { source: src, items: [], error: lastErr };
}

export async function loadTopic(topicKey: string): Promise<{ topic: NewsTopic; items: NewsItem[]; sources: SourceResult[] }> {
  const topic = TOPICS.find((t) => t.key === topicKey) ?? TOPICS[0];
  const sources = await Promise.all(topic.sources.map(loadSource));
  await translateEnglish(topic, sources);
  return { topic, items: mergeNews(sources.map((s) => s.items)), sources };
}

function fakeFeed(src: NewsSource): string {
  const now = Date.now();
  if (src.key === 'youtube') {
    return `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<entry><id>yt:video:abc123DEF45</id><yt:videoId>abc123DEF45</yt:videoId><title>Testvideo: Training am Osterdeich</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc123DEF45"/><author><name>SV Werder Bremen</name></author><published>${new Date(now - 3 * 3600e3).toISOString()}</published><media:group><media:description>Einblicke ins Training.</media:description></media:group></entry></feed>`;
  }
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>
<item><title>Test-Schlagzeile ${src.name}: Werder gewinnt - ${src.name}</title><link>https://news.google.com/rss/articles/test-${src.key}</link><guid>${src.key}-1</guid><pubDate>${new Date(now - 2 * 3600e3).toUTCString()}</pubDate><description>&lt;a href="x"&gt;Test-Schlagzeile ${src.name}: Werder gewinnt&lt;/a&gt;</description><source url="https://${src.domain}">${src.name}</source></item>
</channel></rss>`;
}

/**
 * Englische Quellen ins Deutsche übersetzen. Gespeicherte Übersetzungen sofort; fehlende höchstens ~4,5 s abwarten,
 * danach im Hintergrund fertig übersetzen (beim nächsten Öffnen deutsch).
 */
async function translateEnglish(topic: NewsTopic, sources: SourceResult[]): Promise<void> {
  const en = sources.filter((s) => s.source.lang === 'en').flatMap((s) => s.items.slice(0, 60));
  if (en.length === 0) return;
  const texts = en.flatMap((i) => [i.title, ...(i.snippet ? [i.snippet] : [])]);
  let map = await toGerman(texts, { translateMissing: false }).catch(() => new Map<string, string>());
  const missing = texts.filter((t) => !map.has(t.trim()));
  if (missing.length && translatorAvailable()) {
    const job = toGerman(missing).catch(() => new Map<string, string>());
    const done = await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), 4500))]);
    if (done) map = new Map([...map, ...done]);
    else { try { after(() => job.then(() => undefined)); } catch { /* außerhalb einer Anfrage */ } }
  }
  for (const i of en) {
    const de = map.get(i.title.trim());
    if (de && de !== i.title) { i.originalTitle = i.title; i.title = de; }
    if (i.snippet) i.snippet = map.get(i.snippet.trim()) ?? i.snippet;
  }
  void topic;
}
