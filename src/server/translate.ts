import 'server-only';
import { sha256Hex } from './crypto';
import { withService } from './db';
import { claudeAvailable, translateTexts } from './claude';

/**
 * Übersetzer für öffentliche Nachrichtentexte ins Deutsche.
 * Anbieter: DeepL (wenn DEEPL_API_KEY gesetzt) → sonst Claude (ANTHROPIC_API_KEY) → sonst keine Übersetzung.
 * Ergebnisse werden in app.translations gespeichert (jede Schlagzeile nur einmal übersetzen).
 */
export type Provider = 'deepl' | 'claude' | 'test';

export function translatorAvailable(): Provider | null {
  if (process.env.DEEPL_API_KEY) return 'deepl';
  if (claudeAvailable()) return process.env.CLAUDE_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase' ? 'test' : 'claude';
  return null;
}

async function deepl(texts: string[]): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY!;
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const r = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: { authorization: `DeepL-Auth-Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: 'DE', preserve_formatting: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const j = (await r.json()) as { translations: Array<{ text: string }> };
  return j.translations.map((t) => t.text);
}

const hash = (t: string) => sha256Hex(`de|${t}`);

/** Gespeicherte Übersetzungen nachschlagen; fehlende übersetzen (in Paketen) und speichern. */
export async function toGerman(texts: string[], opts: { translateMissing: boolean } = { translateMissing: true }): Promise<Map<string, string>> {
  const uniq = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length > 1 && t.length <= 2000))];
  const result = new Map<string, string>();
  if (uniq.length === 0) return result;
  const rows = await withService((q) => q<{ src_hash: string; translated: string }>(
    'select src_hash, translated from app.translations where src_hash = any($1)', [uniq.map(hash)]), 'owner');
  const byHash = new Map(rows.map((r) => [r.src_hash, r.translated]));
  const missing: string[] = [];
  for (const t of uniq) { const hit = byHash.get(hash(t)); if (hit) result.set(t, hit); else missing.push(t); }

  const provider = translatorAvailable();
  if (!opts.translateMissing || !provider || missing.length === 0) return result;
  for (let i = 0; i < missing.length; i += 40) {
    const chunk = missing.slice(i, i + 40);
    try {
      const out = provider === 'deepl' ? await deepl(chunk) : await translateTexts(chunk);
      const vals = chunk.map((src, k) => [hash(src), src, out[k]] as const).filter(([, , de]) => de && de.length <= 4000);
      vals.forEach(([, src, de]) => result.set(src, de));
      if (vals.length) {
        await withService((q) => q(
          `insert into app.translations (src_hash, source_text, translated, provider)
           select * from unnest($1::text[], $2::text[], $3::text[], $4::text[]) on conflict (src_hash) do nothing`,
          [vals.map((v) => v[0]), vals.map((v) => v[1]), vals.map((v) => v[2]), vals.map(() => provider)]), 'owner');
      }
    } catch (e) {
      console.error('[übersetzen]', (e as Error).message);
      break; // Rest beim nächsten Aufruf
    }
  }
  return result;
}
