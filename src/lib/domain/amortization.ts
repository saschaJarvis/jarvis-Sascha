/**
 * Tilgungsplan (Annuitätendarlehen, monatliche Raten) – exakt mit rationaler BigInt-Arithmetik.
 * WICHTIG: Nur mit echtem Zins/Laufzeit aus dem Bankangebot verwenden. Banken rechnen teils mit Tageszins
 * oder anderen Rundungen; verbindlich ist ausschließlich der Plan der Bank. Diese Rechnung ist eine Prognose.
 */
import { divRoundHalfAwayFromZero } from './money';

export interface LoanInput {
  principalMinor: bigint;
  annualRateBps: number;   // 450 = 4,50 % p. a. nominal
  termMonths: number;
}

export interface ScheduleRow {
  month: number;
  paymentMinor: bigint;
  interestMinor: bigint;
  principalMinor: bigint;
  balanceAfterMinor: bigint;
}

export interface Schedule {
  monthlyPaymentMinor: bigint;
  rows: ScheduleRow[];
  totalInterestMinor: bigint;
  totalPaidMinor: bigint;
  assumptions: string[];
}

const MONTHS_X_BPS = 120_000n; // 12 Monate × 10.000 bps

export function annuityPayment({ principalMinor: L, annualRateBps, termMonths: n }: LoanInput): bigint {
  if (L <= 0n) throw new Error('Darlehensbetrag muss positiv sein');
  if (!Number.isInteger(n) || n < 1 || n > 600) throw new Error('Laufzeit 1–600 Monate');
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 5000) throw new Error('Zins 0–50 % in Basispunkten');
  const bps = BigInt(annualRateBps);
  if (bps === 0n) return divRoundHalfAwayFromZero(L, BigInt(n));
  const A = MONTHS_X_BPS + bps;
  const B = MONTHS_X_BPS;
  const An = A ** BigInt(n);
  const Bn = B ** BigInt(n);
  // P = L * r * (1+r)^n / ((1+r)^n - 1), r = bps / 120000
  return divRoundHalfAwayFromZero(L * bps * An, MONTHS_X_BPS * (An - Bn));
}

export function amortizationSchedule(input: LoanInput): Schedule {
  const payment = annuityPayment(input);
  const bps = BigInt(input.annualRateBps);
  const rows: ScheduleRow[] = [];
  let balance = input.principalMinor;
  let totalInterest = 0n;
  let totalPaid = 0n;
  for (let m = 1; m <= input.termMonths; m++) {
    const interest = divRoundHalfAwayFromZero(balance * bps, MONTHS_X_BPS);
    let principal = payment - interest;
    let pay = payment;
    if (m === input.termMonths || principal >= balance) {
      principal = balance;           // letzte Rate gleicht Rundungsdifferenzen aus
      pay = principal + interest;
    }
    balance -= principal;
    totalInterest += interest;
    totalPaid += pay;
    rows.push({ month: m, paymentMinor: pay, interestMinor: interest, principalMinor: principal, balanceAfterMinor: balance });
    if (balance === 0n) break;
  }
  return {
    monthlyPaymentMinor: payment,
    rows,
    totalInterestMinor: totalInterest,
    totalPaidMinor: totalPaid,
    assumptions: [
      'Monatliche Annuität, Nominalzins / 12, kaufmännische Rundung je Monat',
      'Letzte Rate gleicht Rundungsdifferenzen aus',
      'Keine Gebühren, Versicherungen, Zinsänderungen oder Sondertilgungen berücksichtigt',
      'Verbindlich ist nur der Tilgungsplan der Bank',
    ],
  };
}
