import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNextReminder, ReminderPrefs, ReminderTask, renderReminder } from '../../src/lib/domain/reminders';
import { isInQuietHours, nextAllowedInstant, zonedToUtc, tzOffsetMinutes, toLocalParts } from '../../src/lib/domain/time';

const prefsBase: ReminderPrefs = {
  timezone: 'Europe/Berlin', quietStart: '21:30', quietEnd: '08:00', maxPerDay: 4, minGapMinutes: 60,
  killSwitch: false, consentedChannels: new Set(['push', 'email']),
};
const task: ReminderTask = { id: 't1', title: 'Lagerraum ausmessen', nextStep: 'Zollstock mitnehmen', status: 'READY', escalationPolicy: 'standard' };
const empty = { sentForTaskSinceLastResponse: [], allSentRecently: [] };
const at = (iso: string) => new Date(iso);

test('Zeit: Berlin Sommer/Winter-Offset und Dubai ohne Sommerzeit', () => {
  assert.equal(tzOffsetMinutes(at('2026-07-01T12:00:00Z'), 'Europe/Berlin'), 120);
  assert.equal(tzOffsetMinutes(at('2026-12-01T12:00:00Z'), 'Europe/Berlin'), 60);
  assert.equal(tzOffsetMinutes(at('2026-07-01T12:00:00Z'), 'Asia/Dubai'), 240);
  assert.equal(zonedToUtc(2026, 10, 24, 9, 0, 'Asia/Dubai').toISOString(), '2026-10-24T05:00:00.000Z');
});

test('Zeit: Sommerzeit-Umstellung (Lücke 29.03.2026 02:30 Berlin) wird nach vorn geschoben', () => {
  const d = zonedToUtc(2026, 3, 29, 2, 30, 'Europe/Berlin');
  const p = toLocalParts(d, 'Europe/Berlin');
  assert.ok(p.hour === 3, `lokal ${p.hour}:${p.minute}`);
});

test('Ruhezeiten über Mitternacht', () => {
  assert.equal(isInQuietHours(at('2026-10-24T21:00:00Z'), 'Europe/Berlin', '21:30', '08:00'), true);  // 23:00 lokal
  assert.equal(isInQuietHours(at('2026-10-24T08:00:00Z'), 'Europe/Berlin', '21:30', '08:00'), false); // 10:00 lokal
  const next = nextAllowedInstant(at('2026-10-24T21:00:00Z'), 'Europe/Berlin', '21:30', '08:00');
  assert.equal(next.toISOString(), '2026-10-25T07:00:00.000Z'); // 08:00 MEZ nach Umstellung am 25.10.
});

test('Erinnerung: sofort senden tagsüber, Stufe 0 nur in der App', () => {
  const d = planNextReminder(task, prefsBase, empty, at('2026-10-21T10:00:00Z'));
  assert.equal(d.kind, 'send');
  if (d.kind === 'send') { assert.equal(d.stage, 0); assert.deepEqual(d.channels, ['in_app']); }
});

test('Erinnerung: nachts wird bis Ende der Ruhezeit gewartet', () => {
  const d = planNextReminder(task, prefsBase, empty, at('2026-10-21T22:00:00Z')); // 00:00 lokal
  assert.equal(d.kind, 'wait');
  if (d.kind === 'wait') assert.equal(d.until.toISOString(), '2026-10-22T06:00:00.000Z'); // 08:00 MESZ
});

test('Erinnerung: Tageslimit und Mindestabstand', () => {
  const now = at('2026-10-21T12:00:00Z');
  const four = ['08:00', '09:30', '10:45', '11:30'].map((h) => at(`2026-10-21T${h}:00Z`));
  const d = planNextReminder(task, prefsBase, { sentForTaskSinceLastResponse: [], allSentRecently: four }, now);
  assert.equal(d.kind, 'wait');
  if (d.kind === 'wait') assert.equal(d.until.toISOString(), '2026-10-22T06:00:00.000Z');
  const d2 = planNextReminder(task, prefsBase, { sentForTaskSinceLastResponse: [], allSentRecently: [at('2026-10-21T11:40:00Z')] }, now);
  assert.equal(d2.kind, 'wait');
  if (d2.kind === 'wait') assert.equal(d2.until.toISOString(), '2026-10-21T12:40:00.000Z');
});

