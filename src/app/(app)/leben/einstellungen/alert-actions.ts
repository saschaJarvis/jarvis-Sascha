'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { dispatchAlerts, queueAlert } from '@/server/notify';

export type AlertState = { ok?: string; error?: string; code?: string; bot?: string } | undefined;

const ensureRow = `insert into alert_settings (user_id) values (auth.uid()) on conflict (user_id) do nothing`;

// ---------- Push aufs iPhone ----------
const Sub = z.object({ endpoint: z.string().url().startsWith('https://').max(1000), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) });

export async function savePushSubscriptionAction(json: string, device: string): Promise<AlertState> {
  const s = await requireUser();
  const sub = Sub.safeParse(JSON.parse(json || '{}'));
  if (!sub.success) return { error: 'Anmeldung für Push-Nachrichten ist fehlgeschlagen.' };
  try {
    await db(s).run(async (q) => {
      await q(ensureRow);
      await q(`insert into push_subscriptions (user_id, endpoint, p256dh, auth, device) values (auth.uid(), $1, $2, $3, $4)
               on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
        [sub.data.endpoint, sub.data.keys.p256dh, sub.data.keys.auth, device.slice(0, 80)]);
      await q('update alert_settings set push_enabled = true where user_id = auth.uid()');
    });
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/leben/einstellungen');
  return { ok: 'Push-Nachrichten sind auf diesem Gerät eingeschaltet.' };
}

export async function disablePushAction(): Promise<void> {
  const s = await requireUser();
  await db(s).run(async (q) => {
    await q('delete from push_subscriptions where user_id = auth.uid()');
    await q('update alert_settings set push_enabled = false where user_id = auth.uid()');
  });
  revalidatePath('/leben/einstellungen');
}

// ---------- Telegram ----------
async function tg<T>(token: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(8000),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(j.description || `HTTP ${r.status}`);
  return j.result as T;
}

export async function connectTelegramAction(_: AlertState, fd: FormData): Promise<AlertState> {
  const s = await requireUser();
  const token = String(fd.get('token') ?? '').trim();
  if (!/^[0-9]{5,15}:[A-Za-z0-9_-]{30,50}$/.test(token)) return { error: 'Das ist kein Bot-Schlüssel. Er sieht so aus: 1234567890:AA… (von @BotFather).' };
  let bot: { username?: string };
  try { bot = await tg<{ username?: string }>(token, 'getMe'); }
  catch { return { error: 'Telegram kennt diesen Bot-Schlüssel nicht. Bitte nochmal bei @BotFather kopieren.' }; }
  const secret = randomBytes(32).toString('base64url');
  const code = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
  const h = await headers();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || h.get('host');
  if (!host) return { error: 'Adresse der App unbekannt.' };
  try {
    await tg(token, 'setWebhook', { url: `https://${host}/api/telegram/webhook`, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
  } catch (e) { return { error: `Telegram-Verbindung fehlgeschlagen: ${(e as Error).message}` }; }
  try {
    await db(s).run(async (q) => {
      await q(ensureRow);
      await q(`update alert_settings set telegram_bot_token = $1, telegram_bot_name = $2, telegram_webhook_secret = $3, telegram_link_code = $4,
                 telegram_chat_id = null, telegram_linked_at = null where user_id = auth.uid()`, [token, bot.username ?? null, secret, code]);
    });
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/leben/einstellungen');
  return { ok: 'Bot gefunden.', code, bot: bot.username };
}

export async function disconnectTelegramAction(): Promise<void> {
  const s = await requireUser();
  const [cfg] = await db(s).run((q) => q<{ telegram_bot_token: string | null }>('select telegram_bot_token from alert_settings where user_id = auth.uid()'));
  if (cfg?.telegram_bot_token) await tg(cfg.telegram_bot_token, 'deleteWebhook').catch(() => {});
  await db(s).run((q) => q(`update alert_settings set telegram_bot_token = null, telegram_bot_name = null, telegram_webhook_secret = null,
      telegram_link_code = null, telegram_chat_id = null, telegram_linked_at = null where user_id = auth.uid()`));
  revalidatePath('/leben/einstellungen');
}

// ---------- Was gemeldet wird ----------
export async function saveAlertKindsAction(_: AlertState, fd: FormData): Promise<AlertState> {
  const s = await requireUser();
  const kinds = { outflow: fd.get('outflow') === 'on', inflow: fd.get('inflow') === 'on', price: fd.get('price') === 'on', statement: fd.get('statement') === 'on', other: fd.get('other') === 'on', bill: fd.get('bill') === 'on', sport: fd.get('sport') === 'on' };
  const opct = Number(String(fd.get('opct') ?? '5').replace(',', '.'));
  const pct = Number(String(fd.get('pct') ?? '10').replace(',', '.'));
  if (!Number.isFinite(pct) || pct < 1 || pct > 90) return { error: 'Schwelle bitte zwischen 1 und 90 %.' };
  if (!Number.isFinite(opct) || opct < 1 || opct > 90) return { error: 'Schwelle bitte zwischen 1 und 90 %.' };
  await db(s).run(async (q) => {
    await q(ensureRow);
    await q('update alert_settings set kinds = $1, price_threshold_pct = $2, other_threshold_pct = $3 where user_id = auth.uid()', [JSON.stringify(kinds), pct, opct]);
  });
  revalidatePath('/leben/einstellungen');
  return { ok: 'Gespeichert.' };
}

export async function sendTestAlertAction(): Promise<AlertState> {
  const s = await requireUser();
  await queueAlert(s.userId, { kind: 'test', severity: 'critical', title: 'Test von Jarvis', body: 'So sehen Warnungen aus. Abflüsse kommen sofort – auch nachts.', url: '/leben/einstellungen', dedupKey: `test:${Date.now()}` });
  const r = await dispatchAlerts(s.userId);
  return r.sent ? { ok: 'Testnachricht verschickt.' } : { error: 'Keine Nachricht zugestellt – ist ein Kanal eingerichtet?' };
}
