import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, detectTransfers, detectRecurring, Txn } from '../../src/lib/domain/transactions';
import { annuityPayment, amortizationSchedule } from '../../src/lib/domain/amortization';
import { forecast, occurrences, SCENARIOS, CashItem } from '../../src/lib/domain/forecast';
import { importBankCsv } from '../../src/lib/import/bankStatement';
import { parseCsv, parseDate } from '../../src/lib/import/csv';

const t = (id: string, file: string | null, row: number, acc: string, date: string, amt: bigint, cp = 'REWE', purpose = 'Einkauf'): Txn =>
  ({ id, importFileId: file, sourceRow: row, accountId: acc, bookingDate: date, amountMinor: amt, currency: 'EUR', counterparty: cp, purpose });

test('Dubletten: gleiche Buchung in zwei Exporten wird erkannt, Original bleibt', () => {
  const txns = [
    t('a1', 'f1', 2, 'giro', '2026-10-01', -350n, 'Café', 'Kaffee'),
    t('a2', 'f1', 3, 'giro', '2026-10-01', -350n, 'Café', 'Kaffee'),   // zweiter echter Kaffee
    t('b1', 'f2', 5, 'giro', '2026-10-01', -350n, 'CAFÉ ', 'Kaffee'),  // Überschneidung im zweiten Export
    t('b2', 'f2', 6, 'giro', '2026-10-01', -350n, 'Café', 'Kaffee'),
    t('b3', 'f2', 7, 'giro', '2026-10-01', -350n, 'Café', 'Kaffee'),   // dritter -> neu
  ];
  const r = findDuplicates(txns, ['f1', 'f2']);
  assert.equal(r.duplicateOf.get('b1'), 'a1');
  assert.equal(r.duplicateOf.get('b2'), 'a2');
  assert.equal(r.duplicateOf.has('b3'), false);
  assert.equal(r.duplicateOf.has('a2'), false, 'zwei identische Käufe in EINER Datei sind keine Dublette');
});

test('Dubletten: externe Bank-ID hat Vorrang vor Textvergleich', () => {
  const x1 = { ...t('x1', 'f1', 1, 'giro', '2026-10-02', -1000n, 'A', 'Text alt'), externalId: 'E2E-1' };
  const x2 = { ...t('x2', 'f2', 1, 'giro', '2026-10-03', -1000n, 'A', 'Text neu'), externalId: 'E2E-1' };
  assert.equal(findDuplicates([x1, x2], ['f1', 'f2']).duplicateOf.get('x2'), 'x1');
});

test('Umbuchungen zwischen eigenen Konten', () => {
  const txns = [
    t('o1', 'f1', 1, 'giro', '2026-10-05', -500000n, 'Sascha', 'Übertrag'),
    t('i1', 'f2', 1, 'tagesgeld', '2026-10-06', 500000n, 'Sascha', 'Übertrag'),
    t('i2', 'f2', 2, 'tagesgeld', '2026-10-20', 500000n, 'Sascha', 'Übertrag'), // zu weit weg
    t('o2', 'f1', 2, 'giro', '2026-10-07', -500000n, 'Vermieter', 'Miete'),      // gleiches Konto-Paar? nein: kein Gegenpart in 3 Tagen
  ];
  const pairs = detectTransfers(txns, new Set(['giro', 'tagesgeld']));
  assert.deepEqual(pairs, [{ outId: 'o1', inId: 'i1', daysApart: 1 }]);
});

test('Wiederkehrende Abbuchungen (Abo) erkennen', () => {
  const txns = ['2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03'].map((d, i) => t(`s${i}`, 'f1', i, 'giro', d, -1299n, 'Netflix', 'Abo'));
  const r = detectRecurring(txns);
  assert.equal(r.length, 1);
  assert.equal(r[0].occurrences, 4);
  assert.ok(r[0].intervalDays >= 30 && r[0].intervalDays <= 31);
});

