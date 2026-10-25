'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { addressHint, isXrpAddress } from '@/lib/crypto/xrp';
import { ethAddressHint, isEthAddress } from '@/lib/crypto/eth';
import { btcAddressHint, isBtcAddress } from '@/lib/crypto/btc';
import { adaAddressHint, isAdaAddress } from '@/lib/crypto/ada';
import { algoAddressHint, isAlgoAddress } from '@/lib/crypto/algo';
import { isZecAddress, zecAddressHint } from '@/lib/crypto/zec';
import { atomAddressHint, isAtomAddress } from '@/lib/crypto/atom';
import { isXlmAddress, xlmAddressHint } from '@/lib/crypto/xlm';
import { isLtcAddress, ltcAddressHint } from '@/lib/crypto/ltc';
import { dotAddressHint, isDotAddress } from '@/lib/crypto/dot';
import { isSolAddress } from '@/lib/crypto/sol';
import { descriptorOf, parseAccountKey } from '@/lib/crypto/xpub';
import { blockbookLoad, detectScheme } from '@/server/blockbook';
import { loadEthAccount, loadVetAccount, MANUAL_SYMBOLS } from '@/server/wallets';
import { resolveSymbol } from '@/server/markets';
import { CURRENCIES, parseAmount } from '@/lib/domain/networth';

export type WalletState = { error?: string; ok?: string } | undefined;

