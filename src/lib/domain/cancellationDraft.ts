/**
 * Deutscher Kündigungsentwurf + Prüfpunkte. Erfindet NICHTS: Unbekanntes wird als
 * „[BITTE ERGÄNZEN: …]" markiert und als fehlend gemeldet; ein Freigeben ist erst ohne Platzhalter möglich.
 * Rechtliche Hinweise sind Prüfpunkte, keine Rechtsberatung (Quellen: docs/RESEARCH_DE_UAE.md).
 */

export type ContractCategory =
  | 'residential_lease' | 'commercial_lease' | 'storage' | 'telecom' | 'energy' | 'insurance'
  | 'subscription' | 'banking' | 'membership' | 'vehicle' | 'other';

export interface DraftContract {
  name: string;
  category: ContractCategory;
  counterpartyName?: string | null;
  counterpartyAddress?: string | null;
  contractNumber?: string | null;
  /** nur setzen, wenn aus Vertrag/Recht BELEGT (certainty = verified) */
  verifiedEndDate?: string | null;
  objectAddress?: string | null;     // Mietobjekt / Lagerraum
  concludedOnline?: boolean | null;
  /** weitere Mieter/Vertragsparteien – alle müssen unterschreiben (R4) */
  coTenants?: string[] | null;
  /** befristeter Gewerbemietvertrag? true = ordentlich nicht kündbar (R5); null = unbekannt */
  fixedTerm?: boolean | null;
  /** Lagerraum: Mietvertrag oder Verwahrung? (R6) */
  storageContractType?: 'lease' | 'custody' | null;
}

export interface Sender { fullName?: string | null; address?: string | null; city?: string | null }

export type CheckState = 'open' | 'ok' | 'warn';
export interface DraftCheck { id: string; label: string; detail: string; state: CheckState }

export interface DraftResult {
  subject: string;
  body: string;
  missing: string[];
  recommendedChannel: 'postal_registered' | 'postal_courier' | 'email' | 'online_button';
  requiresWetSignature: boolean;
  checks: DraftCheck[];
  /** harte Hindernisse: solange nicht leer, darf der Entwurf nicht zur Freigabe */
  blockers: string[];
  /** automatisch anzulegende Folgeaufgaben (z. B. Auslieferungsbeleg anfordern, R10) */
  followUpTasks: string[];
  closureChecklist: Record<string, 'open'>;
}

const PH = (what: string) => `[BITTE ERGÄNZEN: ${what}]`;

function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

