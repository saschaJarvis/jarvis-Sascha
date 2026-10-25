import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayView, overwhelmedPick, PriorityTask } from '../../src/lib/domain/priority';
import { parseQuickCapture } from '../../src/lib/domain/quickCapture';
import { buildCancellationDraft, hasPlaceholders } from '../../src/lib/domain/cancellationDraft';
import { toLocalParts } from '../../src/lib/domain/time';

const now = new Date('2026-10-24T08:00:00Z');
const base = (o: Partial<PriorityTask> & { id: string }): PriorityTask =>
  ({ title: o.id, status: 'READY', urgency: 1, impact: 1, certainty: 'verified', ...o });

test('Heute: genau eine Hauptaktion + max. 2 dringende, mit Begründung', () => {
  const tasks = [
    base({ id: 'abo', urgency: 1 }),
    base({ id: 'buero', urgency: 3, impact: 3, dueAt: new Date('2026-10-25T10:00:00Z'), dueIsHard: true, moneyAtRiskEur: 2400 }),
    base({ id: 'lager', urgency: 2, impact: 2, dueAt: new Date('2026-10-28T10:00:00Z') }),
    base({ id: 'container', urgency: 3, impact: 3, openDependencyCount: 1 }),
    base({ id: 'bank', urgency: 3, impact: 2, dueAt: new Date('2026-10-20T10:00:00Z') }),
    base({ id: 'erledigt', status: 'CLOSED', urgency: 3 }),
    base({ id: 'geschlummert', urgency: 3, snoozedUntil: new Date('2026-10-30T00:00:00Z') }),
  ];
  const v = buildTodayView(tasks, now);
  assert.ok(v.doThisNow);
  assert.ok(['buero', 'bank'].includes(v.doThisNow!.task.id));
  assert.ok(v.doThisNow!.reasons.length > 0);
  assert.ok(v.alsoUrgent.length <= 2);
  const shown = [v.doThisNow!.task.id, ...v.alsoUrgent.map((s) => s.task.id)];
  assert.ok(!shown.includes('erledigt') && !shown.includes('geschlummert'));
  assert.notEqual(v.doThisNow!.task.id, 'container', 'blockierte Aufgabe nie als Hauptaktion');
});

test('Heute: Nutzer-Übersteuerung wirkt', () => {
  const tasks = [base({ id: 'a', urgency: 3, impact: 3 }), base({ id: 'b', urgency: 0, impact: 0, userPriorityOverride: 3 })];
  assert.equal(buildTodayView(tasks, now).doThisNow!.task.id, 'b');
});

test('Überfordert: genau eine kleine Aufgabe', () => {
  const tasks = [
    base({ id: 'gross', urgency: 3, impact: 3, effortMinutes: 240 }),
    base({ id: 'mittel', urgency: 2, effortMinutes: 15 }),
    base({ id: 'mini', urgency: 1, effortMinutes: 5 }),
  ];
  assert.equal(overwhelmedPick(tasks, now)!.task.id, 'mini');
  assert.equal(overwhelmedPick([], now), null);
});

test('Schnellerfassung: "nächste Woche die Bank anrufen" in der richtigen Zeitzone', () => {
  const r = parseQuickCapture('Erinnere mich nächste Woche, die Bank anzurufen', now, 'Europe/Berlin');
  assert.equal(r.title, 'Bank anrufen');
  const p = toLocalParts(r.dueAt!, 'Europe/Berlin');
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.weekday], [2026, 10, 26, 9, 1]);
  assert.ok(r.assumptions.length > 0, 'Annahmen werden offengelegt');
  const d = parseQuickCapture('Morgen um 14:30 Steuerberater anrufen', now, 'Asia/Dubai');
  const dp = toLocalParts(d.dueAt!, 'Asia/Dubai');
  assert.deepEqual([dp.day, dp.hour, dp.minute], [25, 14, 30]);
  assert.equal(d.title, 'Steuerberater anrufen');
  const n = parseQuickCapture('Fotos vom Lager machen', now, 'Europe/Berlin');
  assert.equal(n.dueAt, null);
});

