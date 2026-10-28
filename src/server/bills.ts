import 'server-only';
import { db } from './repo';
import type { Session } from './auth';
import { billOccurrences, type Bill } from '@/lib/domain/bills';

interface BillRow extends Bill { amount_minor: string | null; currency: string | null; note: string | null; ends_on: string | null }

const money = (minor: string | null, cur: string | null) =>
  minor && cur ? `${(Number(minor) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}` : null;

/**
 * Legt für jede aktive wiederkehrende Zahlung die Aufgabe für diesen und den nächsten Monat an (idempotent
 * über idempotency_key). Läuft beim Öffnen von Brücke und Kalender – kein Hintergrunddienst nötig.
 * Noch offene Aufgaben übernehmen Änderungen an Betrag/Titel/Notiz. Endet der verknüpfte Vertrag
 * (frühestes Ende), entstehen ab dem Endtag keine Zahlungen mehr; schon angelegte offene werden storniert.
 */
export async function ensureBillTasks(s: Session, now = new Date()): Promise<void> {
  try {
    await db(s).run(async (q) => {
      const tz = (await q<{ timezone: string }>('select timezone from profiles where id = auth.uid()'))[0]?.timezone ?? 'Asia/Dubai';
      const bills = await q<BillRow>(
        `select b.id, b.title, b.day_of_month, b.remind_hour, b.amount_minor, b.currency, b.note, c.earliest_end_date::text as ends_on
           from recurring_bills b left join contracts c on c.id = b.contract_id and c.deleted_at is null
          where b.active and b.deleted_at is null`);
      for (const b of bills) {
        const amount = money(b.amount_minor, b.currency);
        for (const o of billOccurrences(b, now, tz, 1)) {
          const dueLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(o.dueAt);
          if (b.ends_on && dueLocal >= b.ends_on) {
            // Vertrag ist dann schon zu Ende – keine Zahlung mehr fällig
            await q(`update tasks set status = 'CANCELLED' where idempotency_key = $1 and status not in ('CLOSED','CANCELLED')`, [o.key]);
            continue;
          }
          await q(
            `insert into tasks (user_id, title, why, domain, status, due_at, urgency, impact, money_at_risk_minor, money_currency,
                                next_step, escalation_policy, certainty, source_ref, idempotency_key)
             values (auth.uid(), $1, $2, 'finance', 'READY', $3, 2, 2, $4, $5, $6, 'gentle', 'verified', $7, $8)
             on conflict (user_id, idempotency_key) do update
               set title = excluded.title, why = excluded.why, money_at_risk_minor = excluded.money_at_risk_minor,
                   money_currency = excluded.money_currency, next_step = excluded.next_step
               where tasks.status not in ('CLOSED','CANCELLED')
                 and (tasks.title, tasks.why, tasks.money_at_risk_minor, tasks.next_step)
                     is distinct from (excluded.title, excluded.why, excluded.money_at_risk_minor, excluded.next_step)`,
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
