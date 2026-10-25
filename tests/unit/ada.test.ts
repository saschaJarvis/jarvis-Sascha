import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaAddressHint, isAdaAddress, stakeAddressOf } from '../../src/lib/crypto/ada';

test('Cardano: CIP-19-Testvektoren (Basisadresse → Stake-Adresse) und Prüfsumme', () => {
  const base = 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x';
  assert.equal(isAdaAddress(base), true);
  assert.equal(stakeAddressOf(base), 'stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw');
  const mine = 'addr1q8g0rkm9x7ngfe2zuxc5puln7gwxs8ztd07gdvjqs7vnslalrc5nq60py5nfqpthepapaltcsrcf3d2ph5welardfd8sgejn8q';
  assert.equal(isAdaAddress(mine), true);
  assert.match(stakeAddressOf(mine) ?? '', /^stake1u[02-9ac-hj-np-z]{50,}$/);
  assert.equal(isAdaAddress(mine.slice(0, -1) + 'p'), false);
  assert.equal(isAdaAddress('stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw'), false);
  assert.match(adaAddressHint('stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw') ?? '', /Stake-Adresse/);
});
