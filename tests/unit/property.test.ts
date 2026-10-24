import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLtv } from '../../src/lib/domain/property';

test('LTV: geplante 60 % bei Off-Plan liegen über der CBUAE-Grenze von 50 %', () => {
  const r = checkLtv({ buyer: 'expat', stage: 'off_plan', use: 'first_home', valueAed: 2_000_000, plannedLtvPct: 60 });
  assert.equal(r.maxLtvPct, 50);
  assert.equal(r.withinLimit, false);
  assert.match(r.message, /mit Bank/);
  assert.match(r.source, /rulebook\.centralbank\.ae/);
});

test('LTV: fertiges Objekt, Expat, erste Immobilie', () => {
  assert.equal(checkLtv({ buyer: 'expat', stage: 'completed', use: 'first_home', valueAed: 2_000_000, plannedLtvPct: 60 }).withinLimit, true);
  assert.equal(checkLtv({ buyer: 'expat', stage: 'completed', use: 'first_home', valueAed: 6_000_000, plannedLtvPct: 75 }).maxLtvPct, 70);
  assert.equal(checkLtv({ buyer: 'expat', stage: 'completed', use: 'second_or_investment', valueAed: 1_000_000, plannedLtvPct: 60 }).withinLimit, true);
});
