import { NextResponse } from 'next/server';
import { loadXrpAccount, xrpPrice } from '@/server/wallets';

export const dynamic = 'force-dynamic';

/** Betriebscheck: XRP Ledger + Kurs erreichbar? Prüft nur ein bekanntes öffentliches Konto (Genesis), keine Nutzerdaten. */
export async function GET() {
  const [acc, price] = await Promise.all([loadXrpAccount('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'), xrpPrice()]);
  return NextResponse.json({
    xrpl: acc.error ? { ok: false, fehler: acc.error } : { ok: true, aktiviert: acc.activated, bewegungen: acc.moves.length, reserve: acc.reserveXrp != null },
    kurs: price ? { ok: true, quelle: price.source } : { ok: false },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
