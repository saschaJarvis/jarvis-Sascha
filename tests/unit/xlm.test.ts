import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isXlmAddress, xlmAddressHint } from '../../src/lib/crypto/xlm';

test('Stellar: StrKey (Base32, Versionsbyte, CRC16-XModem)', () => {
  assert.equal(isXlmAddress('GAI6QCAKCQ4M6CAUW2SGYZ7Z4G5CNX2AUKHR2DU7KE6IWCSQREXYFKGE'), true);
  assert.equal(isXlmAddress('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'), true); // Circle USDC-Herausgeber
  assert.equal(isXlmAddress('GAI6QCAKCQ4M6CAUW2SGYZ7Z4G5CNX2AUKHR2DU7KE6IWCSQREXYFKGF'), false); // Tippfehler
  assert.equal(isXlmAddress('gai6qcakcq4m6cauw2sgyz7z4g5cnx2aukhr2du7ke6iwcsqrexyfkge'), false);
  assert.match(xlmAddressHint('GAI6QCAKCQ4M6CAUW2SGYZ7Z4G5CNX2AUKHR2DU7KE6IWCSQREXYFKGF') ?? '', /Prüfsumme/);
});