export function hasPlaceholders(text: string): boolean {
  return /\[BITTE ERGÄNZEN:/.test(text);
}

export function buildCancellationDraft(c: DraftContract, sender: Sender, today: string): DraftResult {
  const missing: string[] = [];
  const need = (v: string | null | undefined, label: string) => {
    if (v && v.trim()) return v.trim();
    missing.push(label);
    return PH(label);
  };

  const isResidential = c.category === 'residential_lease';
  const isLease = isResidential || c.category === 'commercial_lease' || c.category === 'storage';
  const consumerTextForm = ['telecom', 'energy', 'insurance', 'subscription', 'membership'].includes(c.category);

  const senderName = need(sender.fullName, 'dein vollständiger Name');
  const senderAddr = need(sender.address, 'deine aktuelle Anschrift');
  const recipient = need(c.counterpartyName, 'Name des Vertragspartners (laut Vertrag)');
  const recipientAddr = need(c.counterpartyAddress, 'Anschrift des Vertragspartners (laut Vertrag/Impressum)');
  const contractRef = c.contractNumber?.trim() ? `Vertrags-/Kundennummer: ${c.contractNumber.trim()}` : `Vertrags-/Kundennummer: ${need(null, 'Vertrags- oder Kundennummer (falls vorhanden)')}`;
  const objectLine = isLease ? `Objekt: ${need(c.objectAddress, 'Adresse/Bezeichnung des Miet- bzw. Lagerobjekts')}` : null;

  const endPhrase = c.verifiedEndDate
    ? `zum ${fmtDate(c.verifiedEndDate)}, hilfsweise zum nächstmöglichen Zeitpunkt`
    : 'fristgerecht zum nächstmöglichen Zeitpunkt';

  const confirmations = [
    'eine schriftliche Bestätigung der Kündigung unter Angabe des genauen Beendigungszeitpunkts',
  ];
  if (isLease) {
    confirmations.push('einen Terminvorschlag für die Übergabe einschließlich Übergabeprotokoll');
    confirmations.push('Angaben zur Abrechnung und Rückzahlung der Kaution');
  } else {
    confirmations.push('die Bestätigung, dass nach Vertragsende keine weiteren Abbuchungen erfolgen');
  }

  const subject = `Kündigung: ${c.name}`;
  const body = [
    `${senderName}`,
    `${senderAddr}`,
    '',
    `${recipient}`,
    `${recipientAddr}`,
    '',
    `${sender.city?.trim() || PH('Ort')}, ${fmtDate(today)}`,
    '',
    `Kündigung – ${c.name}`,
    contractRef,
    ...(objectLine ? [objectLine] : []),
    '',
    'Sehr geehrte Damen und Herren,',
    '',
    `hiermit kündige ich den oben genannten Vertrag ${endPhrase}.`,
    '',
    `Bitte senden Sie mir ${confirmations.slice(0, -1).join(', ')} sowie ${confirmations[confirmations.length - 1]}.`,
    '',
    'Mit freundlichen Grüßen',
    '',
    ...(isLease
      ? [senderName, ...(c.coTenants ?? []).filter((n) => n.trim())].flatMap((n) => ['', '______________________________', `${n} (eigenhändige Unterschrift)`])
      : [senderName]),
  ].join('\n');
  const blockers: string[] = [];
  const followUpTasks: string[] = [];

  const checks: DraftCheck[] = [];
  checks.push({
    id: 'identity', label: 'Vertragspartner und Vertragsnummer stimmen mit dem Vertrag überein',
    detail: 'Mit dem Originalvertrag oder der letzten Rechnung abgleichen.', state: missing.some((m) => m.includes('Vertragspartner')) ? 'open' : 'warn',
  });
  checks.push({
    id: 'notice_period', label: 'Kündigungsfrist geprüft',
    detail: c.verifiedEndDate ? `Beendigungsdatum ${fmtDate(c.verifiedEndDate)} ist als belegt markiert – Beleg noch einmal ansehen.`
      : 'Kein belegtes Enddatum. Der Entwurf kündigt „zum nächstmöglichen Zeitpunkt". Frist im Vertrag nachlesen.',
    state: c.verifiedEndDate ? 'ok' : 'open',
  });
  if (isResidential) {
    checks.push({ id: 'form', label: 'Schriftform: eigenhändig unterschriebener Brief',
      detail: 'Wohnraum-Kündigung braucht die gesetzliche Schriftform (§ 568 BGB). E-Mail, Fax, Scan oder Messenger genügen nicht.', state: 'warn' });
    checks.push({ id: 'deadline_rule', label: 'Frist ab Zugang beim Vermieter rechnen',
      detail: 'Gesetzlich: Zugang spätestens am 3. Werktag eines Monats, Ende mit Ablauf des übernächsten Monats (§ 573c BGB). Samstag vorsichtshalber nicht mitzählen und Postlaufzeit einplanen.', state: 'warn' });
    checks.push({ id: 'no_special_right', label: 'Kein Sonderkündigungsrecht wegen Auswanderung',
      detail: 'Alternativen: ordentliche Kündigung, Aufhebungsvertrag anfragen, Nachmieterklausel prüfen.', state: 'warn' });
    if ((c.coTenants ?? []).length > 0) {
      checks.push({ id: 'co_tenants', label: 'Alle Mieter müssen unterschreiben', detail: `Unterschriftsfelder für: ${[sender.fullName ?? 'dich', ...(c.coTenants ?? [])].join(', ')}`, state: 'open' });
    }
  } else if (c.category === 'commercial_lease') {
    checks.push({ id: 'form', label: 'Form laut Vertrag (meist Schriftform vereinbart)',
      detail: 'Das Gesetz schreibt für die Gewerbekündigung keine Form vor, fast jeder Vertrag aber schon. Standard: unterschriebener Brief. Unterzeichner = Vertragspartei (du persönlich oder deine Firma).', state: 'warn' });
    if (c.fixedTerm === true) {
      blockers.push('Befristeter Gewerbemietvertrag: bis zum Laufzeitende ordentlich nicht kündbar – bitte anwaltlich prüfen lassen');
    } else if (c.fixedTerm == null) {
      checks.push({ id: 'fixed_term', label: 'Befristet oder unbefristet?',
        detail: 'Nur bei unbefristetem Vertrag gilt die gesetzliche Frist (§ 580a Abs. 2 BGB). Befristet = meist nicht ordentlich kündbar.', state: 'open' });
    }
  } else if (c.category === 'storage') {
    checks.push({ id: 'form', label: 'Form laut Lagervertrag', detail: 'Form und Frist stehen im Vertrag. Sicherster Weg: unterschriebener Brief.', state: 'warn' });
    if (!c.storageContractType) {
      checks.push({ id: 'contract_type', label: 'Vertragstyp erfassen (Miete oder Verwahrung)',
        detail: 'Ohne Vertragstyp und Frist rechnet Jarvis kein Enddatum aus.', state: 'open' });
    }
    checks.push({ id: 'lien', label: 'Räumung vor Vertragsende; offene Miete vermeiden',
      detail: 'Bei Mietrückständen kann der Vermieter die eingelagerten Sachen zurückhalten (Pfandrecht).', state: 'warn' });
  } else if (consumerTextForm) {
    checks.push({ id: 'form', label: 'Textform genügt in der Regel (E-Mail möglich)',
      detail: c.concludedOnline ? 'Online geschlossen: Der Anbieter muss einen Kündigungsbutton anbieten (§ 312k BGB). Bestätigung speichern.'
        : 'Bei Verbraucherverträgen darf meist keine strengere Form als Textform verlangt werden (§ 309 Nr. 13 BGB). Vertrag prüfen.', state: 'warn' });
  } else {
    checks.push({ id: 'form', label: 'Form der Kündigung im Vertrag nachlesen', detail: 'Unbekannte Vertragsart – Form nicht geraten.', state: 'open' });
  }
  checks.push({ id: 'proof', label: 'Zugangsnachweis planen',
    detail: isLease ? 'Einwurf-Einschreiben (danach Auslieferungsbeleg bei der Post anfordern – der Online-Status allein beweist den Zugang nicht, BAG 2 AZR 68/24) oder Bote mit Botenprotokoll. Kopie des unterschriebenen Briefes aufbewahren.'
      : 'Sendebestätigung/Eingangsbestätigung speichern und als Nachweis hochladen. Ohne Eingangsbestätigung nachhaken.', state: 'open' });
  if (isLease) followUpTasks.push('Auslieferungsbeleg zum Einwurf-Einschreiben bei der Deutschen Post anfordern');
  else followUpTasks.push('Eingangsbestätigung des Anbieters prüfen und hochladen');
  checks.push({ id: 'advice', label: 'Bei Unsicherheit: Beratung',
    detail: 'Jarvis ersetzt keine Rechtsberatung (z. B. Mieterverein, IHK, Anwalt).', state: 'warn' });

  const closure: Record<string, 'open'> = isLease
    ? { written_confirmation: 'open', handover_protocol: 'open', keys_returned: 'open', final_invoice: 'open', deposit: 'open' }
    : { written_confirmation: 'open', final_invoice: 'open', no_further_debits: 'open' };

  return {
    subject, body, missing,
    recommendedChannel: isLease ? 'postal_registered' : c.concludedOnline ? 'online_button' : consumerTextForm ? 'email' : 'postal_registered',
    requiresWetSignature: isResidential || c.category === 'commercial_lease' || c.category === 'storage',
    checks,
    blockers,
    followUpTasks,
    closureChecklist: closure,
  };
}