test('Annuität: bekannter Referenzwert und Plan geht exakt auf 0', () => {
  // 100.000,00 bei 6 % p. a., 12 Monate -> 8.606,64 (Standard-Annuitätenformel)
  assert.equal(annuityPayment({ principalMinor: 10_000_000n, annualRateBps: 600, termMonths: 12 }), 860664n);
  const s = amortizationSchedule({ principalMinor: 10_000_000n, annualRateBps: 600, termMonths: 12 });
  assert.equal(s.rows.length, 12);
  assert.equal(s.rows[11].balanceAfterMinor, 0n);
  assert.equal(s.totalPaidMinor - s.totalInterestMinor, 10_000_000n);
  // zinslos
  assert.equal(annuityPayment({ principalMinor: 1200n, annualRateBps: 0, termMonths: 12 }), 100n);
  assert.throws(() => annuityPayment({ principalMinor: 1n, annualRateBps: 500, termMonths: 0 }));
});

test('Annuität: lange Laufzeit (25 Jahre) bleibt exakt und endet bei 0', () => {
  const s = amortizationSchedule({ principalMinor: 150_000_000n, annualRateBps: 449, termMonths: 300 });
  assert.equal(s.rows[s.rows.length - 1].balanceAfterMinor, 0n);
  assert.ok(s.rows.every((r) => r.principalMinor >= 0n));
});

test('Prognose: Monatsende-Klemme, Szenarien, erster Engpass', () => {
  const rent: CashItem = { id: 'r', label: 'Miete', amountMinor: -150000n, firstDate: '2026-01-31', recurrence: { kind: 'monthly', dayOfMonth: 31 }, certainty: 'verified' };
  assert.deepEqual(occurrences(rent, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
  const salary: CashItem = { id: 's', label: 'Einnahme', amountMinor: 100000n, firstDate: '2026-11-01', recurrence: { kind: 'monthly', dayOfMonth: 1 }, certainty: 'inferred' };
  const base = forecast(300000n, '2026-10-24', 90, [rent, salary], SCENARIOS[1], 60000n);
  const stress = forecast(300000n, '2026-10-24', 90, [rent, salary], SCENARIOS[2], 60000n);
  assert.ok(stress.endBalanceMinor < base.endBalanceMinor);
  assert.equal(base.firstShortfallDate, '2026-12-31');
  assert.ok(stress.firstShortfallDate! <= base.firstShortfallDate!);
});

test('CSV: Semikolon, BOM, Anführungszeichen mit Zeilenumbruch, Vorspann', () => {
  const csv = '﻿Konto;DE00 1234\nZeitraum;01.10.2026 - 31.10.2026\n\n' +
    'Buchungstag;Valuta;Name Zahlungsbeteiligter;Verwendungszweck;Betrag;Währung\n' +
    '01.10.2026;01.10.2026;Vermieter GmbH;"Miete\nOktober";-1.250,00;EUR\n' +
    '02.10.2026;02.10.2026;"Café ""Zur Ecke""";Kaffee;-3,50;EUR\n' +
    'kaputt;;;;;\n' +
    '03.10.2026;03.10.2026;Arbeitgeber;Gehalt;2.000,00;EUR\n';
  const r = importBankCsv(csv);
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].amountMinor, -125000n);
  assert.equal(r.rows[0].purpose, 'Miete\nOktober');
  assert.equal(r.rows[1].counterparty, 'Café "Zur Ecke"');
  assert.equal(r.unknown.length, 1, 'kaputte Zeile wird gemeldet, nicht verschluckt');
  assert.ok(r.rows[0].sourceRow > 0);
});

test('CSV: Soll/Haben-Spalten und Datumsprüfung', () => {
  const csv = 'Buchungsdatum,Soll,Haben,Beguenstigter\n2026-10-01,"12,00",,Shop\n2026-10-02,,"100,00",Erstattung\n';
  const r = importBankCsv(csv);
  assert.deepEqual(r.rows.map((x) => x.amountMinor), [-1200n, 10000n]);
  assert.equal(parseDate('31.12.26'), '2026-12-31');
  assert.throws(() => parseDate('31.02.2026'));
  assert.throws(() => parseCsv('a;"offen\n'), /Anführungszeichen/);
});
