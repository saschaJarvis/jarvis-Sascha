import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceOfData, ethAddressHint, fromUnits, isEthAddress, toChecksumAddress } from '../../src/lib/crypto/eth';

test('ETH-Adresse: EIP-55-Prüfsumme (Referenzvektoren) und Tippfehler', () => {
  for (const a of ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359', '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB', '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb']) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a);
    assert.equal(isEthAddress(a), true);
  }
  assert.equal(isEthAddress('0x11A429C59856c4bF5fB029B7c1d7139456357886'), true);
  assert.equal(isEthAddress('0x11a429c59856c4bf5fb029b7c1d7139456357886'), true);   // nur klein: ohne Prüfsumme
  assert.equal(isEthAddress('0x11A429C59856c4bF5fB029B7c1d7139456357887'), false);
  assert.equal(isEthAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'), false);   // Groß/klein vertauscht
  assert.match(ethAddressHint('0x' + 'a'.repeat(64)) ?? '', /PRIVATER SCHLÜSSEL/);
});

test('ETH: Einheiten und balanceOf-Aufruf', () => {
  assert.equal(fromUnits('0xde0b6b3a7640000', 18), 1);          // 1 ETH
  assert.equal(fromUnits('0x1bc16d674ec80000', 18), 2);
  assert.equal(fromUnits('0x5f5e100', 6), 100);                  // 100 USDT
  assert.equal(fromUnits('0x', 18), 0);
  assert.equal(balanceOfData('0x11A429C59856c4bF5fB029B7c1d7139456357886'), '0x70a0823100000000000000000000000011a429c59856c4bf5fb029b7c1d7139456357886');
});

test('ETH: ABI-String dekodieren (symbol())', async () => {
  const { decodeAbiString } = await import('../../src/lib/crypto/eth');
  const hex = '0x' + '20'.padStart(64, '0') + '3'.padStart(64, '0') + Buffer.from('QNT').toString('hex').padEnd(64, '0');
  assert.equal(decodeAbiString(hex), 'QNT');
  assert.equal(decodeAbiString('0x'), null);
});
