import { toLocalParts, zonedToUtc } from './time';

/**
 * Werder-Spiele: Spielplan, Form, Vorschau-Text und wann welche Erinnerung fällig ist.
 * Rein und ohne Netz – Daten kommen von OpenLigaDB (src/server/football.ts).
 */

export const WERDER_ID = 134;

export interface OldbTeam { teamId: number; teamName: string; shortName?: string | null }
export interface OldbResult { resultTypeID: number; pointsTeam1: number; pointsTeam2: number }
export interface OldbMatch {
  matchID: number;
  matchDateTimeUTC: string;
  leagueShortcut: string;
  leagueName?: string | null;
  group?: { groupName?: string | null } | null;
  team1: OldbTeam;
  team2: OldbTeam;
  matchIsFinished: boolean;
  matchResults?: OldbResult[] | null;
  location?: { locationCity?: string | null; locationStadium?: string | null } | null;
}
export interface OldbTableRow { teamInfoId: number; teamName: string; points: number; matches: number; goals: number; opposingGoals: number; goalDiff?: number }

export interface Match {
  id: number;
  kickoff: Date;
  league: string;          // bl1 | bl2 | dfb | …
  competition: string;     // „Bundesliga“, „DFB-Pokal“
  round: string | null;    // „8. Spieltag“, „Achtelfinale“
  home: OldbTeam;
  away: OldbTeam;
  werderHome: boolean;
  opponent: OldbTeam;
  finished: boolean;
  score: { home: number; away: number } | null;
  location: OldbMatch['location'];
}

const COMPETITION: Record<string, string> = { bl1: 'Bundesliga', bl2: '2. Bundesliga', dfb: 'DFB-Pokal' };

export function finalScore(m: Pick<OldbMatch, 'matchResults'>): { home: number; away: number } | null {
  const rs = m.matchResults ?? [];
  const end = rs.find((r) => r.resultTypeID === 2) ?? [...rs].sort((a, b) => b.resultTypeID - a.resultTypeID)[0];
  return end ? { home: end.pointsTeam1, away: end.pointsTeam2 } : null;
}

export function toMatch(m: OldbMatch, teamId = WERDER_ID): Match | null {
  const werderHome = m.team1.teamId === teamId;
  if (!werderHome && m.team2.teamId !== teamId) return null;
  const kickoff = new Date(m.matchDateTimeUTC.endsWith('Z') ? m.matchDateTimeUTC : `${m.matchDateTimeUTC}Z`);
  if (Number.isNaN(kickoff.getTime())) return null;
  return {
    id: m.matchID, kickoff, league: m.leagueShortcut, competition: COMPETITION[m.leagueShortcut] ?? m.leagueName ?? m.leagueShortcut,
    round: m.group?.groupName ?? null, home: m.team1, away: m.team2, werderHome, opponent: werderHome ? m.team2 : m.team1,
    finished: m.matchIsFinished, score: m.matchIsFinished ? finalScore(m) : null, location: m.location ?? null,
  };
}

/** Saison-Startjahr nach deutscher Zählweise (Saison 2026/27 → 2026) */
export const seasonOf = (d: Date) => (d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);

/** Letzte n Ergebnisse eines Teams aus seiner Sicht: S/U/N, neuestes zuerst */
export function form(all: OldbMatch[], teamId: number, before: Date, n = 5): string[] {
  return all
    .filter((m) => m.matchIsFinished && (m.team1.teamId === teamId || m.team2.teamId === teamId) && new Date(m.matchDateTimeUTC) < before)
    .sort((a, b) => +new Date(b.matchDateTimeUTC) - +new Date(a.matchDateTimeUTC))
    .slice(0, n)
    .map((m) => {
      const s = finalScore(m);
      if (!s) return '?';
      const [own, other] = m.team1.teamId === teamId ? [s.home, s.away] : [s.away, s.home];
      return own > other ? 'S' : own < other ? 'N' : 'U';
    });
}

