import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLtcAddress, ltcAddressHint } from '../../src/lib/crypto/ltc';
import { isBtcAddress } from '../../src/lib/crypto/btc';

test('Litecoin: M/L Base58Check mit LTC-Versionsbyte, ltc1 Bech32', () => {
  assert.equal(isLtcAddress('M8X3Rv7ejYqW2RejxX52iiYe7ZYoZTryds'), true);
  assert.equal(isLtcAddress('M8X3Rv7ejYqW2RejxX52iiYe7ZYoZTrydt'), false); // Tippfehler
  assert.equal(isLtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), false); // Bitcoin
  assert.equal(isBtcAddress('M8X3Rv7ejYqW2RejxX52iiYe7ZYoZTryds'), false);
  assert.match(ltcAddressHint('M8X3Rv7ejYqW2RejxX52iiYe7ZYoZTrydt') ?? '', /Prüfsumme/);
});

test('Litecoin: Konto-Schlüssel (Ltub) und Ledger-Export → Descriptor', async () => {
  const { isLtcXpub, parseLtcXpubInput } = await import('../../src/lib/crypto/ltc');
  const x = 'Ltub2ZJwTmmz3ghZFeYF68fWLc5qXGqTjuAM9byyZ1DeN4b98ZAYoJyLUHzegPsSv3h4ajBk5bCtyf2P8r4PY6vttW92kKNrB99QLjymXjmb7S3';
  assert.equal(isLtcXpub(x), true);
  assert.equal(isLtcXpub(`${x.slice(0, -1)}4`), false);
  assert.deepEqual(parseLtcXpubInput(x), { descriptor: `sh(wpkh(${x}))` });
  assert.deepEqual(parseLtcXpubInput(JSON.stringify({ xpub: x, id: `js:2:litecoin:${x}:native_segwit` })), { descriptor: `wpkh(${x})` });
  assert.deepEqual(parseLtcXpubInput(JSON.stringify({ xpub: x, index: 0, id: `js:2:litecoin:${x}:segwit` }, null, 2)), { descriptor: `sh(wpkh(${x}))` });
  assert.equal(parseLtcXpubInput('M8X3Rv7ejYqW2RejxX52iiYe7ZYoZTryds'), null);
});
