import { test } from 'node:test';
import assert from 'node:assert/strict';
import { btcAddressHint, isBtcAddress } from '../../src/lib/crypto/btc';

test('BTC-Adressen: Legacy, P2SH, SegWit (BIP-173), Taproot (BIP-350) inkl. Prüfsumme', () => {
  for (const a of [
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',                                    // Genesis
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',                                    // P2SH
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',                            // BIP-173
    'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',                            // Großschreibung erlaubt
    'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',        // P2WSH
    'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',        // Taproot
    '33ewns94qWVhzfPVwWTuHh5zNNTKihEKUU',
  ]) assert.equal(isBtcAddress(a), true, a);
  for (const a of [
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb',
    '33ewns94qWVhzfPVwWTuHh5zNNTKihEKUV',
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
    'bc1qW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',                            // gemischt
    'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj1',
    'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  ]) assert.equal(isBtcAddress(a), false, a);
  assert.match(btcAddressHint('xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz') ?? '', /erweiterter/);
});
