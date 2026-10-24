import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotp, verifyTotp, base32Encode, base32Decode, counterAt } from '../../src/lib/totp';

// RFC 6238 Anhang B – SHA1, Schlüssel "12345678901234567890", 8 Ziffern
const RFC_KEY = Buffer.from('12345678901234567890');
const vectors: Array<[number, string]> = [
  [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
  [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
];

test('TOTP: RFC-6238-Testvektoren', () => {
  for (const [t, code] of vectors) assert.equal(hotp(RFC_KEY, counterAt(t * 1000), 8), code, `t=${t}`);
});

test('TOTP: Base32 hin und zurück', () => {
  const b = Buffer.from('Jarvis-Test-Geheimnis');
  assert.deepEqual(base32Decode(base32Encode(b)), b);
});

test('TOTP: Fenster ±1, Replay abgelehnt, falscher Code abgelehnt', () => {
  const secret = base32Encode(RFC_KEY);
  const now = 1_800_000_000_000;
  const code = hotp(RFC_KEY, counterAt(now));
  const ctr = verifyTotp(secret, code, now);
  assert.equal(ctr, counterAt(now));
  assert.equal(verifyTotp(secret, code, now + 30_000), counterAt(now), 'vorheriges Fenster noch gültig');
  assert.equal(verifyTotp(secret, code, now + 90_000), null, 'zu alt');
  assert.equal(verifyTotp(secret, code, now, { lastCounter: ctr }), null, 'Replay');
  assert.equal(verifyTotp(secret, '000000', now) === null || hotp(RFC_KEY, counterAt(now)) === '000000', true);
  assert.equal(verifyTotp(secret, 'abc', now), null);
});
