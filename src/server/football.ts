import 'server-only';
import type { CalExternal } from '@/lib/calendar';
import { matchTitle, seasonOf, toMatch, WERDER_ID, type Match, type OldbMatch, type OldbTableRow } from '@/lib/domain/football';

/** OpenLigaDB: frei, ohne Schlüssel. Bundesliga, 2. Liga und DFB-Pokal – Werder wird herausgefiltert. */
const BASE = 'https://api.openligadb.de';
const LEAGUES = ['bl1', 'bl2', 'dfb'] as const;

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' }, next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    console.error('[werder]', path, (e as Error).message);
    return null;
  }
}

export interface WerderData { matches: Match[]; all: OldbMatch[]; tables: Record<string, OldbTableRow[]> }

/** Spielplan der laufenden Saison. Rund um Spiele (live) kürzer gecacht, damit das Ergebnis zügig kommt. */
export async function loadWerder(now = new Date(), live = false): Promise<WerderData> {
  const season = seasonOf(now);
  const ttl = live ? 120 : 1800;
  const lists = await Promise.all(LEAGUES.map((l) => getJson<OldbMatch[]>(`/getmatchdata/${l}/${season}`, ttl)));
  const byLeague: Record<string, OldbMatch[]> = {};
  LEAGUES.forEach((l, i) => { byLeague[l] = Array.isArray(lists[i]) ? lists[i]! : []; });
  const matches: Match[] = [];
  for (const l of LEAGUES) for (const m of byLeague[l]) { const x = toMatch(m); if (x) matches.push(x); }
  matches.sort((a, b) => +a.kickoff - +b.kickoff);
  // Tabelle nur für die Liga, in der Werder spielt
  const tables: Record<string, OldbTableRow[]> = {};
  const league = matches.find((m) => m.league === 'bl1' || m.league === 'bl2')?.league;
  if (league) tables[league] = (await getJson<OldbTableRow[]>(`/getbltable/${league}/${season}`, ttl)) ?? [];
  // Für Form/Hinspiel: alle Spiele der eigenen Liga plus Werders Pokalspiele
  const all = [...(league ? byLeague[league] : []), ...byLeague.dfb.filter((m) => m.team1.teamId === WERDER_ID || m.team2.teamId === WERDER_ID)];
  return { matches, all, tables };
}

/** Werder-Spiele als Kalendereinträge (Spieldauer ~2 h) */
export async function werderEvents(from: Date, to: Date): Promise<CalExternal[]> {
  const { matches } = await loadWerder();
  return matches.filter((m) => m.kickoff >= from && m.kickoff <= to).map((m) => ({
    uid: `werder-${m.id}`,
    title: `⚽ ${matchTitle(m)}${m.score ? ` ${m.score.home}:${m.score.away}` : ''}`,
    start: m.kickoff, end: new Date(m.kickoff.getTime() + 2 * 3600_000), allDay: false,
    location: m.werderHome ? 'Weserstadion, Bremen' : (m.location?.locationStadium ?? null),
    source: `Werder · ${m.competition}`,
  }));
}
