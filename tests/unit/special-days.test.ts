import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observances, seasonStart } from '../../src/lib/special-days';
import { buildCalendar } from '../../src/lib/calendar';

const near = (d: Date, isoUtc: string, minutes = 3) =>
  assert.ok(Math.abs(d.getTime() - Date.parse(isoUtc)) <= minutes * 60_000, `${d.toISOString()} ≠ ${isoUtc}`);

test('Sonnenwenden/Tag-und-Nacht-Gleichen 2026 auf ~3 Minuten genau (Referenz: USNO)', () => {
  near(seasonStart(2026, 'march'), '2026-03-20T14:46:00Z');
  near(seasonStart(2026, 'june'), '2026-06-21T08:24:00Z');
  near(seasonStart(2026, 'september'), '2026-09-23T00:05:00Z');
  near(seasonStart(2026, 'december'), '2026-12-21T20:50:00Z');
});

test('Besondere Tage 2026/2027: Advent, Fastnacht, Muttertag, Zeitumstellung', () => {
  const by = (y: number) => Object.fromEntries(observances(y).map((o) => [o.name, o.date]));
  const a = by(2026), b = by(2027);
  assert.equal(a['1. Advent'], '2026-11-29');
  assert.equal(a['4. Advent'], '2026-12-20');
  assert.equal(a['Zeitumstellung (Winterzeit)'], '2026-10-25');
  assert.equal(a['Zeitumstellung (Sommerzeit)'], '2026-03-29');
  assert.equal(a['Herbstanfang'], '2026-09-23'); // 02:05 MESZ
  assert.equal(b['Rosenmontag'], '2027-02-08');
  assert.equal(b['Weiberfastnacht'], '2027-02-04');
  assert.equal(b['Muttertag'], '2027-05-09');
  assert.equal(by(2027)['4. Advent'], '2027-12-19');
  assert.equal(by(2022)['4. Advent'], '2022-12-18'); // Weihnachten an einem Sonntag
});

test('Kalender: Feiertag und besondere Tage getrennt, mehrere pro Tag möglich', () => {
  const weeks = buildCalendar([], 'Asia/Dubai', new Date('2026-12-20T08:00:00Z'), 0, 1);
  const w0 = weeks.find((w) => w.offset === 0)!.days; // 14.–20.12.
  assert.deepEqual(w0[6].observances.map((o) => o.name), ['4. Advent']);
  const w1 = weeks.find((w) => w.offset === 1)!.days; // 21.–27.12.
  assert.equal(w1[0].observances[0].name, 'Winteranfang');
  assert.equal(w1[3].observances[0].name, 'Heiligabend');
  assert.equal(w1[3].holiday, null);
  assert.equal(w1[4].holiday?.name, '1. Weihnachtstag');
});