const fmt = (d: Date, tz: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, ...opts }).format(d);
const time = (d: Date, tz: string) => fmt(d, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateLong = (d: Date, tz: string) => fmt(d, tz, { weekday: 'long', day: '2-digit', month: '2-digit' });

export const matchTitle = (m: Match) => `${m.home.teamName} – ${m.away.teamName}`;

export function resultLine(m: Match): string | null {
  if (!m.score) return null;
  const [own, other] = m.werderHome ? [m.score.home, m.score.away] : [m.score.away, m.score.home];
  const verdict = own > other ? 'Sieg' : own < other ? 'Niederlage' : 'Unentschieden';
  return `${verdict}: ${m.home.teamName} ${m.score.home}:${m.score.away} ${m.away.teamName}`;
}

/** Vorschau-Nachricht: wann (Dubai + Deutschland), wo, Wettbewerb, Tabelle, Form, Hinspiel */
export function previewText(m: Match, ctx: { tz: string; table?: OldbTableRow[]; all?: OldbMatch[] }): string {
  const lines: string[] = [];
  lines.push(`${m.competition}${m.round ? `, ${m.round}` : ''} · ${m.werderHome ? 'Heimspiel' : 'Auswärtsspiel'}`);
  lines.push(`Anstoß: ${dateLong(m.kickoff, ctx.tz)}, ${time(m.kickoff, ctx.tz)} Uhr Dubai (${time(m.kickoff, 'Europe/Berlin')} Uhr in Deutschland)`);
  const venue = [m.werderHome ? 'Weserstadion, Bremen' : null, m.location?.locationStadium, m.location?.locationCity].filter(Boolean)[0];
  if (venue) lines.push(`Ort: ${venue}`);
  if (ctx.table?.length) {
    const pos = (id: number) => { const i = ctx.table!.findIndex((r) => r.teamInfoId === id); return i < 0 ? null : { pos: i + 1, row: ctx.table![i] }; };
    const w = pos(WERDER_ID), o = pos(m.opponent.teamId);
    if (w && o) lines.push(`Tabelle: Werder ${w.pos}. (${w.row.points} Pkt.) · ${m.opponent.teamName} ${o.pos}. (${o.row.points} Pkt.)`);
  }
  if (ctx.all?.length) {
    const fw = form(ctx.all, WERDER_ID, m.kickoff), fo = form(ctx.all, m.opponent.teamId, m.kickoff);
    if (fw.length) lines.push(`Form (letzte ${fw.length}, neuestes zuerst): Werder ${fw.join(' ')}${fo.length ? ` · ${m.opponent.shortName || m.opponent.teamName} ${fo.join(' ')}` : ''}`);
    const first = ctx.all.map((x) => toMatch(x)).find((x) => x && x.id !== m.id && x.finished && x.league === m.league && x.opponent.teamId === m.opponent.teamId);
    if (first) lines.push(`Hinspiel: ${first.home.teamName} ${first.score?.home}:${first.score?.away} ${first.away.teamName}`);
  }
  return lines.join('\n');
}

export type MatchAlertStage = 'preview' | 'kickoff' | 'result';
export interface MatchAlert { stage: MatchAlertStage; key: string }

const H = 3600_000, MIN = 60_000;

/** Lokale Uhrzeit hh:00 am Spieltag (Zeitzone tz) als UTC */
function localHourOnDay(d: Date, hour: number, tz: string): Date {
  const p = toLocalParts(d, tz);
  return zonedToUtc(p.year, p.month, p.day, hour, 0, tz);
}

/**
 * Fällige Werder-Erinnerungen jetzt:
 * - Vorschau am Spieltag um previewHour (lokal), spätestens 2 h vor Anstoß
 * - Erinnerung 30 Min. vor Anstoß
 * - Ergebnis, sobald das Spiel beendet ist (bis 8 h nach Anstoß)
 */
export function matchAlertsDue(m: Match, now: Date, tz: string, previewHour = 13): MatchAlert[] {
  const out: MatchAlert[] = [];
  const t = now.getTime(), k = m.kickoff.getTime();
  const previewAt = Math.min(localHourOnDay(m.kickoff, previewHour, tz).getTime(), k - 2 * H);
  if (!m.finished && t >= previewAt && t < k - 30 * MIN) out.push({ stage: 'preview', key: `werder:${m.id}:preview` });
  if (!m.finished && t >= k - 30 * MIN && t < k) out.push({ stage: 'kickoff', key: `werder:${m.id}:kickoff` });
  if (m.finished && m.score && t >= k && t < k + 8 * H) out.push({ stage: 'result', key: `werder:${m.id}:result` });
  return out;
}
