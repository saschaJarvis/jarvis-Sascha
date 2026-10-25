import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isZecAddress, zecAddressHint } from '../../src/lib/crypto/zec';

test('Zcash: transparente Adresse (t1/t3), Base58Check mit 2-Byte-Präfix', () => {
  assert.equal(isZecAddress('t1UA2L6TuriDk82o8oPNvtWAA3BqdxGKcUX'), true);
  assert.equal(isZecAddress('t1UA2L6TuriDk82o8oPNvtWAA3BqdxGKcUY'), false); // Tippfehler
  assert.equal(isZecAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), false);  // Bitcoin
  assert.match(zecAddressHint('zs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq') ?? '', /abgeschirmte/);
  assert.match(zecAddressHint('t1UA2L6TuriDk82o8oPNvtWAA3BqdxGKcUY') ?? '', /Prüfsumme/);
});
