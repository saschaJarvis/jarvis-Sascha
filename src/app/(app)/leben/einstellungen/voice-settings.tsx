'use client';
import { useMemo, useState, useTransition } from 'react';
import { previewVoice, stopSpeaking } from '@/components/voice';
import { createSiriTokenAction, revokeSiriTokenAction, saveVoiceAction, type VoiceState } from './voice-actions';
import { ErrorNote, OkNote } from '@/components/form';

export interface VoiceOption { id: string; name: string; info: string; mine: boolean }
export interface VoiceConfig {
  connected: boolean;
  listError: string | null;
  voices: VoiceOption[];
  current: { id: string; name: string; speed: number; quality: 'fast' | 'best' };
  quota: { used: number; limit: number; resetsAt: string | null; tier: string } | null;
  tokens: Array<{ id: string; label: string; created: string; lastUsed: string | null }>;
  baseUrl: string;
}

const SAMPLE = 'Guten Morgen, Sascha. Heute stehen drei Dinge an – das Wichtigste zuerst: die Abmeldung in Mainz.';

export function VoiceSettings({ cfg }: { cfg: VoiceConfig }) {
  return (
    <div className="grid gap-3">
      <VoiceCard cfg={cfg} />
      <SiriCard cfg={cfg} />
    </div>
  );
}

