/**
 * Prüft, dass die Zustandsmaschinen in TypeScript und in der Datenbank identisch sind.
 * Aufruf: tsx scripts/check-transition-parity.ts  (nutzt psql, DB aus PG*-Variablen, Standard jarvis_test)
 */
import { execFileSync } from 'node:child_process';
import { TASK_TRANSITIONS } from '../src/lib/domain/taskStateMachine';
import { CANCELLATION_TRANSITIONS } from '../src/lib/domain/cancellationStateMachine';

const db = process.env.TEST_DB ?? 'jarvis_test';
const env = { ...process.env, PGHOST: process.env.PGHOST ?? '/tmp', PGPORT: process.env.PGPORT ?? '54322', PGUSER: process.env.PGUSER ?? 'postgres' };

function fromDb(table: string): Set<string> {
  const out = execFileSync('psql', ['-X', '-t', '-A', '-d', db, '-c', `select from_status || '>' || to_status from app.${table}`], { env, encoding: 'utf8' });
  return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
}
function fromTs(map: Readonly<Record<string, readonly string[]>>): Set<string> {
  return new Set(Object.entries(map).flatMap(([f, tos]) => tos.map((t) => `${f}>${t}`)));
}
function compare(name: string, a: Set<string>, b: Set<string>): boolean {
  const onlyTs = [...a].filter((x) => !b.has(x));
  const onlyDb = [...b].filter((x) => !a.has(x));
  if (onlyTs.length || onlyDb.length) {
    console.error(`✗ ${name}: nur in TS: ${onlyTs.join(', ') || '–'} | nur in DB: ${onlyDb.join(', ') || '–'}`);
    return false;
  }
  console.log(`✓ ${name}: ${a.size} Übergänge identisch`);
  return true;
}

const ok = [
  compare('Aufgaben', fromTs(TASK_TRANSITIONS), fromDb('task_transitions')),
  compare('Kündigungen', fromTs(CANCELLATION_TRANSITIONS), fromDb('cancellation_transitions')),
].every(Boolean);
process.exit(ok ? 0 : 1);
