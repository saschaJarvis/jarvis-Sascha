/**
 * Erinnerungs- und Eskalationsplanung. Deterministisch, ohne LLM.
 * Grundsätze: Ruhezeiten, Tageslimit, Mindestabstand, Pause/Snooze, Notaus, Einwilligung pro Kanal,
 * feste Höchststufe (keine Endlosschleife), keine Kontaktaufnahme mit Dritten.
 */
import { isInQuietHours, localDateKey, nextAllowedInstant, toLocalParts, zonedToUtc, parseHHMM } from './time';
import type { TaskStatus } from './taskStateMachine';

export type Channel = 'in_app' | 'push' | 'email' | 'sms' | 'voice';
export type EscalationPolicy = 'none' | 'gentle' | 'standard' | 'critical';

export interface ReminderTask {
  id: string;
  title: string;
  nextStep?: string | null;
  status: TaskStatus;
  dueAt?: Date | null;
  escalationPolicy: EscalationPolicy;
  snoozedUntil?: Date | null;
}

export interface ReminderPrefs {
  timezone: string;
  quietStart: string;        // "21:30"
  quietEnd: string;          // "08:00"
  maxPerDay: number;
  minGapMinutes?: number;    // Mindestabstand zwischen zwei Benachrichtigungen (alle Aufgaben)
  pausedUntil?: Date | null;
  killSwitch: boolean;
  consentedChannels: ReadonlySet<Channel>; // in_app ist immer erlaubt
}

export interface ReminderHistory {
  /** Gesendete Erinnerungen zu DIESER Aufgabe seit der letzten Reaktion des Nutzers */
  sentForTaskSinceLastResponse: ReadonlyArray<{ at: Date; stage: number }>;
  /** Alle gesendeten Benachrichtigungen des Nutzers (für Tageslimit/Mindestabstand) */
  allSentRecently: ReadonlyArray<Date>;
}

export type ReminderDecision =
  | { kind: 'send'; at: Date; stage: number; channels: Channel[]; template: ReminderTemplate }
  | { kind: 'wait'; until: Date; reason: string }
  | { kind: 'stop'; reason: string };

export type ReminderTemplate = 'nudge' | 'clear_next_action' | 'offer_guided_help' | 'phone_call' | 'final_offer_delegate';

const HOUR = 3_600_000;

/** Abstände zwischen den Stufen (ab der vorherigen Erinnerung). Stufe 0 sofort. */
export const STAGE_GAPS_HOURS: Readonly<Record<Exclude<EscalationPolicy, 'none'>, readonly number[]>> = {
  gentle: [0, 24, 48, 72],
  standard: [0, 8, 24, 48, 48],
  critical: [0, 2, 6, 12, 24],
};

const STAGE_TEMPLATES: readonly ReminderTemplate[] = ['nudge', 'clear_next_action', 'offer_guided_help', 'phone_call', 'final_offer_delegate'];

function channelsForStage(stage: number, policy: EscalationPolicy, consented: ReadonlySet<Channel>): Channel[] {
  const out: Channel[] = ['in_app'];
  const has = (c: Channel) => consented.has(c);
  if (stage >= 1 && has('push')) out.push('push');
  if (stage >= 1 && !has('push') && has('email')) out.push('email');
  if (stage >= 2 && has('email') && !out.includes('email')) out.push('email');
  if (stage >= 3 && policy === 'critical' && has('sms')) out.push('sms');
  if (stage === 3 && policy === 'critical' && has('voice')) out.push('voice');
  return out;
}

function templateFor(stage: number, channels: Channel[]): ReminderTemplate {
  if (stage === 3 && channels.includes('voice')) return 'phone_call';
  if (stage === 3) return 'offer_guided_help';
  return STAGE_TEMPLATES[Math.min(stage, STAGE_TEMPLATES.length - 1)];
}

function startOfNextLocalDay(instant: Date, tz: string, quietEnd: string): Date {
  const p = toLocalParts(instant, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day) + 86_400_000);
  const e = parseHHMM(quietEnd);
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), e.h, e.m, tz);
}

