/**
 * Kündigungs-Pipeline. MUSS identisch sein mit app.cancellation_transitions
 * (supabase/migrations/20261024000300_contracts_cancellation_notifications.sql).
 */

export const CANCELLATION_STATUSES = [
  'DETECTED', 'TERMS_REVIEW', 'DRAFT', 'USER_REVIEW', 'APPROVED', 'SENT',
  'DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED', 'BLOCKED', 'ERROR', 'DISPUTED',
] as const;
export type CancellationStatus = (typeof CANCELLATION_STATUSES)[number];

export const CANCELLATION_TRANSITIONS: Readonly<Record<CancellationStatus, readonly CancellationStatus[]>> = {
  DETECTED: ['TERMS_REVIEW', 'BLOCKED'],
  TERMS_REVIEW: ['DRAFT', 'BLOCKED'],
  DRAFT: ['USER_REVIEW', 'TERMS_REVIEW', 'BLOCKED'],
  USER_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['SENT', 'DRAFT', 'ERROR'],
  SENT: ['DELIVERY_EVIDENCE', 'ERROR', 'DISPUTED'],
  DELIVERY_EVIDENCE: ['CONFIRMED', 'DISPUTED'],
  CONFIRMED: ['CLOSED', 'DISPUTED'],
  CLOSED: [],
  BLOCKED: ['TERMS_REVIEW', 'DRAFT'],
  ERROR: ['DRAFT', 'USER_REVIEW'],
  DISPUTED: ['DRAFT', 'DELIVERY_EVIDENCE', 'CONFIRMED'],
};

export type ClosureItemState = 'open' | 'done' | 'not_applicable';

export interface CancellationGateContext {
  hasDraft: boolean;
  hasDispatchChannel: boolean;
  /** Freigabe existiert, ist an den aktuellen Entwurfs-Hash gebunden, mit Step-up, < 15 Min. alt */
  hasFreshBoundApproval: boolean;
  /** Versand (real bzw. bei Demo simuliert) ist als dispatched/delivered verbucht */
  hasDispatchRecord: boolean;
  closureChecklist: Readonly<Record<string, ClosureItemState>>;
}

export function canTransitionCancellation(
  from: CancellationStatus, to: CancellationStatus, ctx: CancellationGateContext,
): { ok: true } | { ok: false; reason: string } {
  if (!CANCELLATION_TRANSITIONS[from].includes(to)) return { ok: false, reason: `Ungültiger Schritt ${from} -> ${to}` };
  if (to === 'USER_REVIEW' && (!ctx.hasDraft || !ctx.hasDispatchChannel)) {
    return { ok: false, reason: 'Zur Prüfung braucht es einen Entwurf und einen Versandweg' };
  }
  if (to === 'APPROVED' && !ctx.hasFreshBoundApproval) {
    return { ok: false, reason: 'Freigabe fehlt oder ist abgelaufen – bitte mit Authenticator bestätigen' };
  }
  if (to === 'SENT' && !ctx.hasDispatchRecord) {
    return { ok: false, reason: 'Kein Versandnachweis vorhanden' };
  }
  if (to === 'CLOSED') {
    const entries = Object.entries(ctx.closureChecklist);
    const open = entries.filter(([, v]) => v !== 'done' && v !== 'not_applicable');
    if (entries.length === 0 || open.length > 0) {
      return { ok: false, reason: `Abschluss-Checkliste unvollständig: ${open.map(([k]) => k).join(', ') || 'leer'}` };
    }
  }
  return { ok: true };
}

/** Stufenanzeige für die UI (Fortschrittsleiste) */
export const CANCELLATION_STEPS_DE: ReadonlyArray<{ status: CancellationStatus; label: string }> = [
  { status: 'DETECTED', label: 'Erkannt' },
  { status: 'TERMS_REVIEW', label: 'Bedingungen prüfen' },
  { status: 'DRAFT', label: 'Entwurf' },
  { status: 'USER_REVIEW', label: 'Deine Prüfung' },
  { status: 'APPROVED', label: 'Freigegeben' },
  { status: 'SENT', label: 'Versendet' },
  { status: 'DELIVERY_EVIDENCE', label: 'Zustellnachweis' },
  { status: 'CONFIRMED', label: 'Bestätigt' },
  { status: 'CLOSED', label: 'Abgeschlossen' },
];
