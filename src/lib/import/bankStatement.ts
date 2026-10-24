/**
 * Kontoauszug-Import über konfigurierbare Spaltenzuordnung (generischer Adapter für deutsche Banken).
 * Bekannte Profile sind Vorlagen und müssen mit echten Exporten verifiziert werden (Feature-Matrix: MOCKED bis getestet).
 * Unlesbare Zeilen werden NICHT verworfen, sondern als "unknown" mit Grund gemeldet.
 */
import { parseCsv, parseDate } from './csv';
import { parseAmount } from '../domain/money';

export interface ColumnMapping {
  /** Kopfzeilen-Namen (case-insensitive, Teilstring) */
  bookingDate: string[];
  valueDate?: string[];
  amount?: string[];               // ein Betragsfeld mit Vorzeichen
  debit?: string[];                // alternativ: Soll/Haben getrennt
  credit?: string[];
  currency?: string[];
  counterparty?: string[];
  purpose?: string[];
  externalId?: string[];
}

export interface AdapterProfile {
  id: string;
  label: string;
  verified: boolean;               // false = Vorlage, noch nicht mit echtem Export geprüft
  amountLocale: 'de' | 'en' | 'auto';
  defaultCurrency: string;
  columns: ColumnMapping;
}

export const PROFILES: Record<string, AdapterProfile> = {
  generic_de: {
    id: 'generic_de', label: 'Generisch (deutsche Bank, CSV)', verified: false, amountLocale: 'de', defaultCurrency: 'EUR',
    columns: {
      bookingDate: ['buchungstag', 'buchungsdatum', 'datum', 'booking date'],
      valueDate: ['valuta', 'wertstellung'],
      amount: ['betrag', 'umsatz', 'amount'],
      debit: ['soll', 'belastung'],
      credit: ['haben', 'gutschrift'],
      currency: ['währung', 'waehrung', 'currency'],
      counterparty: ['beguenstigter', 'begünstigter', 'zahlungsempfänger', 'name zahlungsbeteiligter', 'auftraggeber', 'empfänger', 'counterparty'],
      purpose: ['verwendungszweck', 'buchungstext', 'purpose', 'beschreibung'],
      externalId: ['referenz', 'transaktions-id', 'transaction id', 'end-to-end'],
    },
  },
};

export interface ParsedTxnRow {
  sourceRow: number;
  bookingDate: string;
  valueDate: string | null;
  amountMinor: bigint;
  currency: string;
  counterparty: string | null;
  purpose: string | null;
  externalId: string | null;
}

export interface ImportResult {
  rows: ParsedTxnRow[];
  unknown: Array<{ sourceRow: number; reason: string; raw: string[] }>;
  headerLine: number;
  profile: AdapterProfile;
}

function findHeader(rows: { line: number; cells: string[] }[], mapping: ColumnMapping): number {
  // Banken schreiben oft Vorspann-Zeilen (Kontoinhaber, Zeitraum). Erste Zeile mit Datum- UND Betragsspalte nehmen.
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const lower = rows[i].cells.map((c) => c.trim().toLowerCase());
    const hasDate = mapping.bookingDate.some((n) => lower.some((c) => c.includes(n)));
    const hasAmt = [...(mapping.amount ?? []), ...(mapping.debit ?? []), ...(mapping.credit ?? [])].some((n) => lower.some((c) => c.includes(n)));
    if (hasDate && hasAmt) return i;
  }
  throw new Error('Kopfzeile nicht gefunden – bitte Spalten zuordnen');
}

function col(header: string[], names: string[] | undefined, taken: Set<number>): number {
  if (!names) return -1;
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const exact = lower.findIndex((h, i) => h === n && !taken.has(i));
    if (exact >= 0) { taken.add(exact); return exact; }
  }
  for (const n of names) {
    const idx = lower.findIndex((h, i) => h.includes(n) && !taken.has(i));
    if (idx >= 0) { taken.add(idx); return idx; }
  }
  return -1;
}

export function importBankCsv(text: string, profile: AdapterProfile = PROFILES.generic_de): ImportResult {
  const all = parseCsv(text);
  const h = findHeader(all, profile.columns);
  const header = all[h].cells;
  const taken = new Set<number>();
  const c = profile.columns;
  const idx = {
    bookingDate: col(header, c.bookingDate, taken),
    valueDate: col(header, c.valueDate, taken),
    debit: col(header, c.debit, taken),
    credit: col(header, c.credit, taken),
    amount: col(header, c.amount, taken),
    currency: col(header, c.currency, taken),
    counterparty: col(header, c.counterparty, taken),
    purpose: col(header, c.purpose, taken),
    externalId: col(header, c.externalId, taken),
  };
  if (idx.bookingDate < 0 || (idx.amount < 0 && idx.debit < 0 && idx.credit < 0)) {
    throw new Error('Pflichtspalten (Datum, Betrag) fehlen');
  }
  const rows: ParsedTxnRow[] = [];
  const unknown: ImportResult['unknown'] = [];
  for (const r of all.slice(h + 1)) {
    const get = (i: number) => (i >= 0 ? (r.cells[i] ?? '').trim() : '');
    try {
      if (r.cells.length < 2) throw new Error('zu wenige Spalten');
      const currency = (get(idx.currency) || profile.defaultCurrency).toUpperCase();
      let amountMinor: bigint;
      if (idx.amount >= 0 && get(idx.amount)) {
        amountMinor = parseAmount(get(idx.amount), currency, profile.amountLocale).minor;
      } else {
        const debit = get(idx.debit); const credit = get(idx.credit);
        if (!debit && !credit) throw new Error('kein Betrag');
        const dm = debit ? parseAmount(debit, currency, profile.amountLocale).minor : 0n;
        const cm = credit ? parseAmount(credit, currency, profile.amountLocale).minor : 0n;
        amountMinor = cm - (dm < 0n ? -dm : dm);
      }
      rows.push({
        sourceRow: r.line,
        bookingDate: parseDate(get(idx.bookingDate)),
        valueDate: get(idx.valueDate) ? parseDate(get(idx.valueDate)) : null,
        amountMinor,
        currency,
        counterparty: get(idx.counterparty) || null,
        purpose: get(idx.purpose) || null,
        externalId: get(idx.externalId) || null,
      });
    } catch (e) {
      unknown.push({ sourceRow: r.line, reason: (e as Error).message, raw: r.cells });
    }
  }
  return { rows, unknown, headerLine: all[h].line, profile };
}
