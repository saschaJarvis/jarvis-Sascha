/**
 * Aus einem hochgeladenen Vertragsdokument (Vertrag, Vertragsseite, Mietanpassung, Kündigungsbestätigung …)
 * einen Eintrag unter „Verträge“ anlegen oder einen bestehenden ergänzen.
 * Rein und ohne DB – damit testbar.
 */

export const CONTRACT_CATEGORIES = ['residential_lease', 'commercial_lease', 'storage', 'telecom', 'energy', 'insurance',
  'subscription', 'banking', 'membership', 'vehicle', 'other'] as const;
export type ContractCategory = (typeof CONTRACT_CATEGORIES)[number];

export interface ContractFacts {
  /** Kurzer Name, z. B. „Lagerhalle Curiestr. 18, Mainz“ oder „Telekom Festnetz“ */
  name: string;
  category: ContractCategory;
  counterparty_name?: string | null;
  counterparty_address?: string | null;
  contract_number?: string | null;
  start_date?: string | null;
  notice_period_text?: string | null;
  required_form?: 'schriftform' | 'textform' | 'online_button' | 'unknown' | null;
  /** Aktuell geltender regelmäßiger Betrag (nicht eine künftige Erhöhung) */
  amount?: number | null;
  currency?: string | null;
  billing_interval?: 'monthly' | 'quarterly' | 'yearly' | 'one_off' | 'unknown' | null;
  deposit?: number | null;
}

export interface ExistingContract {
  id: string;
  name: string;
  category: string;
  counterparty_name: string | null;
  contract_number: string | null;
  is_demo: boolean;
}

const STOP = new Set(['gmbh', 'gbr', 'egbr', 'llc', 'ag', 'kg', 'ug', 'mbh', 'co', 'und', 'the', 'self', 'mainz', 'dubai', 'vertrag', 'mietvertrag']);

/** Kleinbuchstaben, Umlaute aufgelöst, nur Wörter ≥ 2 Zeichen ohne Füllwörter */
export function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/str(asse|aße|\.)/g, 'str ')
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Hausnummer-genaue Adresse („curiestr 18“) – trennt Büro (16) und Lager (18) beim selben Vermieter */
export function streetKey(s: string | null | undefined): string | null {
  const t = tokens(s);
  for (let i = 0; i < t.length - 1; i++) {
    if (/[a-z]{3,}/.test(t[i]) && /^\d{1,4}[a-z]?$/.test(t[i + 1])) return `${t[i]} ${t[i + 1]}`;
  }
  return null;
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  return a.filter((x) => sb.has(x)).length / Math.min(a.length, b.length);
}

/**
 * Gehört das Dokument zu einem schon erfassten Vertrag?
 * Reihenfolge: gleiche Vertragsnummer → gleiche Adresse (Straße + Nr.) → sehr ähnlicher Name bzw. Vertragspartner.
 * Beispielverträge werden nie verknüpft. Zwei verschiedene Adressen schließen einen Treffer aus.
 */
export function matchContract(existing: ExistingContract[], f: ContractFacts): string | null {
  const real = existing.filter((c) => !c.is_demo);
  const num = f.contract_number?.trim().toLowerCase();
  if (num) {
    const hit = real.find((c) => c.contract_number?.trim().toLowerCase() === num);
    if (hit) return hit.id;
  }
  const street = streetKey(f.name);
  if (street) {
    const hit = real.find((c) => streetKey(c.name) === street);
    if (hit) return hit.id;
  }
  const nameT = tokens(f.name);
  const partyT = tokens(f.counterparty_name);
  let best: { id: string; score: number } | null = null;
  for (const c of real) {
    const otherStreet = streetKey(c.name);
    if (street && otherStreet && street !== otherStreet) continue;
    const byName = overlap(nameT, tokens(c.name));
    const byParty = overlap(partyT, tokens(c.counterparty_name));
    // Vertragspartner allein reicht nur, wenn auch die Art passt (ein Vermieter kann mehrere Objekte haben → oben per Adresse getrennt)
    const score = Math.max(byName, c.category === f.category ? byParty * 0.9 : 0);
    if (score >= 0.75 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

const toMinor = (n: number | null | undefined) => (n == null || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100));
const cur = (c: string | null | undefined) => (c && /^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : null);

/** Spalten für einen neuen Vertrag. Betrag nur mit Währung (DB-Regel). */
export function contractColumns(f: ContractFacts): Record<string, string | number | null> {
  const amount = toMinor(f.amount);
  const currency = cur(f.currency);
  const both = amount != null && currency != null;
  const notice = f.notice_period_text?.trim() || null;
  return {
    name: f.name.trim().slice(0, 200),
    category: f.category,
    counterparty_name: f.counterparty_name?.trim() || null,
    counterparty_address: f.counterparty_address?.trim() || null,
    contract_number: f.contract_number?.trim() || null,
    start_date: f.start_date && /^\d{4}-\d{2}-\d{2}$/.test(f.start_date) ? f.start_date : null,
    notice_period_text: notice,
    notice_period_certainty: notice ? 'detected' : null,
    required_form: f.required_form ?? null,
    amount_minor: both ? amount : null,
    currency: both ? currency : null,
    billing_interval: both ? (f.billing_interval ?? 'unknown') : (f.billing_interval ?? null),
    deposit_minor: currency ? toMinor(f.deposit) : null,
  };
}

/**
 * Beim Ergänzen nur leere Felder füllen – was schon drinsteht (z. B. von Sascha bestätigt), bleibt unangetastet.
 * Name und Art werden nie überschrieben.
 */
export const FILL_ONLY_IF_EMPTY = ['counterparty_name', 'counterparty_address', 'contract_number', 'start_date',
  'notice_period_text', 'notice_period_certainty', 'required_form', 'billing_interval'] as const;
