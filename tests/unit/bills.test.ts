import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billDue, billOccurrences } from '../../src/lib/domain/bills';

test('Rechnung am letzten Tag: 31.10., 30.11., 28./29.02. – 9 Uhr Dubai', () => {
  const b = { id: 'x', title: 'Lager', day_of_month: -1, remind_hour: 9 };
  assert.equal(billDue(b, 2026, 10, 'Asia/Dubai').toISOString(), '2026-10-31T05:00:00.000Z');
  assert.equal(billDue(b, 2026, 11, 'Asia/Dubai').toISOString(), '2026-11-30T05:00:00.000Z');
  assert.equal(billDue(b, 2027, 2, 'Asia/Dubai').toISOString(), '2027-02-28T05:00:00.000Z');
  assert.equal(billDue(b, 2028, 2, 'Asia/Dubai').toISOString(), '2028-02-29T05:00:00.000Z');
});

test('Fälligkeiten: aktueller + nächster Monat, über den Jahreswechsel, stabile Schlüssel', () => {
  const b = { id: 'abc', title: 'Lager', day_of_month: -1, remind_hour: 9 };
  const o = billOccurrences(b, new Date('2026-12-15T10:00:00Z'), 'Asia/Dubai', 1);
  assert.deepEqual(o.map((x) => x.key), ['bill:abc:2026-12', 'bill:abc:2027-01']);
  assert.deepEqual(o.map((x) => x.monthLabel), ['Dezember 2026', 'Januar 2027']);
  // Lokaler Monat zählt: 31.10. 22:00 UTC ist in Dubai schon November
  assert.equal(billOccurrences(b, new Date('2026-10-31T22:00:00Z'), 'Asia/Dubai', 0)[0].month, '2026-11');
});

test('Fester Tag 30 wird im Februar auf das Monatsende begrenzt', () => {
  assert.equal(billDue({ day_of_month: 28, remind_hour: 9 }, 2027, 2, 'Asia/Dubai').toISOString(), '2027-02-28T05:00:00.000Z');
});
