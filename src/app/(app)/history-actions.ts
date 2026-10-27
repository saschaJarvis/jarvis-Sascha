'use server';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { coinHistory, fxHistory } from '@/server/history';
import { metalHistory, RANGE_CFG, type HistRange } from '@/server/markets';
import { valueSeries } from '@/lib/domain/change';
import type { PriceCoin } from '@/server/wallets';

const Input = z.object({
  range: z.enum(['7d', '1m', '1y', '3y', '5y']),
  coins: z.array(z.object({ coin: z.string().regex(/^[a-z]{2,8}$/), aed: z.number().nonnegative() })).max(60),
  stableAed: z.number().nonnegative(),
  gold: z.number().nonnegative(), silver: z.number().nonnegative(), platinum: z.number().nonnegative(),
});

export interface RangeSeries { series: number[] | null; complete: boolean }
export type HistoryReply = { krypto: RangeSeries; gold: RangeSeries; silber: RangeSeries; platin: RangeSeries } | { error: string };

/** Wertverläufe (AED) für die Vermögenskarten über 7 Tage, 1 Monat oder 1 Jahr – mit den heutigen Beständen gerechnet. */
export async function assetHistoryAction(raw: z.input<typeof Input>): Promise<HistoryReply> {
  await requireUser();
  const p = Input.safeParse(raw);
  if (!p.success) return { error: 'Ungültige Anfrage.' };
  const { range, coins, stableAed } = p.data;
  const r = range as HistRange;
  const points = RANGE_CFG[r].points;

  const [coinF, gf, sf, pf] = await Promise.all([
    Promise.all(coins.filter((c) => c.aed > 0).map(async (c) => ({ valueNow: c.aed, factors: await coinHistory(c.coin as PriceCoin, r) }))),
    p.data.gold > 0 ? metalHistory('gold', r) : null,
    p.data.silver > 0 ? metalHistory('silver', r) : null,
    p.data.platinum > 0 ? metalHistory('platinum', r) : null,
  ]);
  const withHist = coinF.filter((c) => c.factors);
  const krypto: RangeSeries = withHist.length
    ? { series: valueSeries([...coinF, { valueNow: stableAed, factors: null }], points), complete: withHist.length === coinF.length }
    : { series: null, complete: false };
  const metal = (aed: number, f: number[] | null): RangeSeries => ({ series: aed > 0 && f ? valueSeries([{ valueNow: aed, factors: f }], points) : null, complete: true });
  return { krypto, gold: metal(p.data.gold, gf), silber: metal(p.data.silver, sf), platin: metal(p.data.platinum, pf) };
}

/** €/AED-Kursverlauf für die Kurskarte. */
export async function fxHistoryAction(range: '24h' | '7d' | '1m' | '1y' | '5y'): Promise<number[] | null> {
  await requireUser();
  if (!['24h', '7d', '1m', '1y', '5y'].includes(range)) return null;
  return fxHistory(range);
}
