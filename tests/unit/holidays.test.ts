import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSunday, germanHolidays } from '../../src/lib/holidays';
import { buildCalendar } from '../../src/lib/calendar';

const iso = (dn: number) => new Date(dn * 86_400_000).toISOString().slice(0, 10);

test('Ostersonntag: bekannte Jahre', () => {
  assert.deepEqual([2024, 2025, 2026, 2027, 2028, 2030].map((y) => iso(easterSunday(y))),
    ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2030-04-21']);
});

test('Feiertage 2027 Rheinland-Pfalz: 11 Tage, bewegliche korrekt', () => {
  const h = germanHolidays(2027);
  assert.equal(h.length, 11);
  const by = Object.fromEntries(h.map((x) => [x.name, x.date]));
  assert.equal(by['Karfreitag'], '2027-03-26');
  assert.equal(by['Ostermontag'], '2027-03-29');
  assert.equal(by['Christi Himmelfahrt'], '2027-05-06');
  assert.equal(by['Pfingstmontag'], '2027-05-17');
  assert.equal(by['Fronleichnam'], '2027-05-27');
  assert.equal(by['Allerheiligen'], '2027-11-01');
  assert.equal(germanHolidays(2027, null).length, 9);
});

test('Kalender markiert Feiertage am richtigen Reiter (auch in Dubai-Zeitzone)', () => {
  const weeks = buildCalendar([], 'Asia/Dubai', new Date('2026-12-20T08:00:00Z'), 0, 2);
  const xmas = weeks.find((w) => w.offset === 1)!.days; // 21.–27.12.
  assert.equal(xmas[4].holiday?.name, '1. Weihnachtstag');
  assert.equal(xmas[5].holiday?.name, '2. Weihnachtstag');
  assert.equal(xmas[3].holiday, null); // Heiligabend ist kein gesetzlicher Feiertag
  const ny = weeks.find((w) => w.offset === 2)!.days; // 28.12.–03.01.
  assert.equal(ny[4].holiday?.name, 'Neujahr');
});
