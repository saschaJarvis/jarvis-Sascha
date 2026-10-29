import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventRemindersDue, reminderTexts, untilText } from '../../src/lib/domain/event-reminders';

const ev = (over: Partial<Parameters<typeof eventRemindersDue>[0][number]> = {}) =>
  ({ uid: 'a1', title: 'Zahnarzt', start: new Date('2026-11-02T11:30:00Z'), allDay: false, location: 'Dubai Marina', source: 'iPhone', ...over });

test('Erinnerung genau ab 60 Minuten vorher, nicht früher', () => {
  assert.equal(eventRemindersDue([ev()], new Date('2026-11-02T10:29:00Z')).length, 0);
  const r = eventRemindersDue([ev()], new Date('2026-11-02T10:30:00Z'));
  assert.equal(r.length, 1);
  assert.equal(r[0].minutesLeft, 60);
});

test('kurzfristig eingetragen → sofort; begonnen oder ganztägig → nie', () => {
  assert.equal(eventRemindersDue([ev()], new Date('2026-11-02T11:10:00Z'))[0].minutesLeft, 20);
  assert.equal(eventRemindersDue([ev()], new Date('2026-11-02T11:30:00Z')).length, 0);
  assert.equal(eventRemindersDue([ev({ allDay: true })], new Date('2026-11-02T11:00:00Z')).length, 0);
});

test('verschobener Termin bekommt neuen Schlüssel, doppelte Kalender nur einmal', () => {
  const now = new Date('2026-11-02T10:45:00Z');
  const a = eventRemindersDue([ev()], now)[0].key;
  const b = eventRemindersDue([ev({ start: new Date('2026-11-02T11:40:00Z') })], now)[0].key;
  assert.notEqual(a, b);
  assert.equal(eventRemindersDue([ev(), ev({ source: 'Google' })], now).length, 1);
});

test('Texte in Dubai-Zeit, Ansage höchstens 256 Zeichen', () => {
  const [r] = eventRemindersDue([ev()], new Date('2026-11-02T10:30:00Z'));
  const t = reminderTexts(r, 'Asia/Dubai');
  assert.equal(t.title, '📅 Zahnarzt – 15:30 Uhr');
  assert.match(t.body, /^In einer Stunde, um 15:30 Uhr/);
  assert.match(t.call, /in einer Stunde, um 15:30 Uhr: Zahnarzt\. Ort: Dubai Marina\./);
  const long = reminderTexts({ ...r, event: { ...r.event, title: 'x'.repeat(400) } }, 'Asia/Dubai');
  assert.ok(long.call.length <= 256);
  assert.equal(untilText(25), 'in 25 Minuten');
});