test('Kündigungsentwurf Demo "Büromietvertrag Mainz": Unbekanntes bleibt leer, nichts erfunden', () => {
  const r = buildCancellationDraft({ name: 'Büromietvertrag Mainz', category: 'commercial_lease' }, {}, '2026-10-24');
  assert.ok(hasPlaceholders(r.body));
  assert.ok(r.missing.some((m) => m.includes('Vertragspartner')));
  assert.match(r.body, /zum nächstmöglichen Zeitpunkt/);
  const dates = r.body.match(/\d{2}\.\d{2}\.\d{4}/g) ?? [];
  assert.deepEqual(dates, ['24.10.2026'], 'nur das Briefdatum, kein erfundenes Enddatum');
  assert.equal(r.recommendedChannel, 'postal_registered');
  assert.equal(r.requiresWetSignature, true);
  assert.equal(r.checks.find((c) => c.id === 'notice_period')!.state, 'open');
  assert.ok('keys_returned' in r.closureChecklist && 'deposit' in r.closureChecklist);
});

test('Kündigungsentwurf: belegtes Enddatum + Verbrauchervertrag per E-Mail', () => {
  const r = buildCancellationDraft({
    name: 'Fitnessstudio', category: 'membership', counterpartyName: 'Fit GmbH', counterpartyAddress: 'Musterstr. 1, 55116 Mainz',
    contractNumber: 'K-1', verifiedEndDate: '2027-01-31',
  }, { fullName: 'Max Muster', address: 'Teststr. 2, 55116 Mainz', city: 'Mainz' }, '2026-10-24');
  assert.equal(hasPlaceholders(r.body), false);
  assert.match(r.body, /zum 31\.01\.2027, hilfsweise zum nächstmöglichen Zeitpunkt/);
  assert.equal(r.recommendedChannel, 'email');
  assert.equal(r.requiresWetSignature, false);
});

test('Kündigungsentwurf Wohnung: Schriftform-Hinweis', () => {
  const r = buildCancellationDraft({ name: 'Wohnung', category: 'residential_lease' }, {}, '2026-10-24');
  assert.match(r.checks.find((c) => c.id === 'form')!.detail, /§ 568 BGB/);
  assert.match(r.body, /eigenhändige Unterschrift/);
});

test('Kündigungsentwurf: Regeln aus der Recherche (R4, R5, R6, R10)', () => {
  const w = buildCancellationDraft({ name: 'Wohnung', category: 'residential_lease', coTenants: ['Mitmieterin X'] }, { fullName: 'Max Muster' }, '2026-10-24');
  assert.equal((w.body.match(/eigenhändige Unterschrift/g) ?? []).length, 2, 'Unterschriftsfeld für jeden Mieter');
  assert.ok(w.checks.some((c) => c.id === 'no_special_right'));
  assert.ok(w.followUpTasks.some((t) => /Auslieferungsbeleg/.test(t)));
  const befristet = buildCancellationDraft({ name: 'Büro', category: 'commercial_lease', fixedTerm: true }, {}, '2026-10-24');
  assert.equal(befristet.blockers.length, 1);
  const unbekannt = buildCancellationDraft({ name: 'Büro', category: 'commercial_lease' }, {}, '2026-10-24');
  assert.equal(unbekannt.checks.find((c) => c.id === 'fixed_term')?.state, 'open');
  const lager = buildCancellationDraft({ name: 'Lager', category: 'storage' }, {}, '2026-10-24');
  assert.equal(lager.checks.find((c) => c.id === 'contract_type')?.state, 'open');
  assert.ok(lager.checks.some((c) => c.id === 'lien'));
});

test('Schnellerfassung: „übermorgen“ (Umlaut am Wortanfang) wird erkannt und nicht als „morgen“ gelesen', async () => {
  const { parseQuickCapture } = await import('../../src/lib/domain/quickCapture');
  const now = new Date('2026-10-25T08:00:00Z');
  const a = parseQuickCapture('Übermorgen Bank anrufen', now, 'Asia/Dubai');
  assert.equal(a.title, 'Bank anrufen');
  assert.equal(a.dueAt?.toISOString(), '2026-10-27T05:00:00.000Z'); // 09:00 Dubai
  const b = parseQuickCapture('übermorgen um 11 Uhr Bank anrufen', now, 'Asia/Dubai');
  assert.equal(b.dueAt?.toISOString(), '2026-10-27T07:00:00.000Z');
});
