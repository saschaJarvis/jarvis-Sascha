import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressHint, isXrpAddress, toMove } from '../../src/lib/crypto/xrp';

test('XRP-Adresse: gültige Adressen inkl. Prüfsumme, Tippfehler werden erkannt', () => {
  assert.equal(isXrpAddress('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'), true);      // Genesis-Konto
  assert.equal(isXrpAddress('rrrrrrrrrrrrrrrrrrrrrhoLvTp'), true);              // ACCOUNT_ZERO
  assert.equal(isXrpAddress('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P5'), true);
  assert.equal(isXrpAddress('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P6'), false);       // letzte Stelle falsch
  assert.equal(isXrpAddress('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTH'), false);
  assert.equal(isXrpAddress('0x52908400098527886E0F7030069857D2E4169EE7'), false);
  assert.match(addressHint('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P6') ?? '', /Prüfsumme/);
  assert.match(addressHint('XVLhHMPHU98es4dbozjVtdWzVrDjtV18pX8yuPT7y4xaEHi') ?? '', /X-Adresse/);
});

test('XRP-Bewegungen: Eingang, Ausgang mit Gebühr, Token-Zahlung ohne XRP-Betrag', () => {
  const me = 'rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P5';
  const inn = toMove(me, { TransactionType: 'Payment', Account: 'rOther', Destination: me, Amount: '25000000', date: 814_000_000, hash: 'A', Fee: '12' }, { delivered_amount: '25000000' });
  assert.deepEqual([inn.direction, inn.xrp, inn.fee, inn.counterparty], ['in', 25, 0, 'rOther']);
  assert.equal(inn.date.toISOString(), new Date((814_000_000 + 946_684_800) * 1000).toISOString());
  const out = toMove(me, { TransactionType: 'Payment', Account: me, Destination: 'rX', Amount: '1500000', Fee: '12', hash: 'B' }, { delivered_amount: '1500000' });
  assert.deepEqual([out.direction, out.xrp, out.fee], ['out', 1.5, 0.000012]);
  const tok = toMove(me, { TransactionType: 'Payment', Account: 'rY', Destination: me, Amount: { currency: 'USD', value: '5', issuer: 'rZ' } }, undefined);
  assert.equal(tok.xrp, null);
});
