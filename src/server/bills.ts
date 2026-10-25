import 'server-only';
import { db } from './repo';
import type { Session } from './auth';
import { billOccurrences, type Bill } from '@/lib/domain/bills';

interface BillRow extends Bill { amount_minor: string | null; currency: string | null; note: string | null }

const money = (minor: string | null, cur: string | null) =>
  minor && cur ? `${(Number(minor) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}` : null;

/**
 * Legt für jede aktive wiederkehrende Zahlung die Aufgabe für diesen und den nächsten Monat an (idempotent
 * über idempotency_key). Läuft beim Öffnen von Brücke und Kalender – kein Hintergrunddienst nötig.
 */
export async function ensureBillTasks(s: Session, now = new Date()): Promise<void> {
  try {
    await db(s).run(async (q) => {
      const tz = (await q<{ timezone: string }>('select timezone from profiles where id = auth.uid()'))[0]?.timezone ?? 'Asia/Dubai';
      const bills = await q<BillRow>('select id, title, day_of_month, remind_hour, amount_minor, currency, note from recurring_bills where active and deleted_at is null');
      for (const b of bills) {
        const amount = money(b.amount_minor, b.currency);
        for (const o of billOccurrences(b, now, tz, 1)) {
          await q(
            `insert into tasks (user_id, title, why, domain, status, due_at, urgency, impact, money_at_risk_minor, money_currency,
                                next_step, escalation_policy, certainty, source_ref, idempotency_key)
             values (auth.uid(), $1, $2, 'finance', 'READY', $3, 2, 2, $4, $5, $6, 'gentle', 'verified', $7, $8)
             on conflict (user_id, idempotency_key) do nothing`,
            [`${b.title} – ${o.monthLabel}`, b.note, o.dueAt, b.amount_minor, b.currency,
              amount ? `${amount} bezahlen und hier abhaken` : 'Bezahlen und hier abhaken',
              JSON.stringify({ kind: 'recurring_bill', bill_id: b.id, month: o.month }), o.key]);
        }
      }
    });
  } catch (e) {
    console.error('[bills]', (e as Error).message); // nie die Seite blockieren
  }
}
