/**
 * Prioritäts-Engine: kombiniert Dringlichkeit, Wirkung, Abhängigkeiten, Geld im Risiko, Aufwand, Gewissheit.
 * Jede Bewertung kommt mit einer lesbaren Begründung ("Warum steht das oben?").
 * Nutzer-Übersteuerung wird respektiert.
 */
import type { TaskStatus } from './taskStateMachine';

export interface PriorityTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt?: Date | null;
  dueIsHard?: boolean;
  urgency: number;           // 0..3
  impact: number;            // 0..3
  moneyAtRiskEur?: number;   // grob, bereits in EUR umgerechnet (nur für Gewichtung, nicht für Buchhaltung)
  effortMinutes?: number | null;
  certainty: 'detected' | 'inferred' | 'verified';
  blocksCount?: number;      // wie viele andere Aufgaben warten auf diese
  openDependencyCount?: number;
  userPriorityOverride?: number | null; // -3..+3
  snoozedUntil?: Date | null;
  nextStep?: string | null;
}

export interface Scored<T> { task: T; score: number; reasons: string[] }

const ACTIONABLE: readonly TaskStatus[] = ['READY', 'IN_PROGRESS', 'WAITING_FOR_USER', 'EVIDENCE_PENDING', 'NEEDS_REVIEW', 'DETECTED', 'BLOCKED', 'DISPUTED'];

export function scoreTask<T extends PriorityTask>(t: T, now: Date): Scored<T> {
  const reasons: string[] = [];
  let s = 0;

  s += t.urgency * 10;
  s += t.impact * 8;
  if (t.urgency >= 3) reasons.push('als kritisch markiert');

  if (t.dueAt) {
    const hours = (t.dueAt.getTime() - now.getTime()) / 3_600_000;
    if (hours < 0) { s += 40; reasons.push(`Frist seit ${Math.ceil(-hours / 24)} Tag(en) überschritten`); }
    else if (hours <= 48) { s += 30; reasons.push('Frist in den nächsten 48 Stunden'); }
    else if (hours <= 24 * 7) { s += 15; reasons.push('Frist diese Woche'); }
    else if (hours <= 24 * 30) { s += 5; }
    if (t.dueIsHard) { s += 10; reasons.push('feste (vertragliche/gesetzliche) Frist'); }
  }

  if (t.moneyAtRiskEur && t.moneyAtRiskEur > 0) {
    const m = Math.min(25, Math.round(Math.log10(t.moneyAtRiskEur + 1) * 6));
    s += m;
    if (t.moneyAtRiskEur >= 100) reasons.push(`ca. ${Math.round(t.moneyAtRiskEur).toLocaleString('de-DE')} € stehen auf dem Spiel`);
  }

  if (t.blocksCount && t.blocksCount > 0) {
    s += Math.min(20, t.blocksCount * 6);
    reasons.push(`${t.blocksCount} andere Aufgabe(n) warten darauf`);
  }

  if (t.openDependencyCount && t.openDependencyCount > 0) {
    s -= 50;
    reasons.push('erst Vorbedingung erledigen');
  }

  if (t.effortMinutes != null && t.effortMinutes <= 15) { s += 4; reasons.push('schnell erledigt'); }
  if (t.certainty !== 'verified') { s -= 5; reasons.push('Angaben noch unbestätigt'); }
  if (t.status === 'DETECTED' || t.status === 'NEEDS_REVIEW') s -= 5;
  if (t.status === 'BLOCKED') s -= 30;

  if (t.userPriorityOverride) {
    s += t.userPriorityOverride * 25;
    reasons.push(t.userPriorityOverride > 0 ? 'von dir hochgestuft' : 'von dir heruntergestuft');
  }
  return { task: t, score: s, reasons };
}

export interface TodayView<T> {
  doThisNow: Scored<T> | null;
  alsoUrgent: Scored<T>[];   // höchstens 2 (Startseite: 1 + 2)
  hiddenCount: number;
}

function sortScored<T extends PriorityTask>(a: Scored<T>, b: Scored<T>): number {
  if (b.score !== a.score) return b.score - a.score;
  const ad = a.task.dueAt?.getTime() ?? Infinity;
  const bd = b.task.dueAt?.getTime() ?? Infinity;
  if (ad !== bd) return ad - bd;
  return a.task.id.localeCompare(b.task.id);
}

export function buildTodayView<T extends PriorityTask>(tasks: readonly T[], now: Date): TodayView<T> {
  const candidates = tasks
    .filter((t) => ACTIONABLE.includes(t.status))
    .filter((t) => !t.snoozedUntil || t.snoozedUntil <= now)
    .map((t) => scoreTask(t, now))
    .sort(sortScored);
  const startable = candidates.filter((c) => !(c.task.openDependencyCount && c.task.openDependencyCount > 0) && c.task.status !== 'BLOCKED');
  const doThisNow = startable[0] ?? null;
  const alsoUrgent = candidates.filter((c) => c !== doThisNow && c.score >= 30).slice(0, 2);
  return { doThisNow, alsoUrgent, hiddenCount: Math.max(0, candidates.length - (doThisNow ? 1 : 0) - alsoUrgent.length) };
}

/** "Ich bin überfordert": genau EINE kleine Aufgabe (≤ 15 Min., bevorzugt ≤ 5), sonst die kleinste. */
export function overwhelmedPick<T extends PriorityTask>(tasks: readonly T[], now: Date): Scored<T> | null {
  const startable = tasks
    .filter((t) => ACTIONABLE.includes(t.status) && t.status !== 'BLOCKED' && !(t.openDependencyCount && t.openDependencyCount > 0))
    .filter((t) => !t.snoozedUntil || t.snoozedUntil <= now)
    .map((t) => scoreTask(t, now));
  if (startable.length === 0) return null;
  const tiny = startable.filter((c) => (c.task.effortMinutes ?? 999) <= 5).sort(sortScored);
  if (tiny[0]) return tiny[0];
  const small = startable.filter((c) => (c.task.effortMinutes ?? 999) <= 15).sort(sortScored);
  if (small[0]) return small[0];
  return startable.sort((a, b) => (a.task.effortMinutes ?? 999) - (b.task.effortMinutes ?? 999) || sortScored(a, b))[0];
}
