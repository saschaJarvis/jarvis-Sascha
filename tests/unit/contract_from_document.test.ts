import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractColumns, matchContract, streetKey, type ExistingContract } from '../../src/lib/domain/contractFromDocument';

const existing: ExistingContract[] = [
  { id: 'demo', name: 'Büromietvertrag Mainz (BEISPIEL)', category: 'commercial_lease', counterparty_name: null, contract_number: null, is_demo: true },
  { id: 'buero', name: 'Büro Curiestr. 16, Mainz', category: 'commercial_lease', counterparty_name: 'Klein Junior GbR', contract_number: null, is_demo: false },
  { id: 'storeit', name: 'StoreIT Dubai Airport', category: 'storage', counterparty_name: 'StoreIT Self Storage LLC', contract_number: 'Unit B042', is_demo: false },
];

test('Adresse mit Hausnummer: Curiestraße 16 = Curiestr. 16, aber nicht 18', () => {
  assert.equal(streetKey('Büro Curiestraße 16, 55129 Mainz'), 'curiestr 16');
  assert.equal(streetKey('Büro Curiestr. 16, Mainz'), 'curiestr 16');
  assert.equal(streetKey('Lagerhalle Curiestr. 18'), 'curiestr 18');
  assert.equal(streetKey('Telekom Festnetz'), null);
});

test('Mietanpassung fürs Büro landet beim Büro-Vertrag', () => {
  assert.equal(matchContract(existing, { name: 'Büro Curiestraße 16, Mainz', category: 'commercial_lease', counterparty_name: 'Christiane Klein' }), 'buero');
});

test('Lagerhalle Nr. 18 beim selben Vermieter wird ein eigener Vertrag', () => {
  assert.equal(matchContract(existing, { name: 'Lagerhalle Curiestr. 18, Mainz', category: 'commercial_lease', counterparty_name: 'Klein Junior GbR' }), null);
});

test('Vertragsnummer gewinnt; Vertragspartner + gleiche Art reicht', () => {
  assert.equal(matchContract(existing, { name: 'Lagerraum Dubai', category: 'storage', contract_number: 'unit b042' }), 'storeit');
  assert.equal(matchContract(existing, { name: 'Self-Storage Umm Ramool', category: 'storage', counterparty_name: 'StoreIT Self Storage L.L.C.' }), 'storeit');
});

test('Beispielverträge werden nie verknüpft', () => {
  assert.equal(matchContract(existing.slice(0, 1), { name: 'Büromietvertrag Mainz', category: 'commercial_lease' }), null);
});

test('Spalten: Betrag nur mit Währung, Cent-genau, Frist als „erkannt“', () => {
  const c = contractColumns({ name: ' Lagerhalle Curiestr. 18 ', category: 'commercial_lease', amount: 270, currency: 'eur', notice_period_text: '3 Monate', deposit: 540 });
  assert.equal(c.name, 'Lagerhalle Curiestr. 18');
  assert.equal(c.amount_minor, 27000);
  assert.equal(c.currency, 'EUR');
  assert.equal(c.billing_interval, 'unknown');
  assert.equal(c.deposit_minor, 54000);
  assert.equal(c.notice_period_certainty, 'detected');
  const n = contractColumns({ name: 'X Vertrag', category: 'other', amount: 50 });
  assert.equal(n.amount_minor, null);
  assert.equal(n.currency, null);
  assert.equal(n.start_date, null);
});
