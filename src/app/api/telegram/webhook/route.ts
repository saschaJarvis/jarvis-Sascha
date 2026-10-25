import { NextResponse, type NextRequest } from 'next/server';
import { withService } from '@/server/db';
import { sendTelegram } from '@/server/notify';

export const dynamic = 'force-dynamic';

/**
 * Telegram-Webhook des eigenen Bots. Telegram schickt den geheimen Wert aus setWebhook im Kopf
 * „X-Telegram-Bot-Api-Secret-Token“ mit – darüber wird der Nutzer gefunden. Verknüpfung: „/start CODE“.
 * Antwortet immer 200, damit Telegram nicht endlos wiederholt.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return NextResponse.json({ ok: true });
  const [cfg] = await withService((q) => q<{ user_id: string; telegram_bot_token: string; telegram_link_code: string | null; telegram_chat_id: string | null }>(
    'select user_id, telegram_bot_token, telegram_link_code, telegram_chat_id::text from alert_settings where telegram_webhook_secret = $1', [secret]));
  if (!cfg?.telegram_bot_token) return NextResponse.json({ ok: true });
  const u = (await req.json().catch(() => null)) as { message?: { chat?: { id?: number; type?: string }; text?: string } } | null;
  const chatId = u?.message?.chat?.id;
  const text = (u?.message?.text ?? '').trim();
  if (!chatId || u?.message?.chat?.type !== 'private') return NextResponse.json({ ok: true });

  const m = /^\/start(?:\s+([A-Z0-9]{6,12}))?$/.exec(text);
  if (m && m[1] && cfg.telegram_link_code && m[1] === cfg.telegram_link_code) {
    await withService((q) => q('update alert_settings set telegram_chat_id = $2, telegram_linked_at = now(), telegram_link_code = null where user_id = $1', [cfg.user_id, chatId]));
    await sendTelegram(cfg.telegram_bot_token, chatId, '✅ Verbunden. Jarvis schickt dir hier ab jetzt Warnungen: Abflüsse sofort, Eingänge, starke Kursbewegungen und neue Kontoauszüge.\n\nJarvis fragt nie nach deinen 24 Wörtern oder Passwörtern.').catch(() => {});
  } else if (cfg.telegram_chat_id && String(chatId) === cfg.telegram_chat_id) {
    await sendTelegram(cfg.telegram_bot_token, chatId, 'Ich bin nur der Melde-Kanal von Jarvis und lese hier nicht mit. Fragen bitte direkt in der Jarvis-App stellen.').catch(() => {});
  } else {
    // Fremde Chats: nicht verraten, wem der Bot gehört
    await sendTelegram(cfg.telegram_bot_token, chatId, 'Dieser Bot ist privat.').catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
