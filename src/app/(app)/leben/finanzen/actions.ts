'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { addressHint, isXrpAddress } from '@/lib/crypto/xrp';

export type WalletState = { error?: string; ok?: string } | undefined;

/** Nimmt NUR öffentliche Adressen an. Alles, was nach Seed/Schlüssel aussieht, wird abgelehnt und nicht gespeichert. */
export async function addWalletAction(_: WalletState, fd: FormData): Promise<WalletState> {
  const s = await requireUser();
  const raw = String(fd.get('address') ?? '').trim();
  const label = String(fd.get('label') ?? '').trim().slice(0, 40) || 'Ledger';
  if (raw.split(/\s+/).length >= 12 || /^s[1-9A-HJ-NP-Za-km-z]{25,}$/.test(raw)) {
    return { error: '⚠️ Das sieht nach einer geheimen Wiederherstellungsphrase oder einem privaten Schlüssel aus. Es wurde NICHT gespeichert. Jarvis braucht nur die öffentliche Adresse (beginnt mit „r“). Gib deine 24 Wörter niemals irgendwo ein.' };
  }
  if (!isXrpAddress(raw)) return { error: addressHint(raw) ?? 'Keine gültige XRP-Adresse. Sie beginnt mit „r“ und ist 25–35 Zeichen lang.' };
  try {
    await db(s).run((q) => q('insert into crypto_wallets (user_id, chain, address, label) values (auth.uid(), $1, $2, $3)', ['xrp', raw, label]));
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/crypto_wallets_unique/.test(m)) return { error: 'Diese Adresse ist schon eingetragen.' };
    if (/Höchstens 20/.test(m)) return { error: 'Höchstens 20 Wallets – bitte erst eines entfernen.' };
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: `„${label}“ hinzugefügt – nur zum Ansehen.` };
}

export async function removeWalletAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update crypto_wallets set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}