test('Erinnerung: Eskalation endet nach fester Stufe (keine Endlosschleife)', () => {
  const sent = [0, 1, 2, 3, 4].map((i) => ({ at: at(`2026-10-1${i}T10:00:00Z`), stage: i }));
  const d = planNextReminder(task, prefsBase, { sentForTaskSinceLastResponse: sent, allSentRecently: [] }, at('2026-10-21T10:00:00Z'));
  assert.equal(d.kind, 'stop');
});

test('Erinnerung: Stufen nutzen nur eingewilligte Kanäle; Anruf nur kritisch + Einwilligung', () => {
  const sent = [0, 1, 2].map((i) => ({ at: at(`2026-10-1${i}T10:00:00Z`), stage: i }));
  const crit = { ...task, escalationPolicy: 'critical' as const };
  const noVoice = planNextReminder(crit, prefsBase, { sentForTaskSinceLastResponse: sent, allSentRecently: [] }, at('2026-10-21T10:00:00Z'));
  assert.equal(noVoice.kind, 'send');
  if (noVoice.kind === 'send') { assert.ok(!noVoice.channels.includes('voice')); assert.equal(noVoice.template, 'offer_guided_help'); }
  const withVoice = planNextReminder(crit, { ...prefsBase, consentedChannels: new Set(['push', 'email', 'voice']) },
    { sentForTaskSinceLastResponse: sent, allSentRecently: [] }, at('2026-10-21T10:00:00Z'));
  if (withVoice.kind === 'send') assert.ok(withVoice.channels.includes('voice'));
  const std = planNextReminder(task, { ...prefsBase, consentedChannels: new Set(['push', 'email', 'voice', 'sms']) },
    { sentForTaskSinceLastResponse: sent, allSentRecently: [] }, at('2026-10-21T10:00:00Z'));
  if (std.kind === 'send') { assert.ok(!std.channels.includes('voice')); assert.ok(!std.channels.includes('sms')); }
});

test('Erinnerung: Notaus, Pause, Snooze, erledigt, wartet auf Dritte', () => {
  const now = at('2026-10-21T10:00:00Z');
  assert.equal(planNextReminder(task, { ...prefsBase, killSwitch: true }, empty, now).kind, 'stop');
  assert.equal(planNextReminder({ ...task, status: 'CLOSED' }, prefsBase, empty, now).kind, 'stop');
  assert.equal(planNextReminder({ ...task, status: 'WAITING_FOR_THIRD_PARTY' }, prefsBase, empty, now).kind, 'stop');
  const p = planNextReminder(task, { ...prefsBase, pausedUntil: at('2026-10-23T10:00:00Z') }, empty, now);
  assert.equal(p.kind, 'wait');
  const s = planNextReminder({ ...task, snoozedUntil: at('2026-10-21T15:00:00Z') }, prefsBase, empty, now);
  assert.equal(s.kind, 'wait');
  if (s.kind === 'wait') assert.equal(s.until.toISOString(), '2026-10-21T15:00:00.000Z');
  assert.equal(planNextReminder(task, { ...prefsBase, maxPerDay: 0 }, empty, now).kind, 'stop');
});

test('Erinnerungstexte: freundlich, ohne Druck', () => {
  for (const t of ['nudge', 'clear_next_action', 'offer_guided_help', 'phone_call', 'final_offer_delegate'] as const) {
    const r = renderReminder(t, task);
    assert.ok(r.title.length > 0 && r.body.length > 0);
    assert.doesNotMatch(`${r.title} ${r.body}`, /(schon wieder|immer noch nicht|letzte warnung|sofort!)/i);
  }
});