export function planNextReminder(task: ReminderTask, prefs: ReminderPrefs, history: ReminderHistory, now: Date): ReminderDecision {
  if (prefs.killSwitch) return { kind: 'stop', reason: 'Notaus aktiv' };
  if (['CLOSED', 'VERIFIED', 'CANCELLED'].includes(task.status)) return { kind: 'stop', reason: 'Aufgabe ist erledigt' };
  if (task.status === 'WAITING_FOR_THIRD_PARTY') return { kind: 'stop', reason: 'Wartet auf Dritte – kein Nachhaken beim Nutzer' };
  if (task.escalationPolicy === 'none') return { kind: 'stop', reason: 'Keine Erinnerungen gewünscht' };
  if (prefs.maxPerDay <= 0) return { kind: 'stop', reason: 'Benachrichtigungen deaktiviert (Tageslimit 0)' };

  const gaps = STAGE_GAPS_HOURS[task.escalationPolicy];
  const sent = [...history.sentForTaskSinceLastResponse].sort((a, b) => a.at.getTime() - b.at.getTime());
  const stage = sent.length;
  if (stage >= gaps.length) {
    return { kind: 'stop', reason: 'Höchste Stufe erreicht – nur noch Angebot zur Hilfe/Delegation in der App, keine weiteren Nachrichten' };
  }

  // frühester Zeitpunkt nach Stufenabstand
  let at = stage === 0 ? now : new Date(Math.max(now.getTime(), sent[stage - 1].at.getTime() + gaps[stage] * HOUR));

  if (task.snoozedUntil && task.snoozedUntil > at) at = task.snoozedUntil;
  if (prefs.pausedUntil && prefs.pausedUntil > at) at = prefs.pausedUntil;

  // Mindestabstand zu jeder anderen Benachrichtigung
  const minGap = (prefs.minGapMinutes ?? 60) * 60_000;
  for (let guard = 0; guard < 50; guard++) {
    const before = at.getTime();
    at = nextAllowedInstant(at, prefs.timezone, prefs.quietStart, prefs.quietEnd);
    const conflict = history.allSentRecently.find((t) => Math.abs(t.getTime() - at.getTime()) < minGap);
    if (conflict) at = new Date(conflict.getTime() + minGap);
    // Tageslimit (lokaler Kalendertag)
    const dayKey = localDateKey(at, prefs.timezone);
    const sentThatDay = history.allSentRecently.filter((t) => localDateKey(t, prefs.timezone) === dayKey).length;
    if (sentThatDay >= prefs.maxPerDay) at = startOfNextLocalDay(at, prefs.timezone, prefs.quietEnd);
    if (at.getTime() === before) break;
  }
  if (isInQuietHours(at, prefs.timezone, prefs.quietStart, prefs.quietEnd)) {
    at = nextAllowedInstant(at, prefs.timezone, prefs.quietStart, prefs.quietEnd);
  }

  if (at.getTime() > now.getTime()) {
    const reason = task.snoozedUntil && task.snoozedUntil >= at ? 'Schlummern' :
      prefs.pausedUntil && prefs.pausedUntil >= at ? 'Pause' : 'Ruhezeit/Limit/Abstand';
    return { kind: 'wait', until: at, reason };
  }
  const channels = channelsForStage(stage, task.escalationPolicy, prefs.consentedChannels);
  return { kind: 'send', at, stage, channels, template: templateFor(stage, channels) };
}

/** Kurze, freundliche deutsche Texte – kein Druck, keine Schuldzuweisung, keine sensiblen Details. */
export function renderReminder(template: ReminderTemplate, task: Pick<ReminderTask, 'title' | 'nextStep'>): { title: string; body: string } {
  const step = task.nextStep?.trim();
  switch (template) {
    case 'nudge':
      return { title: 'Kurz erinnert', body: `${task.title}${step ? ` – nächster Schritt: ${step}` : ''}` };
    case 'clear_next_action':
      return { title: 'Ein kleiner Schritt reicht', body: step ? `Nur das: ${step}. Dauert meist wenige Minuten.` : `${task.title}: Öffne die Aufgabe, ich zeige dir den nächsten Schritt.` };
    case 'offer_guided_help':
      return { title: 'Sollen wir das zusammen machen?', body: `„${task.title}" Schritt für Schritt mit mir – oder auf später verschieben.` };
    case 'phone_call':
      return { title: 'Anruf von Jarvis (wie vereinbart)', body: `Jarvis ruft an, um bei „${task.title}" zu helfen. Keine Details am Telefon vor Anmeldung.` };
    case 'final_offer_delegate':
      return { title: 'Ich höre jetzt auf zu erinnern', body: `„${task.title}" bleibt in deiner Liste. Möchtest du es verschieben oder einer Vertrauensperson übergeben?` };
  }
}
