import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, TASK_TRANSITIONS, TASK_STATUSES, primaryActionFor } from '../../src/lib/domain/taskStateMachine';
import { canTransitionCancellation, CANCELLATION_TRANSITIONS } from '../../src/lib/domain/cancellationStateMachine';

const free = { evidenceRequired: false, acceptedEvidenceCount: 0, openDependencyCount: 0 };

test('Aufgaben: jeder Status hat definierte Übergänge, keine Selbstschleifen', () => {
  for (const s of TASK_STATUSES) {
    assert.ok(Array.isArray(TASK_TRANSITIONS[s]), s);
    assert.ok(!TASK_TRANSITIONS[s].includes(s), `${s} -> ${s}`);
  }
});

test('Aufgaben: Nachweispflicht und Abhängigkeiten', () => {
  assert.equal(canTransition('READY', 'CLOSED', free).ok, true);
  assert.equal(canTransition('READY', 'CLOSED', { ...free, evidenceRequired: true }).ok, false);
  assert.equal(canTransition('EVIDENCE_PENDING', 'VERIFIED', { ...free, evidenceRequired: true }).ok, false);
  assert.equal(canTransition('EVIDENCE_PENDING', 'VERIFIED', { ...free, evidenceRequired: true, acceptedEvidenceCount: 1 }).ok, true);
  assert.equal(canTransition('VERIFIED', 'CLOSED', { ...free, evidenceRequired: true }).ok, true);
  assert.equal(canTransition('READY', 'IN_PROGRESS', { ...free, openDependencyCount: 1 }).ok, false);
  assert.equal(canTransition('READY', 'VERIFIED', free).ok, false);
});

test('Aufgaben: Wiederöffnen erlaubt (Historie bleibt), nie direkt CLOSED -> VERIFIED', () => {
  assert.equal(canTransition('CLOSED', 'READY', free).ok, true);
  assert.equal(canTransition('CLOSED', 'VERIFIED', free).ok, false);
});

test('Aufgaben: primäre Aktion passt zur Nachweispflicht', () => {
  assert.equal(primaryActionFor('IN_PROGRESS', true)?.to, 'EVIDENCE_PENDING');
  assert.equal(primaryActionFor('IN_PROGRESS', false)?.to, 'CLOSED');
  assert.equal(primaryActionFor('CLOSED', false), null);
});

const ctx = { hasDraft: true, hasDispatchChannel: true, hasFreshBoundApproval: false, hasDispatchRecord: false, closureChecklist: {} };

test('Kündigung: Freigabe-, Versand- und Abschluss-Gates', () => {
  assert.equal(canTransitionCancellation('USER_REVIEW', 'APPROVED', ctx).ok, false);
  assert.equal(canTransitionCancellation('USER_REVIEW', 'APPROVED', { ...ctx, hasFreshBoundApproval: true }).ok, true);
  assert.equal(canTransitionCancellation('APPROVED', 'SENT', ctx).ok, false);
  assert.equal(canTransitionCancellation('APPROVED', 'SENT', { ...ctx, hasDispatchRecord: true }).ok, true);
  assert.equal(canTransitionCancellation('CONFIRMED', 'CLOSED', { ...ctx, closureChecklist: { keys: 'open' } }).ok, false);
  assert.equal(canTransitionCancellation('CONFIRMED', 'CLOSED', { ...ctx, closureChecklist: {} }).ok, false);
  assert.equal(canTransitionCancellation('CONFIRMED', 'CLOSED', { ...ctx, closureChecklist: { keys: 'done', deposit: 'not_applicable' } }).ok, true);
  assert.equal(canTransitionCancellation('DRAFT', 'SENT', { ...ctx, hasDispatchRecord: true }).ok, false); // Freigabe nicht überspringbar
  assert.equal(canTransitionCancellation('DRAFT', 'USER_REVIEW', { ...ctx, hasDispatchChannel: false }).ok, false);
});

test('Kündigung: CLOSED ist endgültig; jeder Weg zu SENT führt über APPROVED', () => {
  assert.deepEqual(CANCELLATION_TRANSITIONS.CLOSED, []);
  const into = Object.entries(CANCELLATION_TRANSITIONS).filter(([, tos]) => tos.includes('SENT')).map(([f]) => f);
  assert.deepEqual(into, ['APPROVED']);
});
