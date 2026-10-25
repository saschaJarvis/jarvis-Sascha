/**
 * Feingewicht bekannter Anlagemünzen, wenn die Rechnung kein Gewicht nennt.
 * Werte = Feingewicht je Stück in Gramm (Feingehalt dann 1000).
 * Reihenfolge zählt: spezifischere Namen zuerst (Half Sovereign vor Sovereign).
 */
const OZ = 31.1035;

const KNOWN: Array<{ re: RegExp; g: number }> = [
  { re: /half\s*sovereign|halbe?r?\s*sovereign|1\/2\s*sovereign/i, g: 3.6612 },
  { re: /sovereign/i, g: 7.3224 },
  { re: /10\s*(fr|franken)\b.*vreneli|vreneli.*10\s*(fr|franken)\b/i, g: 2.9032 },
  { re: /vreneli|20\s*(fr|franken)\b.*(helvetia|schweiz)/i, g: 5.8064 },
  { re: /napol[eé]on|marianne|20\s*(fr|francs?)\b.*(frankreich|france)/i, g: 5.8064 },
  { re: /4\s*dukaten/i, g: 13.7698 },
  { re: /dukat/i, g: 3.4425 },
  { re: /100\s*kronen/i, g: 30.4878 },
  { re: /20\s*(gold)?mark\b/i, g: 7.1685 },
  { re: /10\s*(gold)?mark\b/i, g: 3.5843 },
  { re: /50\s*pesos/i, g: 37.4999 },
];

/**
 * Anlageprodukte, die es standardmäßig nur bzw. fast nur in 1 oz gibt (Gold wie Silber) –
 * greift nur, wenn der Name keine Bruchteile nennt („1/2“, „halbe“, „1/10“ …).
 */
const ONE_OZ: RegExp[] = [
  /(dragon|drachen?)\b.*rectang|rectang.*\b(dragon|drachen?)\b/i, // Perth Mint Dragon Rectangle (Barren/Münze)
  /kr(ue|ü|u)gerrand/i, /maple\s*leaf/i, /britannia/i, /philharmoniker/i,
  /k(ae|ä|a)nguru|kangaroo|nugget/i, /american\s*(gold\s*|silver\s*)?eagle/i, /buffalo/i,
  /arche\s*noah|noah'?s\s*ark/i, /big\s*five/i, /libertad/i,
];
const FRACTION = /\b\d+\s*\/\s*\d+\b|\bhalbe?r?\b|\bhalf\b|\bviertel\b|\bquarter\b|\btenth\b/i;

/** Feingewicht aus dem Produktnamen: „1 oz“, „1/2 Unze“, „100 g“ oder eine bekannte Münze. null = unbekannt. */
export function knownFineWeight(product: string): number | null {
  const p = product.replace(',', '.');
  const oz = p.match(/(?:^|[^\d/.])(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(?:oz|unzen?|ounces?)\b/i);
  if (oz) {
    const n = Number(oz[1]) / (oz[2] ? Number(oz[2]) : 1);
    if (n > 0 && n <= 1000) return Math.round(n * OZ * 10000) / 10000;
  }
  // Bekannte Münzen vor Grammangaben: „Vreneli 6,45 g“ ist Rauhgewicht, das Feingewicht ist 5,8064 g
  for (const k of KNOWN) if (k.re.test(p)) return k.g;
  const g = p.match(/(?:^|[^\d/.])(\d+(?:\.\d+)?)\s*(?:g|gr|gramm)\b/i);
  if (g) {
    const n = Number(g[1]);
    if (n > 0 && n <= 1_000_000) return n;
  }
  if (!FRACTION.test(p) && !/\d\s*kg\b|kilo/i.test(p) && ONE_OZ.some((re) => re.test(p))) return OZ;
  return null;
}
