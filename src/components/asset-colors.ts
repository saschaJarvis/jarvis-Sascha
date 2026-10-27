/** Farben je Anlageklasse (fest, nie nach Rang) – geprüft auf Farbsehschwäche gegen den dunklen Hintergrund #071420. */
export const ASSET_COLOR = {
  konten: '#3987e5',
  krypto: '#199e70',
  gold: '#c98500',
  platin: '#d55181',
  silber: '#9085e9',
  aktien: '#d95926',
} as const;
export const REST = '#4f6577';

export interface Slice { key: string; label: string; aed: number; color: string; sub?: string }

/** Krypto nach Coins: die 5 größten einzeln, der Rest zusammengefasst. */
const COIN_COLORS = ['#3987e5', '#199e70', '#c98500', '#d55181', '#9085e9'];
export function coinSlices(coins: Array<{ coin: string; aed: number }>, stableAed = 0): Slice[] {
  const list = [...coins].filter((c) => c.aed > 0).sort((a, b) => b.aed - a.aed);
  const top = list.slice(0, 5).map((c, i) => ({ key: c.coin, label: c.coin.toUpperCase(), aed: c.aed, color: COIN_COLORS[i] }));
  const rest = list.slice(5).reduce((n, c) => n + c.aed, 0) + stableAed;
  const n = list.length - 5;
  return rest > 0 ? [...top, { key: 'rest', label: n > 0 ? `Rest (${n}${stableAed > 0 ? ' + Stable' : ''})` : 'Stablecoins', aed: rest, color: REST }] : top;
}