/** Nimmt NUR öffentliche Adressen an (XRP r…, Ethereum 0x…). Alles, was nach Seed/Schlüssel aussieht, wird abgewiesen und nicht gespeichert. */
export async function addWalletAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const raw = String(fd.get('address') ?? '').trim();
  let label = String(fd.get('label') ?? '').trim().slice(0, 40);
  // Ganzes Konto (Bitcoin, Litecoin, Zcash): Kontoschlüssel oder Ledger-Live-Export (JSON) – nur ansehen
  const acct = /^(\{|xpub|ypub|zpub|Ltub|Mtub)/.test(raw) ? parseAccountKey(raw) : null;
  if (acct && 'error' in acct) return { error: acct.error };
  if (acct) {
    const NAME = { btc: 'Bitcoin', ltc: 'Litecoin', zec: 'Zcash' } as const;
    let descriptor: string;
    let addresses: string[] = [];
    try {
      if (acct.scheme === 'auto') ({ descriptor, addresses } = await detectScheme(acct.coin, acct.key));
      else {
        descriptor = descriptorOf(acct.key, acct.scheme);
        addresses = (await blockbookLoad(acct.coin, descriptor).catch(() => null))?.addresses ?? [];
      }
    } catch { return { error: `${NAME[acct.coin]}-Konto gerade nicht abrufbar – bitte gleich nochmal versuchen.` }; }
    const table = `${acct.coin}_wallets`;
    let replaced = 0;
    try {
      await db(s).run(async (q) => {
        await q(`insert into ${table} (user_id, address, label) values (auth.uid(), $1, $2)`, [descriptor, label && label !== 'Ledger' ? label : `Ledger ${acct.coin.toUpperCase()} (ganzes Konto)`]);
        // Einzeladressen, die zu diesem Konto gehören, sonst doppelt gezählt
        if (addresses.length) replaced = (await q(`update ${table} set deleted_at = now() where deleted_at is null and address = any($1::text[]) returning id`, [addresses])).length;
      });
    } catch (e) {
      if (/_wallets_unique/.test(e instanceof Error ? e.message : '')) return { error: `Dieses ${NAME[acct.coin]}-Konto ist schon eingetragen.` };
      return { error: friendlyDbError(e) };
    }
    revalidatePath('/', 'layout');
    return { ok: `${NAME[acct.coin]}-Konto hinzugefügt – Jarvis sieht jetzt alle Adressen dieses Kontos (nur ansehen).${replaced ? ` ${replaced} einzeln eingetragene Adresse${replaced === 1 ? '' : 'n'} dieses Kontos ersetzt.` : ''}` };
  }
  if (raw.startsWith('{')) return { error: 'Dieser Export wird nicht erkannt. Bitte die öffentliche Adresse oder den Litecoin-Export aus Ledger Live einfügen.' };
  const SECRET = '⚠️ Das sieht nach einer geheimen Wiederherstellungsphrase oder einem privaten Schlüssel aus. Es wurde NICHT gespeichert. Jarvis braucht nur die öffentliche Adresse. Gib deine 24 Wörter oder Schlüssel niemals irgendwo ein.';
  if (raw.split(/\s+/).length >= 12 || /^s[1-9A-HJ-NP-Za-km-z]{25,}$/.test(raw) || /^(0x)?[0-9a-fA-F]{64}$/.test(raw) || /^([xyzt]prv|Ltpv|Mtpv)/i.test(raw) || /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(raw) || /^S[A-Z2-7]{55}$/.test(raw)) return { error: SECRET };
  let chain: 'xrp' | 'eth' | 'btc' | 'ada' | 'algo' | 'zec' | 'atom' | 'xlm' | 'ltc' | 'dot' | 'vet' | 'sol';
  if (!isBtcAddress(raw) && isSolAddress(raw)) {
    chain = 'sol';
  } else if (/^1[1-9A-HJ-NP-Za-km-z]{44,49}$/.test(raw)) {
    if (!isDotAddress(raw)) return { error: dotAddressHint(raw) ?? 'Keine gültige Polkadot-Adresse (beginnt mit 1, 47–48 Zeichen).' };
    chain = 'dot';
  } else if (/^([LM][1-9A-HJ-NP-Za-km-z]{26,33}|ltc1[0-9a-zA-Z]{20,})$/.test(raw) ) {
    if (!isLtcAddress(raw)) return { error: ltcAddressHint(raw) ?? 'Keine gültige Litecoin-Adresse (L…, M… oder ltc1…).' };
    chain = 'ltc';
  } else if (/^[GM][A-Z2-7]{55}([A-Z2-7]{13})?$/.test(raw)) {
    if (!isXlmAddress(raw)) return { error: xlmAddressHint(raw) ?? 'Keine gültige Stellar-Adresse (beginnt mit G, 56 Zeichen).' };
    chain = 'xlm';
  } else if (/^cosmos/i.test(raw)) {
    if (!isAtomAddress(raw)) return { error: atomAddressHint(raw) ?? 'Keine gültige Cosmos-Adresse (beginnt mit cosmos1).' };
    chain = 'atom';
  } else if (/^t[13][1-9A-HJ-NP-Za-km-z]{30,36}$/.test(raw) || /^(zs1|zc[1-9A-HJ-NP-Za-km-z]|u1[02-9ac-hj-np-z]{40,})/.test(raw)) {
    if (!isZecAddress(raw)) return { error: zecAddressHint(raw) ?? 'Keine gültige Zcash-Adresse (transparent, beginnt mit t1).' };
    chain = 'zec';
  } else if (/^[A-Za-z2-7]{58}$/.test(raw)) {
    if (!isAlgoAddress(raw)) return { error: algoAddressHint(raw) ?? 'Keine gültige Algorand-Adresse.' };
    chain = 'algo';
  } else if (/^(addr1|addr_test1|stake1|Ae2|DdzFF)/.test(raw)) {
    if (!isAdaAddress(raw)) return { error: adaAddressHint(raw) ?? 'Keine gültige Cardano-Adresse.' };
    chain = 'ada';
  } else if (/^(1|3|bc1|[xyz]pub|tb1)/i.test(raw)) {
    if (!isBtcAddress(raw)) return { error: btcAddressHint(raw) ?? 'Keine gültige Bitcoin-Adresse.' };
    chain = 'btc';
  } else if (raw.startsWith('0x') || /\.eth$/i.test(raw)) {
    if (!isEthAddress(raw)) return { error: ethAddressHint(raw) ?? 'Keine gültige Ethereum-Adresse (0x + 40 Zeichen).' };
    // 0x-Adressen gibt es auch bei VeChain: „vet“/„vechain“ in der Bezeichnung entscheidet; sonst nachsehen,
    // ob auf Ethereum etwas liegt und auf VeChain schon – dann ist es eine VeChain-Adresse.
    if (/^(vet|vechain)/i.test(label)) chain = 'vet';
    else if (raw.startsWith('0x')) {
      const [eth, vet] = await Promise.all([loadEthAccount(raw), loadVetAccount(raw)]);
      const ethEmpty = !eth.error && eth.eth === 0 && eth.tokens.every((t) => !t.amount);
      chain = ethEmpty && !vet.error && (vet.vet > 0 || vet.vtho > 0) ? 'vet' : 'eth';
    } else chain = 'eth';
  } else {
    if (!isXrpAddress(raw)) return { error: addressHint(raw) ?? 'Keine gültige Adresse. Bitcoin beginnt mit 1, 3 oder bc1, Ethereum mit 0x, XRP mit r, Cardano mit addr1, Zcash mit t1, Cosmos mit cosmos1, Stellar mit G (56 Zeichen), Litecoin mit L, M oder ltc1, Polkadot mit 1 (47–48 Zeichen), Solana 32–44 Zeichen, Algorand hat 58 Großbuchstaben/Ziffern.' };
    chain = 'xrp';
  }
  if (!label || label === 'Ledger') label = `Ledger ${chain.toUpperCase()}`;
  try {
    await db(s).run((q) => chain === 'eth'
      ? q('insert into eth_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'btc'
      ? q('insert into btc_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'ada'
      ? q('insert into ada_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'algo'
      ? q('insert into algo_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'zec'
      ? q('insert into zec_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'atom'
      ? q('insert into atom_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'xlm'
      ? q('insert into xlm_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'sol'
      ? q('insert into sol_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'vet'
      ? q('insert into vet_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'dot'
      ? q('insert into dot_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : chain === 'ltc'
      ? q('insert into ltc_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [/^ltc1/i.test(raw) ? raw.toLowerCase() : raw, label])
      : q('insert into crypto_wallets (user_id, chain, address, label) values (auth.uid(), $1, $2, $3)', [chain, raw, label]));
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/(crypto|eth|btc|ada|algo|zec|atom|xlm|ltc|dot|vet|sol)_wallets_unique/.test(m)) return { error: 'Diese Adresse ist schon eingetragen.' };
    if (/Höchstens 20/.test(m)) return { error: 'Höchstens 20 Wallets – bitte erst eines entfernen.' };
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: `„${label}“ hinzugefügt – nur zum Ansehen.` };
}

export async function removeWalletAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run(async (q) => {
    await q('update crypto_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update eth_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update btc_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update ada_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update algo_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update zec_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update atom_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update xlm_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update ltc_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update dot_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update vet_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
    await q('update sol_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]);
  });
  revalidatePath('/', 'layout');
}

// ---------- Konten (Kontostand von Hand) ----------

export async function addAccountAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const name = String(fd.get('name') ?? '').trim().slice(0, 60);
  const institution = String(fd.get('institution') ?? '').trim().slice(0, 60) || null;
  const currency = String(fd.get('currency') ?? '');
  const kind = String(fd.get('kind') ?? 'checking');
  const amount = parseAmount(String(fd.get('balance') ?? ''));
  if (!name) return { error: 'Bitte einen Namen angeben, z. B. „Emirates NBD Giro“.' };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: 'Währung bitte AED, EUR oder USD.' };
  if (!['checking', 'savings', 'deposit', 'credit_card', 'crypto_exchange', 'other'].includes(kind)) return { error: 'Ungültige Kontoart.' };
  if (amount == null) return { error: 'Kontostand bitte als Zahl, z. B. 12.345,67.' };
  try {
    await db(s).run(async (q) => {
      const [a] = await q<{ id: string }>('insert into accounts (user_id, name, institution, kind, currency) values (auth.uid(), $1, $2, $3, $4) returning id', [name, institution, kind, currency]);
      await q(`insert into balances (user_id, account_id, as_of, amount_minor, currency, source, certainty) values (auth.uid(), $1, current_date, $2, $3, 'manual', 'verified')`,
        [a.id, Math.round(amount * 100), currency]);
    });
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: `„${name}“ hinzugefügt.` };
}

export async function setBalanceAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const id = z.string().uuid().safeParse(fd.get('id'));
  const amount = parseAmount(String(fd.get('balance') ?? ''));
  if (!id.success) return { error: 'Ungültige Anfrage.' };
  if (amount == null) return { error: 'Bitte eine Zahl eingeben, z. B. 12.345,67.' };
  try {
    const rows = await db(s).run((q) => q(`insert into balances (user_id, account_id, as_of, amount_minor, currency, source, certainty)
        select auth.uid(), a.id, current_date, $2, a.currency, 'manual', 'verified' from accounts a where a.id = $1 and a.deleted_at is null returning id`,
      [id.data, Math.round(amount * 100)]));
    if (!rows.length) return { error: 'Konto nicht gefunden.' };
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: 'Kontostand aktualisiert.' };
}

export async function removeAccountAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update accounts set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}

// ---------- Gold ----------
export async function addGoldAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const mv = fd.get('metal');
  const metal = mv === 'platinum' || mv === 'silver' ? mv : 'gold';
  const count = parseAmount(String(fd.get('count') ?? '') || '1');
  const label = String(fd.get('label') ?? '').trim().slice(0, 60) || ({ gold: 'Gold', platinum: 'Platin', silver: 'Silber' } as const)[metal];
  const unit = String(fd.get('unit') ?? 'g');
  const qty = parseAmount(String(fd.get('qty') ?? ''));
  const purity = Number(fd.get('purity') ?? 999);
  const form = String(fd.get('form') ?? 'bar');
  if (qty == null || qty <= 0) return { error: 'Bitte die Menge als Zahl angeben, z. B. 100 oder 1,5.' };
  if (count == null || count <= 0 || count > 100000 || Math.round(count) !== count) return { error: 'Anzahl bitte als ganze Zahl, z. B. 20.' };
  if (![1000, 999, 995, 958, 950, 925, 916, 900, 875, 835, 800, 750, 625, 585, 333].includes(purity)) return { error: 'Ungültiger Feingehalt.' };
  if (!['bar', 'coin', 'jewelry', 'other'].includes(form)) return { error: 'Ungültige Form.' };
  const grams = (unit === 'oz' ? qty * 31.1034768 : unit === 'tola' ? qty * 11.6638038 : unit === 'kg' ? qty * 1000 : qty) * count;
  try {
    await db(s).run((q) => q('insert into gold_holdings (user_id, label, grams, purity, form, metal) values (auth.uid(), $1, $2, $3, $4, $5)', [label, grams.toFixed(3), purity, form, metal]));
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: `„${label}“ hinzugefügt.` };
}

export async function removeGoldAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update gold_holdings set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}

// ---------- Krypto auf Börsen ohne Abruf (z. B. Bitpanda) ----------
export async function addManualCryptoAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const symbol = String(fd.get('symbol') ?? '').trim().toUpperCase();
  const amount = parseAmount(String(fd.get('amount') ?? ''));
  const venue = String(fd.get('venue') ?? '').trim().slice(0, 40) || null;
  const label = String(fd.get('label') ?? '').trim().slice(0, 40) || `${venue ?? 'Börse'} ${symbol}`;
  if (!MANUAL_SYMBOLS[symbol]) return { error: `Für ${symbol || 'diesen Coin'} hat Jarvis noch keinen Kurs. Möglich: ${Object.keys(MANUAL_SYMBOLS).join(', ')}.` };
  if (amount == null || amount < 0) return { error: 'Menge bitte als Zahl, z. B. 55.000.' };
  try {
    await db(s).run((q) => q('insert into manual_crypto (user_id, symbol, amount, label, venue) values (auth.uid(), $1, $2, $3, $4)', [symbol, amount, label, venue]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/', 'layout');
  return { ok: `„${label}“ hinzugefügt.` };
}

export async function setManualAmountAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const id = z.string().uuid().safeParse(fd.get('id'));
  const amount = parseAmount(String(fd.get('amount') ?? ''));
  if (!id.success || amount == null || amount < 0) return { error: 'Menge bitte als Zahl.' };
  await db(s).run((q) => q('update manual_crypto set amount = $2 where id = $1 and deleted_at is null', [id.data, amount]));
  revalidatePath('/', 'layout');
  return { ok: 'Menge aktualisiert.' };
}

export async function removeManualAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update manual_crypto set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}

// ---------- Aktien / ETFs ----------
export async function addStockAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const query = String(fd.get('query') ?? '').trim().slice(0, 60);
  const qty = parseAmount(String(fd.get('qty') ?? ''));
  const venue = String(fd.get('venue') ?? '').trim().slice(0, 40) || null;
  if (!query) return { error: 'Bitte Kürzel, ISIN oder Namen eingeben, z. B. AAPL, SAP.DE oder IE00BK5BQT80.' };
  if (qty == null || qty <= 0) return { error: 'Stückzahl bitte als Zahl, z. B. 25 oder 3,5.' };
  const r = await resolveSymbol(query);
  if (!r) return { error: `„${query}“ nicht gefunden. Versuch es mit der ISIN (steht in deinem Depot) oder dem Börsenkürzel.` };
  const label = (String(fd.get('label') ?? '').trim() || r.name || r.symbol).slice(0, 60);
  try {
    await db(s).run((q) => q('insert into stock_holdings (user_id, symbol, name, isin, quantity, label, venue) values (auth.uid(), $1, $2, $3, $4, $5, $6)',
      [r.symbol, r.name?.slice(0, 120) ?? null, r.isin, qty, label, venue]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/', 'layout');
  return { ok: `„${label}“ (${r.symbol}) hinzugefügt.` };
}

export async function setStockQuantityAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const id = z.string().uuid().safeParse(fd.get('id'));
  const qty = parseAmount(String(fd.get('qty') ?? ''));
  if (!id.success || qty == null || qty < 0) return { error: 'Stückzahl bitte als Zahl.' };
  await db(s).run((q) => q('update stock_holdings set quantity = $2 where id = $1 and deleted_at is null', [id.data, qty]));
  revalidatePath('/', 'layout');
  return { ok: 'Stückzahl aktualisiert.' };
}

export async function removeStockAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update stock_holdings set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}
