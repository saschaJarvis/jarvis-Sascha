import 'server-only';
import webpush from 'web-push';
import { withService } from './db';

/**
 * Warnungen verschicken: Web-Push (iPhone-Home-Bildschirm-App) und Telegram (eigener Bot des Nutzers).
 * Warnungen liegen in der Tabelle alerts; dispatchAlerts() verschickt alle fälligen genau einmal.
 * Ruhezeiten gelten für alles außer Abflüssen (kritisch = sofort).
 */

export const pushConfigured = () => !!process.env.VAPID_PRIVATE_KEY && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function vapid() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:jarvis@example.invalid', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

export interface AlertInput { kind: 'outflow' | 'inflow' | 'price' | 'statement' | 'test'; severity?: 'info' | 'warn' | 'critical'; title: string; body: string; url?: string; dedupKey: string }

/** Warnung anlegen (einmalig je dedupKey). Ruhezeiten: nicht-kritische Warnungen warten bis zum Ende. */
export async function queueAlert(userId: string, a: AlertInput): Promise<boolean> {
  return withService(async (q) => {
    const [p] = await q<{ timezone: string; qs: string | null; qe: string | null; paused: boolean; kill: boolean }>(
      `select timezone, quiet_hours_start::text qs, quiet_hours_end::text qe, coalesce(paused_until > now(), false) paused, kill_switch kill from profiles where id = $1`, [userId]);
    const critical = a.severity === 'critical';
    // Ende der Ruhezeit in der Zeitzone des Nutzers berechnen (in SQL – zuverlässiger als im Server)
    const [t] = await q<{ send_after: Date }>(`
      with now_local as (select (now() at time zone $1) as l)
      select case
        when $4::boolean or $2::time is null or $3::time is null then now()
        when $2::time < $3::time and (l::time >= $2::time and l::time < $3::time) then ((l::date + $3::time) at time zone $1)
        when $2::time > $3::time and (l::time >= $2::time) then (((l::date + 1) + $3::time) at time zone $1)
        when $2::time > $3::time and (l::time < $3::time) then ((l::date + $3::time) at time zone $1)
        else now() end as send_after
      from now_local`, [p?.timezone ?? 'Asia/Dubai', p?.qs ?? null, p?.qe ?? null, critical]);
    const rows = await q(`insert into alerts (user_id, kind, severity, title, body, url, dedup_key, send_after)
        values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (user_id, dedup_key) do nothing returning id`,
      [userId, a.kind, a.severity ?? 'info', a.title.slice(0, 120), a.body.slice(0, 900), a.url ?? null, a.dedupKey.slice(0, 200), critical || !p ? new Date() : t.send_after]);
    return rows.length > 0;
  });
}

async function sendTelegram(token: string, chatId: number | string, text: string): Promise<void> {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram HTTP ${r.status}`);
}

/** Alle fälligen Warnungen verschicken (optional nur für einen Nutzer). */
export async function dispatchAlerts(onlyUser?: string): Promise<{ sent: number; failed: number }> {
  const due = await withService((q) => q<{ id: string; user_id: string; title: string; body: string; url: string | null; severity: string }>(
    `select a.id, a.user_id, a.title, a.body, a.url, a.severity from alerts a
       join profiles p on p.id = a.user_id
      where a.sent_at is null and a.send_after <= now() and a.created_at > now() - interval '2 days'
        and ($1::uuid is null or a.user_id = $1) and not coalesce(p.kill_switch, false)
        and (a.severity = 'critical' or not coalesce(p.paused_until > now(), false))
      order by a.created_at limit 50`, [onlyUser ?? null]));
  let sent = 0, failed = 0;
  for (const a of due) {
    const [cfg, subs] = await withService(async (q) => [
      (await q<{ push_enabled: boolean; telegram_bot_token: string | null; telegram_chat_id: string | null }>('select push_enabled, telegram_bot_token, telegram_chat_id::text from alert_settings where user_id = $1', [a.user_id]))[0],
      await q<{ id: string; endpoint: string; p256dh: string; auth: string }>('select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [a.user_id]),
    ] as const);
    let pushOk: boolean | null = null, tgOk: boolean | null = null;
    const errors: string[] = [];
    const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warn' ? '⚠️' : 'ℹ️';
    if (cfg?.push_enabled && subs.length && pushConfigured()) {
      vapid();
      pushOk = false;
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: `${icon} ${a.title}`, body: a.body, url: a.url ?? '/' }), { TTL: 3600, urgency: a.severity === 'critical' ? 'high' : 'normal' });
          pushOk = true;
          await withService((q) => q('update push_subscriptions set last_ok_at = now() where id = $1', [s.id]));
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await withService((q) => q('delete from push_subscriptions where id = $1', [s.id])); // Gerät abgemeldet
          errors.push(`push ${code ?? (e as Error).message}`);
        }
      }
    }
    if (cfg?.telegram_bot_token && cfg.telegram_chat_id) {
      try { await sendTelegram(cfg.telegram_bot_token, cfg.telegram_chat_id, `${icon} ${a.title}\n\n${a.body}`); tgOk = true; }
      catch (e) { tgOk = false; errors.push((e as Error).message); }
    }
    const ok = pushOk || tgOk;
    await withService((q) => q('update alerts set sent_at = now(), push_ok = $2, telegram_ok = $3, error = $4 where id = $1',
      [a.id, pushOk, tgOk, errors.length ? errors.join('; ').slice(0, 300) : ok === null ? 'kein Kanal eingerichtet' : null]));
    if (ok) sent++; else failed++;
  }
  return { sent, failed };
}

export { sendTelegram };
