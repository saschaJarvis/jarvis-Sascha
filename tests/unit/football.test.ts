import { test } from 'node:test';
import assert from 'node:assert/strict';
import { form, matchAlertsDue, previewText, resultLine, toMatch, type OldbMatch } from '../../src/lib/domain/football';

const T = (id: number, name: string) => ({ teamId: id, teamName: name });
const mk = (id: number, utc: string, t1: [number, string], t2: [number, string], score?: [number, number], group = '8. Spieltag'): OldbMatch => ({
  matchID: id, matchDateTimeUTC: utc, leagueShortcut: 'bl1', group: { groupName: group }, team1: T(...t1), team2: T(...t2),
  matchIsFinished: !!score, matchResults: score ? [{ resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 0 }, { resultTypeID: 2, pointsTeam1: score[0], pointsTeam2: score[1] }] : [],
});
const W: [number, string] = [134, 'SV Werder Bremen'], H: [number, string] = [175, 'TSG Hoffenheim'];
const next = mk(1, '2026-10-31T14:30:00Z', W, H);
const all = [
  mk(2, '2026-10-24T13:30:00Z', [81, '1. FSV Mainz 05'], W, [2, 3], '7. Spieltag'),
  mk(3, '2026-10-17T13:30:00Z', W, [31, 'SC Paderborn 07'], [2, 2], '6. Spieltag'),
  mk(4, '2026-10-24T13:30:00Z', H, [7, 'Borussia Dortmund'], [0, 1], '7. Spieltag'),
  next,
];

test('Spiel ohne Werder wird ignoriert, Heim/Gegner erkannt', () => {
  assert.equal(toMatch(all[2]), null);
  const m = toMatch(next)!;
  assert.equal(m.werderHome, true);
  assert.equal(m.opponent.teamName, 'TSG Hoffenheim');
});

test('Form aus Werder-Sicht, neuestes zuerst', () => {
  assert.deepEqual(form(all, 134, new Date('2026-10-31T00:00:00Z')), ['S', 'U']);
  assert.deepEqual(form(all, 175, new Date('2026-10-31T00:00:00Z')), ['N']);
});

test('Vorschau: Anstoß in Dubai- und deutscher Zeit, Tabelle, Form', () => {
  const txt = previewText(toMatch(next)!, { tz: 'Asia/Dubai', all, table: [
    { teamInfoId: 40, teamName: 'Bayern', points: 17, matches: 7, goals: 0, opposingGoals: 0 },
    { teamInfoId: 134, teamName: 'Werder', points: 12, matches: 7, goals: 0, opposingGoals: 0 },
    { teamInfoId: 175, teamName: 'Hoffenheim', points: 9, matches: 7, goals: 0, opposingGoals: 0 }] });
  assert.match(txt, /Bundesliga, 8\. Spieltag · Heimspiel/);
  assert.match(txt, /18:30 Uhr Dubai \(15:30 Uhr in Deutschland\)/);
  assert.match(txt, /Werder 2\. \(12 Pkt\.\) · TSG Hoffenheim 3\. \(9 Pkt\.\)/);
  assert.match(txt, /Werder S U · TSG Hoffenheim N/);
  assert.match(txt, /Weserstadion/);
});

test('Erinnerungen: 13 Uhr Vorschau, 30 Min. vorher, Ergebnis nach Abpfiff', () => {
  const m = toMatch(next)!;
  const at = (iso: string) => matchAlertsDue(m, new Date(iso), 'Asia/Dubai').map((a) => a.stage);
  assert.deepEqual(at('2026-10-31T08:59:00Z'), []);            // 12:59 Dubai
  assert.deepEqual(at('2026-10-31T09:00:00Z'), ['preview']);   // 13:00 Dubai
  assert.deepEqual(at('2026-10-31T14:05:00Z'), ['kickoff']);   // 18:05 Dubai
  assert.deepEqual(at('2026-10-31T14:30:00Z'), []);
  const done = toMatch(mk(1, '2026-10-31T14:30:00Z', W, H, [1, 2]))!;
  assert.deepEqual(matchAlertsDue(done, new Date('2026-10-31T16:30:00Z'), 'Asia/Dubai').map((a) => a.stage), ['result']);
  assert.equal(resultLine(done), 'Niederlage: SV Werder Bremen 1:2 TSG Hoffenheim');
  // Frühes Spiel (11:30 Dubai): Vorschau spätestens 2 h vorher
  const early = toMatch(mk(9, '2026-11-01T07:30:00Z', W, H))!;
  assert.deepEqual(matchAlertsDue(early, new Date('2026-11-01T05:30:00Z'), 'Asia/Dubai').map((a) => a.stage), ['preview']);
});
