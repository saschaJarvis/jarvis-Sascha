import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomAddressHint, isAtomAddress } from '../../src/lib/crypto/atom';

test('Cosmos: Bech32-Prüfsumme, 20-Byte-Konto, Validator-Adresse abgewiesen', () => {
  assert.equal(isAtomAddress('cosmos157j07w635xgewawv94peaugsju2w4djcnxewn4'), true);
  assert.equal(isAtomAddress('cosmos157j07w635xgewawv94peaugsju2w4djcnxewn5'), false); // Tippfehler
  assert.equal(isAtomAddress('COSMOS157J07W635XGEWAWV94PEAUGSJU2W4DJCNXEWN4'), false);
  assert.match(atomAddressHint('cosmosvaloper1abc') ?? '', /Validator/);
  assert.match(atomAddressHint('cosmos157j07w635xgewawv94peaugsju2w4djcnxewn5') ?? '', /Prüfsumme/);
});
