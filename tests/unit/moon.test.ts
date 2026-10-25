import { test } from 'node:test';
import assert from 'node:assert/strict';
import SunCalc from 'suncalc';
import { DUBAI, moonCrossings, moonState, nextPhase, phaseName, sunVector, zonedMidnight } from '../../src/lib/moon';

const hours = (a: Date, b: string) => Math.abs(a.getTime() - Date.parse(b)) / 3_600_000;

test('Mitternacht Dubai = 20:00 UTC am Vortag', () => {
  assert.equal(zonedMidnight(new Date('2026-10-25T09:00:00Z'), 'Asia/Dubai').toISOString(), '2026-10-24T20:00:00.000Z');
  assert.equal(zonedMidnight(new Date('2026-10-25T21:30:00Z'), 'Asia/Dubai').toISOString(), '2026-10-25T20:00:00.000Z');
});

test('Voll-/Neumond auf wenige Minuten genau (Referenzen: Finsternisse + MoonGiant)', () => {
  const near = (d: Date, ref: string) => assert.ok(Math.abs(d.getTime() - Date.parse(ref)) < 4 * 60_000, `${d.toISOString()} ≠ ${ref}`);
  near(nextPhase(new Date('2026-10-25T09:00:00Z'), 0.5), '2026-10-26T04:11:00Z');
  near(nextPhase(new Date('2024-04-01T00:00:00Z'), 0), '2024-04-08T18:21:00Z');   // totale Sonnenfinsternis
  near(nextPhase(new Date('2025-03-01T00:00:00Z'), 0.5), '2025-03-14T06:55:00Z'); // totale Mondfinsternis
  assert.ok(hours(nextPhase(new Date('2026-10-25T09:00:00Z'), 0), '2026-11-09T07:02:00Z') < 0.1);
});

test('Phase: 19 Std. vor Vollmond „zunehmend“, 16 Std. davor „Vollmond“, danach abnehmend', () => {
  const m = moonState(new Date('2026-10-25T09:00:00Z'));
  assert.equal(m.waxing, true);
  assert.ok(m.fraction > 0.95, String(m.fraction));
  assert.equal(m.name, 'Zunehmender Mond');
  assert.equal(moonState(new Date('2026-10-25T12:00:00Z')).emoji, '🌕');
  const later = moonState(new Date('2026-10-30T12:00:00Z'));
  assert.equal(later.waxing, false);
  assert.equal(later.name, 'Abnehmender Mond');
});

test('Auf-/Untergang: Höhe am Ereignis ≈ Horizont, Reihenfolge plausibel', () => {
  const from = new Date('2026-10-24T20:00:00Z');
  const ev = moonCrossings(from, new Date(from.getTime() + 48 * 3_600_000), DUBAI.lat, DUBAI.lon);
  assert.ok(ev.length >= 3);
  for (const e of ev) {
    const a = SunCalc.getMoonPosition(e.at, DUBAI.lat, DUBAI.lon).altitude * 180 / Math.PI;
    assert.ok(Math.abs(a - 0.133) < 0.3, `${e.kind} ${e.at.toISOString()} alt ${a}`);
  }
  for (let i = 1; i < ev.length; i++) assert.notEqual(ev[i].kind, ev[i - 1].kind);
  // Fast-Vollmond geht etwa bei Sonnenuntergang auf (Dubai ~17:40 Ortszeit = 13:40 UTC)
  const rise = ev.find((e) => e.kind === 'rise')!;
  const local = (rise.at.getUTCHours() + 4) % 24;
  assert.ok(local >= 15 && local <= 19, rise.at.toISOString());
});

test('Darstellung: Neumond dunkel, Vollmond hell, zunehmender Halbmond rechts (Nordhimmel, Zenit oben)', () => {
  assert.ok(sunVector({ fraction: 0, brightLimbFromZenith: 0 })[2] < -0.99);
  assert.ok(sunVector({ fraction: 1, brightLimbFromZenith: 0 })[2] > 0.99);
  const v = sunVector({ fraction: 0.5, brightLimbFromZenith: -Math.PI / 2 });
  assert.ok(v[0] > 0.99 && Math.abs(v[2]) < 1e-9);
  assert.deepEqual(phaseName(0.25), { name: 'Erstes Viertel', emoji: '🌓' });
});

test('Sonne Dubai 25.10.2026: Tageslänge 11:24 (tutiempo.net, ±4 Min.), Aufgang/Untergang plausibel', async () => {
  const { sunState, litPath, limbRotationDeg } = await import('../../src/lib/moon');
  const s = sunState(new Date('2026-10-25T09:00:00Z'));
  const local = (d: Date) => (d.getUTCHours() + 4) * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(s.dayLengthMin - (11 * 60 + 24)) <= 4, String(s.dayLengthMin));
  assert.ok(Math.abs(local(s.sunrise) - (6 * 60 + 22)) <= 10, s.sunrise.toISOString());
  assert.ok(Math.abs(local(s.sunset) - (17 * 60 + 45)) <= 10, s.sunset.toISOString());
  assert.equal(s.up, true);
  assert.equal(sunState(new Date('2026-10-25T18:00:00Z')).up, false); // 22:00 Dubai
  assert.equal(litPath(0, 50), '');
  assert.match(litPath(1, 50), /A50 50 0 1 1/);
  assert.match(litPath(0.25, 50), /A25\.000 50 0 0 0 0 -50Z$/); // Sichel
  assert.match(litPath(0.75, 50), /A25\.000 50 0 0 1 0 -50Z$/); // Dreiviertel
  assert.ok(Math.abs(limbRotationDeg(-Math.PI / 2) - 0) < 1e-9);   // Rand rechts
  assert.ok(Math.abs(limbRotationDeg(0) - -90) < 1e-9);            // Rand oben
});
