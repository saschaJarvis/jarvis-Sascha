/**
 * Robuster CSV-Parser (RFC 4180 + Bank-Eigenheiten: Semikolon, BOM, Kopfzeilen-Vorspann, CRLF).
 * Keine Abhängigkeiten. Liefert Zeilen mit Zeilennummer für Provenienz.
 */

export interface CsvRow { line: number; cells: string[] }

export function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const lines = sample.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  const score = (d: string) => {
    const counts = lines.map((l) => l.split(d).length - 1);
    const max = Math.max(...counts, 0);
    const consistent = counts.filter((c) => c === max).length;
    return max > 0 ? consistent * 10 + max : 0;
  };
  const cands: Array<',' | ';' | '\t'> = [';', ',', '\t'];
  return cands.sort((a, b) => score(b) - score(a))[0];
}

export function parseCsv(text: string, delimiter?: string): CsvRow[] {
  const src = text.replace(/^﻿/, '');
  const d = delimiter ?? detectDelimiter(src);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') { inQuotes = true; continue; }
    if (ch === d) { cells.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') {
      cells.push(cell);
      if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowStart, cells });
      cells = []; cell = ''; line++; rowStart = line;
      continue;
    }
    cell += ch;
  }
  if (inQuotes) throw new Error(`CSV: nicht geschlossenes Anführungszeichen ab Zeile ${rowStart}`);
  cells.push(cell);
  if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowStart, cells });
  return rows;
}

/** Datum aus Bankformaten -> YYYY-MM-DD. Unterstützt TT.MM.JJJJ, TT.MM.JJ, JJJJ-MM-TT, TT/MM/JJJJ. */
export function parseDate(s: string): string {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(t))) {
    d = +m[1]; mo = +m[2]; y = +m[3];
    if (m[3].length === 2) y += y >= 70 ? 1900 : 2000;
  } else throw new Error(`Datum nicht lesbar: "${s}"`);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new Error(`Ungültiges Datum: "${s}"`);
  return dt.toISOString().slice(0, 10);
}