function VoiceCard({ cfg }: { cfg: VoiceConfig }) {
  const [voiceId, setVoiceId] = useState(cfg.current.id);
  const [speed, setSpeed] = useState(cfg.current.speed);
  const [quality, setQuality] = useState<'fast' | 'best'>(cfg.current.quality);
  const [state, setState] = useState<VoiceState>();
  const [pending, start] = useTransition();
  const [playing, setPlaying] = useState(false);
  const name = useMemo(() => cfg.voices.find((v) => v.id === voiceId)?.name ?? cfg.current.name, [voiceId, cfg]);
  const changed = voiceId !== cfg.current.id || speed !== cfg.current.speed || quality !== cfg.current.quality;

  if (!cfg.connected) {
    return (
      <div className="card grid gap-2 text-sm">
        <p className="font-semibold">🔊 Stimme (ElevenLabs)</p>
        <p>Status: <strong>nicht verbunden</strong> – Jarvis liest mit der iPhone-Stimme vor.</p>
        <p className="text-muted">Zum Verbinden den ElevenLabs-Schlüssel bei Vercel als <span className="mono">ELEVENLABS_API_KEY</span> eintragen und neu bereitstellen. Danach erscheint hier die Stimmenauswahl.</p>
      </div>
    );
  }

  const listen = async () => {
    setPlaying(true); setState(undefined);
    const err = await previewVoice(SAMPLE, voiceId, speed, quality).catch(() => 'Probehören fehlgeschlagen.');
    if (err) setState({ error: err });
    setPlaying(false);
  };

  return (
    <div className="card grid gap-3 text-sm">
      <p className="font-semibold">🔊 Stimme (ElevenLabs) · <span className="text-good">verbunden</span></p>
      {cfg.quota && (
        <div className="grid gap-1">
          <div className="flex justify-between text-xs text-muted">
            <span>Guthaben {cfg.quota.tier ? `(${cfg.quota.tier})` : ''}</span>
            <span className="hud-num">{cfg.quota.used.toLocaleString('de-DE')} / {cfg.quota.limit.toLocaleString('de-DE')} Zeichen</span>
          </div>
          <div className="h-1.5 bg-line"><div className={`h-full ${cfg.quota.used / cfg.quota.limit > 0.85 ? 'bg-warn' : 'bg-sea'}`} style={{ width: `${Math.min(100, (cfg.quota.used / Math.max(1, cfg.quota.limit)) * 100)}%` }} /></div>
          {cfg.quota.resetsAt && <p className="text-xs text-muted">Neues Guthaben ab {new Date(cfg.quota.resetsAt).toLocaleDateString('de-DE')}. Ist es leer, liest automatisch die iPhone-Stimme.</p>}
        </div>
      )}
      {cfg.listError ? <p className="text-warn">{cfg.listError}</p> : (
        <label className="grid gap-1">
          <span className="text-muted">Stimme</span>
          <select className="field" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
            {cfg.voices.some((v) => v.mine) && <optgroup label="Meine Stimmen">{cfg.voices.filter((v) => v.mine).map((v) => <option key={v.id} value={v.id}>{v.name}{v.info ? ` – ${v.info}` : ''}</option>)}</optgroup>}
            <optgroup label="Standardstimmen (sprechen alle Deutsch)">{cfg.voices.filter((v) => !v.mine).map((v) => <option key={v.id} value={v.id}>{v.name}{v.info ? ` – ${v.info}` : ''}</option>)}</optgroup>
            {!cfg.voices.some((v) => v.id === voiceId) && <option value={voiceId}>{cfg.current.name}</option>}
          </select>
        </label>
      )}
      <label className="grid gap-1">
        <span className="flex justify-between text-muted"><span>Tempo</span><span className="hud-num">{speed.toFixed(2).replace('.', ',')}×</span></span>
        <input type="range" min={0.7} max={1.2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="accent-[#3fd2ff]" />
      </label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qualität">
        {([['fast', 'Schnell', 'antwortet flott, halbes Guthaben'], ['best', 'Beste Qualität', 'natürlicher, langsamer']] as const).map(([k, l, d]) => (
          <button key={k} type="button" role="radio" aria-checked={quality === k} onClick={() => setQuality(k)}
            className={`card text-left ${quality === k ? 'border-sea' : ''}`}><span className="font-semibold">{l}</span><br /><span className="text-xs text-muted">{d}</span></button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={playing ? () => { stopSpeaking(); setPlaying(false); } : listen}>{playing ? '■ Stopp' : '▶ Probehören'}</button>
        <button type="button" className="btn btn-primary flex-1" disabled={!changed || pending}
          onClick={() => start(async () => setState(await saveVoiceAction({ voiceId, voiceName: name, speed, quality })))}>Speichern</button>
      </div>
      <ErrorNote error={state?.error} />
      <OkNote message={state?.ok} />
      <p className="text-xs text-muted">Weitere Stimmen: in der ElevenLabs-App unter „Voices“ → „Voice Library“ eine Stimme (Filter: Deutsch) zu „My Voices“ hinzufügen – sie erscheint dann hier oben.</p>
    </div>
  );
}

function SiriCard({ cfg }: { cfg: VoiceConfig }) {
  const [state, setState] = useState<VoiceState>();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const url = `${cfg.baseUrl}/api/siri${cfg.connected ? '?stimme=1' : ''}`;
  const copy = async (t: string) => { await navigator.clipboard.writeText(t).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div id="siri" className="card grid scroll-mt-20 gap-3 text-sm">
      <p className="font-semibold">🎙️ Siri: „Hey Siri, Jarvis“</p>
      <p className="text-muted">Ein persönlicher Schlüssel erlaubt dem Siri-Kurzbefehl, Jarvis Fragen zu stellen – sonst nichts. Jederzeit sperrbar.</p>
      <div className="grid gap-1">
        <span className="text-muted">Adresse für den Kurzbefehl</span>
        <button type="button" onClick={() => copy(url)} className="field mono break-all text-left text-xs">{url}</button>
      </div>
      {state?.token ? (
        <div className="grid gap-2 border border-warn p-2">
          <p className="text-warn">Dein Schlüssel – nur jetzt sichtbar. Kopieren und im Kurzbefehl bei „Authorization“ hinter „Bearer “ einfügen:</p>
          <button type="button" onClick={() => copy(state.token!)} className="field mono break-all text-left text-xs">{state.token}</button>
          <p className="text-xs text-muted">{copied ? '✓ kopiert' : 'Tippen zum Kopieren'}</p>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => start(async () => setState(await createSiriTokenAction('iPhone')))}>Neuen Siri-Schlüssel erstellen</button>
      )}
      {state?.needCode && (
        <p className="notice notice-info">Zur Sicherheit bitte kurz deinen Authenticator-Code bestätigen: <a className="underline" href={`/sicherheit/code?weiter=${encodeURIComponent('/leben/einstellungen#siri')}&grund=${encodeURIComponent('Siri-Schlüssel gibt Lesezugriff auf deine Daten.')}`}>Code eingeben</a> – dann nochmal tippen.</p>
      )}
      <ErrorNote error={state?.error} />
      {cfg.tokens.length > 0 && (
        <ul className="grid gap-1.5">
          {cfg.tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 border-t border-line pt-1.5">
              <span>{t.label} · seit {t.created}{t.lastUsed ? ` · zuletzt ${t.lastUsed}` : ' · noch nie benutzt'}</span>
              <button type="button" className="btn btn-quiet text-bad" onClick={() => start(async () => setState(await revokeSiriTokenAction(t.id)))}>Sperren</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
