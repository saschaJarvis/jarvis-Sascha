import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { loadTopic } from '@/server/news';
import { mergeNews, TOPICS, timeAgo } from '@/lib/news';

export const revalidate = 0;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ thema?: string; quelle?: string }> }) {
  await requireUser();
  const { thema, quelle } = await searchParams;
  const { topic, items, sources } = await loadTopic(thema ?? TOPICS[0].key);
  const active = sources.find((s) => s.source.key === quelle)?.source.key ?? null;
  // Mit Filter: alle Meldungen dieser Quelle (nicht nur die, die es in die gemeinsamen Top 120 geschafft haben)
  const shown = active ? mergeNews([sources.find((x) => x.source.key === active)!.items]) : items;
  const byKey = Object.fromEntries(sources.map((s) => [s.source.key, s]));
  const now = new Date();
  const href = (q: string | null) => `/news?thema=${topic.key}${q ? `&quelle=${q}` : ''}`;

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3">
        {topic.logo
          ? <img src={`/api/logo/${topic.logo}`} alt="" width={36} height={36} className="h-9 w-9 rounded-md bg-white/90 p-1" />
          : <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-xl" aria-hidden="true">{topic.emoji}</span>}
        <div>
          <p className="eyebrow">News</p>
          <h1 className="text-[1.6rem] font-bold leading-tight">{topic.name}</h1>
        </div>
      </header>

      {TOPICS.length > 1 && (
        <nav aria-label="Themen" className="-mx-4 flex gap-1 overflow-x-auto px-4">
          {TOPICS.map((t) => (
            <Link key={t.key} href={`/news?thema=${t.key}`} className={`mono shrink-0 border px-3 py-1.5 text-[.7rem] uppercase tracking-widest ${t.key === topic.key ? 'border-sea text-sea' : 'border-line text-muted'}`}>{t.emoji} {t.name}</Link>
          ))}
        </nav>
      )}

      <nav aria-label="Quellen" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Link href={href(null)} className={`mono flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[.68rem] uppercase tracking-widest ${!active ? 'border-sea bg-sea-soft text-sea' : 'border-line text-muted'}`}>
          Alle <span className="text-muted">{items.length}</span>
        </Link>
        {sources.map((s) => (
          <Link key={s.source.key} href={href(s.source.key)} aria-current={active === s.source.key ? 'page' : undefined}
            className={`mono flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[.68rem] uppercase tracking-widest ${active === s.source.key ? 'border-sea bg-sea-soft text-sea' : 'border-line text-muted'}`}>
            {s.source.perItemLogo ? <span aria-hidden="true">🔎</span> : <img src={`/api/logo/${s.source.key}`} alt="" width={16} height={16} className="h-4 w-4 rounded-sm bg-white p-px" />}
            {s.source.name} <span className={s.error ? 'text-bad' : 'text-muted'}>{s.error ? '!' : s.items.length}</span>
          </Link>
        ))}
      </nav>

      {sources.filter((s) => s.error).length > 0 && (
        <p className="notice notice-warn text-sm">Gerade nicht erreichbar: {sources.filter((s) => s.error).map((s) => s.source.name).join(', ')}. Jarvis versucht es in ein paar Minuten erneut.</p>
      )}

      {shown.length === 0 ? (
        <p className="card text-center text-muted">Keine aktuellen Meldungen.</p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((n) => {
            const src = byKey[n.sourceKey]?.source;
            return (
              <li key={`${n.sourceKey}-${n.id}`}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="card flex gap-3 hover:border-sea/60">
                  {n.thumb && <img src={n.thumb} alt="" width={128} height={72} loading="lazy" className="h-[72px] w-[128px] shrink-0 rounded-sm object-cover" />}
                  <span className="min-w-0 flex-1">
                    <span className="mono mb-1 flex items-center gap-1.5 text-[.62rem] uppercase tracking-widest text-muted">
                      <img src={src?.perItemLogo && n.publisherDomain ? `/api/logo/d:${encodeURIComponent(n.publisherDomain)}` : `/api/logo/${n.sourceKey}`} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm bg-white p-px" />
                      <span className="text-sea">{src?.perItemLogo ? (n.publisher ?? src.name) : (src?.name ?? n.publisher)}</span>
                      {n.date && <span suppressHydrationWarning>· {timeAgo(n.date, now)}</span>}
                    </span>
                    <span className="block font-semibold leading-snug">{n.title}</span>
                    {n.snippet && <span className="mt-1 line-clamp-2 block text-sm text-muted">{n.snippet}</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">Schlagzeilen aus öffentlichen Feeds (Zeitungen über Google News, Videos direkt von YouTube). Tippen öffnet den Artikel auf der Originalseite. Aktualisierung alle ~15 Minuten. 🔎 = Suche über viele Medien, Logo je Artikel.</p>
    </div>
  );
}
