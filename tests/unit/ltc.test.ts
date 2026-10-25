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
