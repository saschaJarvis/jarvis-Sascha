import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goldValueUsd, parseAmount, sumParts, toAed } from '../../src/lib/domain/networth';

test('Beträge: deutsch und englisch geschrieben', () => {
  assert.equal(parseAmount('12.345,67'), 12345.67);
  assert.equal(parseAmount('12,345.67'), 12345.67);
  assert.equal(parseAmount('12345,5'), 12345.5);
  assert.equal(parseAmount('1.500'), 1500);
  assert.equal(parseAmount('1,500'), 1500);
  assert.equal(parseAmount('2.5'), 2.5);
  assert.equal(parseAmount('-250,50 €'), -250.5);
  assert.equal(parseAmount('12 000 AED'), 12000);
  assert.equal(parseAmount('abc'), null);
});

test('Umrechnung nach AED: USD fest, EUR nur mit Kurs', () => {
  assert.equal(toAed(100, 'AED', null), 100);
  assert.equal(toAed(100, 'USD', null), 367.25);
  assert.equal(toAed(100, 'EUR', 4.25), 425);
  assert.equal(toAed(100, 'EUR', null), null);
});

test('Gold: 1 Unze 999 bei 2.000 USD/oz ≈ 1.998 USD; 22K = 91,6 %', () => {
  assert.ok(Math.abs(goldValueUsd(31.1034768, 999, 2000) - 1998) < 1e-9);
  assert.ok(Math.abs(goldValueUsd(100, 916, 3110.34768) - 9160) < 1e-6);
});

test('Summe zählt fehlende Kurse separat statt zu raten', () => {
  assert.deepEqual(sumParts([100, null, 50, NaN]), { aed: 150, missing: 2 });
});
