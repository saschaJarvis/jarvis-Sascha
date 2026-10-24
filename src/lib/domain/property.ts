/**
 * Dubai-Immobilie: Plausibilitätsprüfungen gegen veröffentlichte Regeln.
 * Quelle LTV: CBUAE Rulebook, Regulations Regarding Mortgage Loans, Art. 3 (https://rulebook.centralbank.ae/node/2856),
 * abgerufen 24.10.2026. Ergebnis ist ein Hinweis „mit Bank klären", keine Zusage oder Ablehnung.
 */

export interface LtvInput {
  buyer: 'expat' | 'uae_national';
  stage: 'off_plan' | 'completed';
  use: 'first_home' | 'second_or_investment';
  valueAed: number;        // Kaufpreis/Wert in AED
  plannedLtvPct: number;   // geplante Finanzierungsquote
}

export interface LtvCheck {
  maxLtvPct: number;
  withinLimit: boolean;
  rule: string;
  source: string;
  message: string;
}

const SOURCE = 'CBUAE Rulebook, Mortgage Loans Art. 3 – rulebook.centralbank.ae/node/2856 (abgerufen 24.10.2026)';

export function ltvLimit(i: LtvInput): { max: number; rule: string } {
  if (i.stage === 'off_plan') return { max: 50, rule: 'Off-Plan: max. 50 % unabhängig von Käufer, Wert und Zweck' };
  if (i.use === 'second_or_investment') return i.buyer === 'expat'
    ? { max: 60, rule: 'Expat, Zweit-/Investitionsobjekt: max. 60 %' }
    : { max: 65, rule: 'UAE-Staatsangehörige, Zweit-/Investitionsobjekt: max. 65 %' };
  if (i.buyer === 'expat') return i.valueAed < 5_000_000
    ? { max: 80, rule: 'Expat, erste Immobilie, Wert unter 5 Mio. AED: max. 80 %' }
    : { max: 70, rule: 'Expat, erste Immobilie, Wert ab 5 Mio. AED: max. 70 % (Grenzfall genau 5 Mio. im Text nicht eindeutig)' };
  return i.valueAed <= 5_000_000
    ? { max: 85, rule: 'UAE-Staatsangehörige, erste Immobilie bis 5 Mio. AED: max. 85 %' }
    : { max: 75, rule: 'UAE-Staatsangehörige, erste Immobilie über 5 Mio. AED: max. 75 %' };
}

export function checkLtv(i: LtvInput): LtvCheck {
  const { max, rule } = ltvLimit(i);
  const within = i.plannedLtvPct <= max;
  return {
    maxLtvPct: max,
    withinLimit: within,
    rule,
    source: SOURCE,
    message: within
      ? `Geplante ${i.plannedLtvPct} % liegen innerhalb der veröffentlichten Obergrenze (${max} %). Verbindlich ist nur das Bankangebot.`
      : `Achtung: Geplante ${i.plannedLtvPct} % liegen über der veröffentlichten Obergrenze von ${max} % (${rule}). Bitte mit Bank/Mortgage-Berater klären, ob und ab wann die Finanzierung so möglich ist.`,
  };
}
