/**
 * Aufgaben-Zustandsmaschine (V2). MUSS identisch sein mit app.task_transitions
 * (supabase/migrations/20261024000200_tasks_documents.sql) – geprüft durch scripts/check-transition-parity.ts.
 * Die Datenbank erzwingt die Regeln zusätzlich (Defense in Depth); die UI nutzt diese Datei,
 * um nur erlaubte Knöpfe anzuzeigen.
 */

export const TASK_STATUSES = [
  'DETECTED', 'NEEDS_REVIEW', 'READY', 'IN_PROGRESS',
  'WAITING_FOR_USER', 'WAITING_FOR_THIRD_PARTY', 'EVIDENCE_PENDING',
  'VERIFIED', 'CLOSED', 'BLOCKED', 'DISPUTED', 'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  DETECTED: ['NEEDS_REVIEW', 'READY', 'CANCELLED'],
  NEEDS_REVIEW: ['READY', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_THIRD_PARTY', 'EVIDENCE_PENDING', 'BLOCKED', 'CLOSED', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'WAITING_FOR_USER', 'WAITING_FOR_THIRD_PARTY', 'EVIDENCE_PENDING', 'BLOCKED', 'CLOSED', 'CANCELLED'],
  WAITING_FOR_USER: ['IN_PROGRESS', 'READY', 'EVIDENCE_PENDING', 'BLOCKED', 'CANCELLED'],
  WAITING_FOR_THIRD_PARTY: ['IN_PROGRESS', 'READY', 'EVIDENCE_PENDING', 'BLOCKED', 'CANCELLED'],
  EVIDENCE_PENDING: ['VERIFIED', 'IN_PROGRESS', 'DISPUTED', 'BLOCKED'],
  VERIFIED: ['CLOSED', 'DISPUTED'],
  BLOCKED: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  DISPUTED: ['IN_PROGRESS', 'EVIDENCE_PENDING', 'CANCELLED'],
  CLOSED: ['READY'],
  CANCELLED: ['READY'],
};

export const INITIAL_TASK_STATUSES: readonly TaskStatus[] = ['DETECTED', 'NEEDS_REVIEW', 'READY'];
export const OPEN_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter((s) => !['CLOSED', 'CANCELLED', 'VERIFIED'].includes(s));
const DEPENDENCY_GATED: readonly TaskStatus[] = ['IN_PROGRESS', 'EVIDENCE_PENDING', 'VERIFIED', 'CLOSED'];

export interface TaskGateContext {
  evidenceRequired: boolean;
  acceptedEvidenceCount: number;
  openDependencyCount: number;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function canTransition(from: TaskStatus, to: TaskStatus, ctx: TaskGateContext): TransitionResult {
  if (from === to) return { ok: false, reason: 'Status unverändert' };
  if (!TASK_TRANSITIONS[from].includes(to)) return { ok: false, reason: `Ungültiger Statuswechsel ${from} -> ${to}` };
  if (DEPENDENCY_GATED.includes(to) && ctx.openDependencyCount > 0) {
    return { ok: false, reason: `Erst ${ctx.openDependencyCount} Vorbedingung(en) erledigen` };
  }
  if (to === 'VERIFIED' && ctx.acceptedEvidenceCount === 0) {
    return { ok: false, reason: 'Für „bestätigt" fehlt ein akzeptierter Nachweis' };
  }
  if (to === 'CLOSED' && from !== 'VERIFIED' && ctx.evidenceRequired) {
    return { ok: false, reason: 'Diese Aufgabe braucht einen Nachweis, bevor sie abgeschlossen wird' };
  }
  return { ok: true };
}

/** Deutsche Bezeichnungen für die UI (Klartext statt Statuscodes). */
export const TASK_STATUS_LABEL_DE: Readonly<Record<TaskStatus, string>> = {
  DETECTED: 'Erkannt – bitte prüfen',
  NEEDS_REVIEW: 'Zu prüfen',
  READY: 'Bereit',
  IN_PROGRESS: 'In Arbeit',
  WAITING_FOR_USER: 'Wartet auf dich',
  WAITING_FOR_THIRD_PARTY: 'Wartet auf andere',
  EVIDENCE_PENDING: 'Nachweis fehlt',
  VERIFIED: 'Bestätigt',
  CLOSED: 'Erledigt',
  BLOCKED: 'Blockiert',
  DISPUTED: 'Strittig',
  CANCELLED: 'Verworfen',
};

/** Welche Aktionen die UI anbieten soll ("eine Handlung"): die sinnvollste zuerst. */
export function primaryActionFor(status: TaskStatus, evidenceRequired: boolean): { label: string; to: TaskStatus } | null {
  switch (status) {
    case 'DETECTED':
    case 'NEEDS_REVIEW':
      return { label: 'Stimmt so – übernehmen', to: 'READY' };
    case 'READY':
    case 'BLOCKED':
      return { label: 'Jetzt anfangen', to: 'IN_PROGRESS' };
    case 'IN_PROGRESS':
    case 'WAITING_FOR_USER':
    case 'WAITING_FOR_THIRD_PARTY':
      return evidenceRequired ? { label: 'Erledigt – Nachweis hochladen', to: 'EVIDENCE_PENDING' } : { label: 'Erledigt', to: 'CLOSED' };
    case 'VERIFIED':
      return { label: 'Abschließen', to: 'CLOSED' };
    default:
      return null;
  }
}
