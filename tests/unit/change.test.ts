import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portfolioChange, priceAgo, relChange } from '../../src/lib/domain/change';

test('24 h: Preis vor 24 h aus Stundenkerzen, relative Änderung', () => {
  const now = 1_800_000_000;
  const candles = Array.from({ length: 30 }, (_, i) => [now - (29 - i) * 3600, String(100 + i), '0', '0', '0'] as [number, string, string, string, string]);
  assert.equal(priceAgo(candles, now), 105);          // Kerze bei now−24h → Index 5
  assert.ok(Math.abs((relChange(110, 100) ?? 0) - 0.1) < 1e-12);
  assert.equal(relChange(110, null), null);
});

test('Portfolio: +10 % auf 1.100 € = +100 € (+10 %); Stablecoins ohne Änderung verwässern', () => {
  const a = portfolioChange([{ valueNow: 1100, change: 0.1 }]);
  assert.ok(Math.abs(a.abs - 100) < 1e-9 && Math.abs((a.pct ?? 0) - 0.1) < 1e-12);
  const b = portfolioChange([{ valueNow: 1100, change: 0.1 }, { valueNow: 1000, change: 0 }]);
  assert.ok(Math.abs(b.abs - 100) < 1e-9 && Math.abs((b.pct ?? 0) - 0.05) < 1e-12);
  const c = portfolioChange([{ valueNow: 900, change: -0.1 }]);
  assert.ok(Math.abs(c.abs + 100) < 1e-9);
});
