import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAccountInfo, dotAddressHint, isDotAddress, systemAccountKey, dotPublicKey, xxhash64 } from '../../src/lib/crypto/dot';

test('Polkadot: SS58 (Präfix 0, blake2b-Prüfsumme)', () => {
  assert.equal(isDotAddress('15zu9FsQU2kh9huuMA4zQrEtGcEUE99G9WHBbbwKVjWw7LX7'), true);
  assert.equal(isDotAddress('15zu9FsQU2kh9huuMA4zQrEtGcEUE99G9WHBbbwKVjWw7LX8'), false);
  assert.match(dotAddressHint('15zu9FsQU2kh9huuMA4zQrEtGcEUE99G9WHBbbwKVjWw7LX8') ?? '', /Prüfsumme/);
});

test('xxHash64 und Speicherschlüssel System.Account', () => {
  // Referenzwerte xxHash64: leer/Seed 0 = ef46db3751d8e999
  assert.equal(xxhash64(new Uint8Array(), 0n).toString(16), 'ef46db3751d8e999');
  // bekanntes Präfix: twox128("System") ‖ twox128("Account")
  const key = systemAccountKey(dotPublicKey('15zu9FsQU2kh9huuMA4zQrEtGcEUE99G9WHBbbwKVjWw7LX7')!);
  assert.ok(key.startsWith('0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9'));
  assert.equal(key.length, 2 + 64 + 32 + 64);
});

test('AccountInfo dekodieren', () => {
  const le = (v: bigint, n: number) => Array.from({ length: n }, (_, i) => ((v >> BigInt(8 * i)) & 0xffn).toString(16).padStart(2, '0')).join('');
  const hex = `0x${le(1n, 4)}${le(0n, 4)}${le(1n, 4)}${le(0n, 4)}${le(123456789012n, 16)}${le(5n, 16)}${le(7n, 16)}${le(0n, 16)}`;
  assert.deepEqual(decodeAccountInfo(hex), { free: 123456789012n, reserved: 5n, frozen: 7n });
  assert.deepEqual(decodeAccountInfo(null), { free: 0n, reserved: 0n, frozen: 0n });
});
