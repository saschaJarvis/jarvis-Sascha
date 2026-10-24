/**
 * Transaktions-Dublettenerkennung und Umbuchungs-Erkennung (deterministisch, nachvollziehbar).
 * Nichts wird gelöscht: Dubletten werden markiert (duplicateOf), Provenienz (Datei, Zeile) bleibt erhalten.
 */

export interface Txn {
  id: string;
  accountId: string;
  importFileId: string | null;
  sourceRow: number | null;
  bookingDate: string;      // YYYY-MM-DD
  amountMinor: bigint;      // negativ = Abgang
  currency: string;
  counterparty?: string | null;
  purpose?: string | null;
  externalId?: string | null;
}

export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Basis-Schlüssel ohne Vorkommensindex. Bankseitige externe ID hat Vorrang (stabil über Exporte).
 * Verwendungszweck wird gekürzt, weil Banken ihn in verschiedenen Exporten unterschiedlich abschneiden.
 */
export function baseKey(t: Txn): string {
  if (t.externalId && t.externalId.trim()) return `ext|${t.accountId}|${t.externalId.trim()}`;
  return ['row', t.accountId, t.bookingDate, t.amountMinor.toString(), t.currency.toUpperCase(),
    normalizeText(t.counterparty).slice(0, 40), normalizeText(t.purpose).slice(0, 40)].join('|');
}

/**
 * Vergibt pro Importdatei laufende Vorkommensnummern für identische Zeilen
 * (zwei echte Kaffees à 3,50 € am selben Tag sind KEINE Dublette innerhalb einer Datei).
 */
export function dedupKeys(txns: readonly Txn[]): Map<string, string> {
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  const ordered = [...txns].sort((a, b) =>
    (a.importFileId ?? '').localeCompare(b.importFileId ?? '') || (a.sourceRow ?? 0) - (b.sourceRow ?? 0) || a.id.localeCompare(b.id));
  for (const t of ordered) {
    const base = baseKey(t);
    const fileScope = `${t.importFileId ?? 'manual'}|${base}`;
    const n = (counters.get(fileScope) ?? 0) + 1;
    counters.set(fileScope, n);
    out.set(t.id, base.startsWith('ext|') ? base : `${base}#${n}`);
  }
  return out;
}

export interface DedupResult {
  /** id -> id des Originals (erstes Vorkommen nach Importreihenfolge) */
  duplicateOf: Map<string, string>;
  keys: Map<string, string>;
}

/** Ermittelt Dubletten über mehrere Importe hinweg. Reihenfolge: früherer Import = Original. */
export function findDuplicates(txns: readonly Txn[], importOrder: readonly string[]): DedupResult {
  const keys = dedupKeys(txns);
  const rank = (t: Txn) => {
    const i = t.importFileId ? importOrder.indexOf(t.importFileId) : -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...txns].sort((a, b) => rank(a) - rank(b) || (a.sourceRow ?? 0) - (b.sourceRow ?? 0) || a.id.localeCompare(b.id));
  const firstByKey = new Map<string, string>();
  const duplicateOf = new Map<string, string>();
  for (const t of sorted) {
    const k = keys.get(t.id)!;
    const first = firstByKey.get(k);
    if (first) duplicateOf.set(t.id, first); else firstByKey.set(k, t.id);
  }
  return { duplicateOf, keys };
}

export interface TransferPair { outId: string; inId: string; daysApart: number }

/**
 * Umbuchungen zwischen eigenen Konten: gleicher Betrag mit umgekehrtem Vorzeichen, gleiche Währung,
 * verschiedene Konten, Buchungsdatum max. maxDays auseinander. Gierig, deterministisch, jede Buchung höchstens einmal.
 * Ergebnis ist ein VORSCHLAG (certainty = inferred), Nutzer kann korrigieren.
 */
export function detectTransfers(txns: readonly Txn[], ownAccountIds: ReadonlySet<string>, maxDays = 3, exclude: ReadonlySet<string> = new Set()): TransferPair[] {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const eligible = txns.filter((t) => ownAccountIds.has(t.accountId) && !exclude.has(t.id) && t.amountMinor !== 0n);
  const outs = eligible.filter((t) => t.amountMinor < 0n).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.id.localeCompare(b.id));
  const ins = eligible.filter((t) => t.amountMinor > 0n);
  const used = new Set<string>();
  const pairs: TransferPair[] = [];
  for (const o of outs) {
    const candidates = ins
      .filter((i) => !used.has(i.id) && i.accountId !== o.accountId && i.currency === o.currency && i.amountMinor === -o.amountMinor)
      .map((i) => ({ i, d: Math.abs(day(i.bookingDate) - day(o.bookingDate)) }))
      .filter((c) => c.d <= maxDays)
      .sort((a, b) => a.d - b.d || a.i.id.localeCompare(b.i.id));
    const best = candidates[0];
    if (best) {
      used.add(best.i.id);
      pairs.push({ outId: o.id, inId: best.i.id, daysApart: best.d });
    }
  }
  return pairs;
}

export interface RecurringCandidate {
  key: string;
  counterparty: string;
  amountMinor: bigint;
  currency: string;
  intervalDays: number;
  occurrences: number;
  lastDate: string;
  nextExpected: string;
}

/** Wiederkehrende Abbuchungen (Abos, Miete) erkennen: gleiche Gegenpartei, ähnlicher Betrag (±5 %), regelmäßiger Abstand. */
export function detectRecurring(txns: readonly Txn[], minOccurrences = 3): RecurringCandidate[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.amountMinor >= 0n) continue;
    const cp = normalizeText(t.counterparty);
    if (!cp) continue;
    const k = `${t.accountId}|${cp}|${t.currency}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  const result: RecurringCandidate[] = [];
  for (const [k, list] of groups) {
    const sorted = [...list].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
    if (sorted.length < minOccurrences) continue;
    const ref = sorted[sorted.length - 1].amountMinor;
    const similar = sorted.filter((t) => {
      const diff = t.amountMinor - ref; const abs = diff < 0n ? -diff : diff;
      const r = ref < 0n ? -ref : ref;
      return abs * 100n <= r * 5n;
    });
    if (similar.length < minOccurrences) continue;
    const days = similar.map((t) => Date.parse(`${t.bookingDate}T00:00:00Z`) / 86_400_000);
    const gaps = days.slice(1).map((d, i) => d - days[i]);
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const regular = gaps.every((g) => Math.abs(g - median) <= Math.max(3, median * 0.15));
    if (!regular || median < 6) continue;
    const last = similar[similar.length - 1];
    const next = new Date((days[days.length - 1] + median) * 86_400_000).toISOString().slice(0, 10);
    result.push({
      key: k, counterparty: last.counterparty ?? '', amountMinor: last.amountMinor, currency: last.currency,
      intervalDays: median, occurrences: similar.length, lastDate: last.bookingDate, nextExpected: next,
    });
  }
  return result.sort((a, b) => a.nextExpected.localeCompare(b.nextExpected));
}
