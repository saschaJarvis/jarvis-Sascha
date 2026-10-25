import { test } from 'node:test';
import assert from 'node:assert/strict';
import { algoAddressHint, isAlgoAddress } from '../../src/lib/crypto/algo';

test('Algorand: Prüfsumme (SHA-512/256), Füllbits und Tippfehler', () => {
  assert.equal(isAlgoAddress('54DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PY'), true);
  assert.equal(isAlgoAddress('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'), true); // Null-Adresse (bekannt)
  assert.equal(isAlgoAddress('54DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PZ'), false); // Füllbit gesetzt
  assert.equal(isAlgoAddress('55DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PY'), false); // Tippfehler vorn
  assert.equal(isAlgoAddress('54dxjk2ix7heljkdx54ypuelbuxqkxoh74gktvu4sek46tdgzx32l3y5py'), false);
  assert.match(algoAddressHint('55DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PY') ?? '', /Prüfsumme/);
});
