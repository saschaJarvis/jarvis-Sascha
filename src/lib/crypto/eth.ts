import { keccak_256 } from '@noble/hashes/sha3';

/**
 * Ethereum – nur öffentliche Adresse (0x…). Damit lassen sich Bestände ansehen, aber nichts versenden.
 * EIP-55: Groß-/Kleinschreibung ist eine Prüfsumme; gemischte Schreibweise wird daher geprüft.
 */

export function toChecksumAddress(addr: string): string {
  const lower = addr.toLowerCase().replace(/^0x/, '');
  const hash = Buffer.from(keccak_256(lower)).toString('hex');
  return `0x${[...lower].map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join('')}`;
}

export function isEthAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return false;
  const body = a.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true; // ohne Prüfsumme geschrieben
  return toChecksumAddress(a) === a;
}

export function ethAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'Die Adresse ist nicht gültig (Prüfsumme der Groß-/Kleinschreibung stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  if (/^0x[0-9a-fA-F]{64}$/.test(a)) return '⚠️ Das ist zu lang für eine Adresse – es sieht aus wie ein PRIVATER SCHLÜSSEL. Nicht gespeichert. Bitte niemals irgendwo eingeben.';
  if (/^0x/.test(a)) return 'Eine Ethereum-Adresse hat genau 0x + 40 Zeichen.';
  if (/\.eth$/i.test(a)) return 'ENS-Namen (….eth) bitte als 0x-Adresse eingeben.';
  return null;
}

/**
 * Mitgezählte Tokens auf Ethereum. price: 'usd' = Stablecoin (1 Token ≈ 1 USD), sonst Kurs-Kürzel.
 * Vertragsadressen nur aus offiziellen Quellen; werden im Betriebscheck per symbol() gegengeprüft.
 */
export const ETH_TOKENS = [
  { symbol: 'USDT', contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, price: 'usd' },
  { symbol: 'USDC', contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, price: 'usd' },
  { symbol: 'QNT', contract: '0x4a220E6096B25EADb88358cb44068A3248254675', decimals: 18, price: 'qnt' },
] as const;

/** ABI-String aus eth_call (z. B. symbol()) dekodieren */
export function decodeAbiString(hex: string): string | null {
  const h = hex.replace(/^0x/, '');
  if (h.length < 128) return null;
  const len = parseInt(h.slice(64, 128), 16);
  if (!Number.isFinite(len) || len > 64) return null;
  return Buffer.from(h.slice(128, 128 + len * 2), 'hex').toString('utf8');
}

/** eth_call-Daten für balanceOf(address) */
export const balanceOfData = (owner: string) => `0x70a08231${owner.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;

/** Hex-Menge (wei/kleinste Einheit) → Zahl mit Dezimalstellen, ohne Genauigkeitsverlust bei großen Werten */
export function fromUnits(hex: string, decimals: number): number {
  const v = BigInt(hex === '0x' ? '0x0' : hex);
  const base = 10n ** BigInt(decimals);
  return Number(v / base) + Number(v % base) / Number(base);
}
