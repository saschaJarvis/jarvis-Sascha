import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, isoWeek, dayNo } from '../../src/lib/calendar';

const now = new Date('2026-10-25T08:00:00Z'); // Sonntag, 12:00 in Dubai
const tz = 'Asia/Dubai';

test('Woche beginnt Montag, heute ist Sonntag als letzter Reiter', () => {
  const w = buildCalendar([], tz, now).find((x) => x.offset === 0)!;
  assert.deepEqual(w.days.map((d) => d.wd), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  assert.equal(w.days[6].isToday, true);
  assert.equal(w.days[0].date, '19.10.2026');
  assert.match(w.label, /^KW 43 · 19\.10\. – 25\.10\.$/);
});

test('Aufgaben landen am lokalen Tag (Zeitzone), sortiert, Mitternacht = ganztägig, überfällig markiert', () => {
  const tasks = [
    { id: 'b', title: 'Spät', due_at: new Date('2026-10-26T14:00:00Z'), domain: 'general', due_is_hard: false }, // Mo 18:00 DXB
    { id: 'a', title: 'Früh', due_at: new Date('2026-10-26T05:30:00Z'), domain: 'finance', due_is_hard: true },  // Mo 09:30
    { id: 'c', title: 'Ganztags', due_at: new Date('2026-10-25T20:00:00Z'), domain: 'general', due_is_hard: false }, // Mo 00:00 DXB
    { id: 'd', title: 'Vorbei', due_at: new Date('2026-10-24T06:00:00Z'), domain: 'general', due_is_hard: false },
  ];
  const weeks = buildCalendar(tasks, tz, now);
  const next = weeks.find((x) => x.offset === 1)!;
  assert.deepEqual(next.days[0].items.map((i) => [i.id, i.time]), [['c', null], ['a', '09:30'], ['b', '18:00']]);
  const sat = weeks.find((x) => x.offset === 0)!.days[5];
  assert.equal(sat.items[0].overdue, true);
  assert.equal(sat.isPast, true);
});

test('ISO-Kalenderwoche an Jahresgrenzen', () => {
  const dn = (s: string) => Date.parse(s) / 86_400_000;
  assert.equal(isoWeek(dn('2026-01-01')), 1);
  assert.equal(isoWeek(dn('2027-01-01')), 53);
  assert.equal(isoWeek(dn('2026-12-28')), 53);
  assert.equal(dayNo(new Date('2026-10-25T21:00:00Z'), 'Asia/Dubai'), dn('2026-10-26'));
});
