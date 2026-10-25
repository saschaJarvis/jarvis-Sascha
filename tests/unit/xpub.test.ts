import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDescriptor, isExtendedKey, keyOfDescriptor, parseAccountKey, descriptorOf } from '../../src/lib/crypto/xpub';

const BTC = 'xpub6C5i8T8Wfq9TMEoGUMsCdMYmaamuP1KU2zLjBbBKkoahGJ9e6WVv8epvn8mKjAZxW1ZEGrQe8AhkbmYVwcjPwkLJap8mgtAfEjSt7ivFMiP';
const LTC = 'Ltub2ZJwTmmz3ghZFeYF68fWLc5qXGqTjuAM9byyZ1DeN4b98ZAYoJyLUHzegPsSv3h4ajBk5bCtyf2P8r4PY6vttW92kKNrB99QLjymXjmb7S3';

test('Kontoschlüssel: Prüfsumme und Versionsbytes', () => {
  assert.equal(isExtendedKey(BTC), true);
  assert.equal(isExtendedKey(LTC), true);
  assert.equal(isExtendedKey(`${BTC.slice(0, -1)}Q`), false);
});

test('Ledger-Export: Coin und Kontoart aus der id', () => {
  assert.deepEqual(parseAccountKey(JSON.stringify({ xpub: BTC, index: 0, id: `js:2:bitcoin:${BTC}:segwit` }, null, 2)), { coin: 'btc', key: BTC, scheme: 'sh(wpkh)' });
  assert.deepEqual(parseAccountKey(JSON.stringify({ xpub: BTC, id: `js:2:bitcoin:${BTC}:native_segwit` })), { coin: 'btc', key: BTC, scheme: 'wpkh' });
  assert.deepEqual(parseAccountKey(JSON.stringify({ xpub: LTC, id: `js:2:litecoin:${LTC}:segwit` })), { coin: 'ltc', key: LTC, scheme: 'sh(wpkh)' });
  assert.deepEqual(parseAccountKey(JSON.stringify({ xpub: BTC, id: `js:2:zcash:${BTC}:` })), { coin: 'zec', key: BTC, scheme: 'pkh' });
  assert.match((parseAccountKey(JSON.stringify({ xpub: BTC, id: `js:2:dogecoin:${BTC}:` })) as { error: string }).error, /dogecoin/);
});

test('Nackte Schlüssel und normale Adressen', () => {
  assert.deepEqual(parseAccountKey(BTC), { coin: 'btc', key: BTC, scheme: 'auto' });
  assert.deepEqual(parseAccountKey(LTC), { coin: 'ltc', key: LTC, scheme: 'sh(wpkh)' });
  assert.equal(parseAccountKey('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), null);
  const d = descriptorOf(BTC, 'sh(wpkh)');
  assert.equal(isDescriptor(d), true);
  assert.equal(keyOfDescriptor(d), BTC);
});
