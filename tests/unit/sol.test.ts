import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSolAddress } from '../../src/lib/crypto/sol';
import { isBtcAddress } from '../../src/lib/crypto/btc';

test('Solana: Base58 mit genau 32 Byte, keine Verwechslung mit Bitcoin', () => {
  assert.equal(isSolAddress('3QeuZeQijQjA6FHkBXNQihYUrbck9n23e8DnG1RCB8ug'), true);
  assert.equal(isSolAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), true);
  assert.equal(isSolAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), false); // Bitcoin (25 Byte)
  assert.equal(isBtcAddress('3QeuZeQijQjA6FHkBXNQihYUrbck9n23e8DnG1RCB8ug'), false);
  assert.equal(isSolAddress('3QeuZeQijQjA6FHkBXNQihYUrbck9n23e8DnG1RCB8u0'), false); // 0 ist kein Base58
});
