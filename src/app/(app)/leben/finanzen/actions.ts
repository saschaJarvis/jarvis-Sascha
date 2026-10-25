'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { addressHint, isXrpAddress } from '@/lib/crypto/xrp';
import { ethAddressHint, isEthAddress } from '@/lib/crypto/eth';
import { CURRENCIES, parseAmount } from '@/lib/domain/networth';

export type WalletState = { error?: string; ok?: string } | undefined;

/** Nimmt NUR öffentliche Adressen an (XRP r…, Ethereum 0x…). Alles, was nach Seed/Schlüssel aussieht, wird abgewiesen und nicht gespeichert. */
export async function addWalletAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const raw = String(fd.get('address') ?? '').trim();
  let label = String(fd.get('label') ?? '').trim().slice(0, 40);
  const SECRET = '⚠️ Das sieht nach einer geheimen Wiederherstellungsphrase oder einem privaten Schlüssel aus. Es wurde NICHT gespeichert. Jarvis braucht nur die öffentliche Adresse. Gib deine 24 Wörter oder Schlüssel niemals irgendwo ein.';
  if (raw.split(/\s+/).length >= 12 || /^s[1-9A-HJ-NP-Za-km-z]{25,}$/.test(raw) || /^(0x)?[0-9a-fA-F]{64}$/.test(raw) || /^[xyzt]prv/i.test(raw)) return { error: SECRET };
  let chain: 'xrp' | 'eth';
  if (raw.startsWith('0x') || /\.eth$/i.test(raw)) {
    if (!isEthAddress(raw)) return { error: ethAddressHint(raw) ?? 'Keine gültige Ethereum-Adresse (0x + 40 Zeichen).' };
    chain = 'eth';
  } else {
    if (!isXrpAddress(raw)) return { error: addressHint(raw) ?? 'Keine gültige Adresse. XRP beginnt mit „r“, Ethereum mit „0x“.' };
    chain = 'xrp';
  }
  if (!label || label === 'Ledger') label = `Ledger ${chain.toUpperCase()}`;
  try {
    await db(s).run((q) => chain === 'eth'
      ? q('insert into eth_wallets (user_id, address, label) values (auth.uid(), $1, $2)', [raw, label])
      : q('insert into crypto_wallets (user_id, chain, address, label) values (auth.uid(), $1, $2, $3)', [chain, raw, label]));
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/(crypto|eth)_wallets_unique/.test(m)) return { error: 'Diese Adresse ist schon eingetragen.' };
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
  const label = String(fd.get('label') ?? '').trim().slice(0, 60) || 'Gold';
  const unit = String(fd.get('unit') ?? 'g');
  const qty = parseAmount(String(fd.get('qty') ?? ''));
  const purity = Number(fd.get('purity') ?? 999);
  const form = String(fd.get('form') ?? 'bar');
  if (qty == null || qty <= 0) return { error: 'Bitte die Menge als Zahl angeben, z. B. 100 oder 1,5.' };
  if (![999, 995, 916, 875, 750, 585, 333].includes(purity)) return { error: 'Ungültiger Feingehalt.' };
  if (!['bar', 'coin', 'jewelry', 'other'].includes(form)) return { error: 'Ungültige Form.' };
  const grams = unit === 'oz' ? qty * 31.1034768 : unit === 'tola' ? qty * 11.6638038 : qty;
  try {
    await db(s).run((q) => q('insert into gold_holdings (user_id, label, grams, purity, form) values (auth.uid(), $1, $2, $3, $4)', [label, grams.toFixed(3), purity, form]));
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
