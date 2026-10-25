import { base58check } from './btc';

/**
 * Ganze Konten über den erweiterten ÖFFENTLICHEN Schlüssel (xpub/ypub/zpub/Ltub/Mtub) – nur ansehen.
 * Damit lassen sich alle Empfangs- und Wechselgeld-Adressen eines Kontos ableiten, aber nichts versenden.
 * Gespeichert wird ein Blockbook-Descriptor, z. B. „sh(wpkh(xpub…))“.
 * Ledger Live exportiert Bitcoin-Konten immer als „xpub“ und Litecoin als „Ltub“ – die Kontoart steht nur in der id
 * („js:2:bitcoin:xpub…:segwit“), deshalb wird der JSON-Export bevorzugt ausgewertet.
 */
export type AccountCoin = 'btc' | 'ltc' | 'zec';
export type Scheme = 'sh(wpkh)' | 'wpkh' | 'pkh' | 'tr';

const VERSIONS: Record<string, string> = { '0488b21e': 'xpub', '049d7cb2': 'ypub', '04b24746': 'zpub', '019da462': 'Ltub', '01b26ef6': 'Mtub' };
const KEY_RE = /^(xpub|ypub|zpub|Ltub|Mtub)[1-9A-HJ-NP-Za-km-z]{100,112}$/;

export function isExtendedKey(x: string): boolean {
  const a = x.trim();
  if (!KEY_RE.test(a)) return false;
  const raw = base58check(a, 82);
  return !!raw && VERSIONS[raw.subarray(0, 4).toString('hex')] === a.slice(0, 4);
}

export const descriptorOf = (key: string, scheme: Scheme) => (scheme === 'sh(wpkh)' ? `sh(wpkh(${key}))` : `${scheme}(${key})`);
export const isDescriptor = (s: string) => /^(sh\(wpkh\(|wpkh\(|pkh\(|tr\()(xpub|ypub|zpub|Ltub|Mtub)[1-9A-HJ-NP-Za-km-z]{100,112}\)\)?$/.test(s);
/** Nur der Schlüssel aus einem Descriptor (für Anzeige) */
export const keyOfDescriptor = (d: string) => d.replace(/^(sh\(wpkh|wpkh|pkh|tr)\(|\)+$/g, '');

const LEDGER_COIN: Record<string, AccountCoin> = { bitcoin: 'btc', litecoin: 'ltc', zcash: 'zec' };

export type ParsedKey = { coin: AccountCoin; key: string; scheme: Scheme | 'auto' };

/**
 * Eingabe auswerten: Ledger-Live-Export (JSON) oder nackter Schlüssel.
 * null = kein Kontoschlüssel (weiter als normale Adresse prüfen).
 */
export function parseAccountKey(input: string): ParsedKey | { error: string } | null {
  let key = input.trim();
  let coin: AccountCoin | null = null;
  let scheme: Scheme | 'auto' | null = null;
  if (key.startsWith('{')) {
    let j: { xpub?: unknown; id?: unknown };
    try { j = JSON.parse(key); } catch { return { error: 'Der eingefügte Text ist kein gültiger Ledger-Export.' }; }
    if (typeof j.xpub !== 'string') return { error: 'Im Ledger-Export fehlt der Kontoschlüssel („xpub“).' };
    key = j.xpub.trim();
    const id = typeof j.id === 'string' ? j.id : '';
    const m = /^js:\d+:([a-z_]+):[^:]+:?([a-z_]*)$/.exec(id);
    if (m) {
      coin = LEDGER_COIN[m[1]] ?? null;
      if (!coin) return { error: `Konten dieser Art (${m[1]}) kann Jarvis noch nicht als Ganzes lesen – bitte die öffentliche Adresse eingeben.` };
      scheme = m[2] === 'native_segwit' ? 'wpkh' : m[2] === 'segwit' ? 'sh(wpkh)' : m[2] === 'taproot' ? 'tr' : 'pkh';
    }
  }
  if (!KEY_RE.test(key)) return input.trim().startsWith('{') ? { error: 'Der Kontoschlüssel im Export wird nicht erkannt.' } : null;
  if (!isExtendedKey(key)) return { error: 'Der Kontoschlüssel ist nicht gültig (Prüfsumme stimmt nicht) – bitte vollständig aus Ledger Live kopieren.' };
  const p = key.slice(0, 4);
  coin ??= p === 'Ltub' || p === 'Mtub' ? 'ltc' : 'btc';
  scheme ??= p === 'ypub' || p === 'Mtub' ? 'sh(wpkh)' : p === 'zpub' ? 'wpkh' : p === 'Ltub' ? 'sh(wpkh)' : 'auto'; // nacktes xpub: Kontoart wird beim Abruf ermittelt
  return { coin, key, scheme };
}
