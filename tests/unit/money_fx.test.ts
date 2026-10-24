import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatMoney, money, add, divRoundHalfEven, divRoundHalfAwayFromZero } from '../../src/lib/domain/money';
import { convert, FxRate } from '../../src/lib/domain/fx';

test('Beträge: deutsche und internationale Formate', () => {
  assert.equal(parseAmount('1.234,56', 'EUR').minor, 123456n);
  assert.equal(parseAmount('-1.234,56', 'EUR').minor, -123456n);
  assert.equal(parseAmount('1,234.56', 'EUR').minor, 123456n);
  assert.equal(parseAmount('12', 'EUR').minor, 1200n);
  assert.equal(parseAmount('7,5', 'EUR').minor, 750n);
  assert.equal(parseAmount('−7,50', 'EUR').minor, -750n);       // Unicode-Minus
  assert.equal(parseAmount('7,50-', 'EUR').minor, -750n);       // nachgestelltes Minus
  assert.equal(parseAmount('1.234.567', 'EUR').minor, 123456700n);
  assert.equal(parseAmount('0,00012345', 'BTC').minor, 12345n);
  assert.equal(parseAmount('1.234', 'EUR', 'de').minor, 123400n);
});

test('Beträge: Mehrdeutiges und Unsinn wird abgelehnt statt geraten', () => {
  assert.throws(() => parseAmount('1.234', 'EUR'), /mehrdeutig/);
  assert.throws(() => parseAmount('abc', 'EUR'));
  assert.throws(() => parseAmount('1,234', 'EUR', 'de'), /Nachkommastellen/);
  assert.throws(() => parseAmount('1', 'XYZ'), /Unbekannte Währung/);
});

test('Formatierung de-DE', () => {
  assert.equal(formatMoney(money(-123456n, 'EUR')), '−1.234,56 EUR');
  assert.equal(formatMoney(money(5n, 'AED')), '0,05 AED');
});

test('Addition nur bei gleicher Währung', () => {
  assert.throws(() => add(money(1n, 'EUR'), money(1n, 'AED')), /Währungen verschieden/);
});

test('Rundung: half-even und half-away', () => {
  assert.equal(divRoundHalfEven(5n, 2n), 2n);
  assert.equal(divRoundHalfEven(7n, 2n), 4n);
  assert.equal(divRoundHalfEven(-5n, 2n), -2n);
  assert.equal(divRoundHalfAwayFromZero(5n, 2n), 3n);
  assert.equal(divRoundHalfAwayFromZero(-5n, 2n), -3n);
});

const rates: FxRate[] = [
  { base: 'EUR', quote: 'AED', rate: '4.0000', asOf: '2026-10-01', source: 'Test (fiktiv)' },
  { base: 'EUR', quote: 'AED', rate: '4.2500', asOf: '2026-10-20', source: 'Test (fiktiv)' },
  { base: 'BTC', quote: 'EUR', rate: '50000.5', asOf: '2026-10-20', source: 'Test (fiktiv)' },
];

test('FX: jüngster Kurs bis Stichtag, mit Quelle und Erklärung', () => {
  const r = convert(money(10000n, 'EUR'), 'AED', rates, '2026-10-21');
  assert.equal(r.value.minor, 42500n);
  assert.equal(r.rate.asOf, '2026-10-20');
  assert.equal(r.stale, false);
  assert.match(r.explanation, /Quelle: Test/);
});

test('FX: kein Kurs aus der Zukunft, veraltete Kurse markiert', () => {
  const r = convert(money(10000n, 'EUR'), 'AED', rates, '2026-10-15');
  assert.equal(r.value.minor, 40000n);
  assert.equal(r.stale, true);
  assert.throws(() => convert(money(1n, 'EUR'), 'AED', rates, '2026-09-01'), /Kein Kurs/);
});

test('FX: inverse Richtung und Krypto-Nachkommastellen', () => {
  const r = convert(money(42500n, 'AED'), 'EUR', rates, '2026-10-21');
  assert.equal(r.value.minor, 10000n);
  const b = convert(money(1_000_000n, 'BTC'), 'EUR', rates, '2026-10-21'); // 0,01 BTC
  assert.equal(b.value.minor, 50000n); // 500,005 € = 50000,5 Cent -> half-even -> 50000
});
