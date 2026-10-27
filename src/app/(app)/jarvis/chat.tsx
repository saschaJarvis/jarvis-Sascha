'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { primeSpeech, speak, stopSpeaking, useDictation } from '@/components/voice';
import { askJarvisAction } from './chat-actions';

interface Turn { role: 'user' | 'assistant'; text: string; proposals?: string[]; error?: boolean }

const STARTERS = ['Was ist diese Woche wirklich wichtig?', 'Was muss ich vor der Abmeldung in Mainz erledigen?', 'Welche Unterlagen fehlen mir für Dubai?'];

export function JarvisChat({ consented, listenSignal = 0, id = 'ask' }: { consented: boolean; listenSignal?: number; id?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(consented);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, pending]);
  const [voiceReply, setVoiceReply] = useState(false); // Antworten vorlesen, wenn per Sprache gefragt
  const dict = useDictation((partial) => setText(partial), (final) => { setVoiceReply(true); send(final, true); });
  // Signal von außen (Jarvis-Knopf): sofort zuhören
  useEffect(() => { if (listenSignal > 0 && consent && dict.supported) dict.start(); }, [listenSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (q: string, byVoice = false) => {
    const question = q.trim();
    if (!question || pending) return;
    const history = turns.filter((t) => !t.error).map(({ role, text: t }) => ({ role, text: t }));
    setTurns((x) => [...x, { role: 'user', text: question }]);
    setText('');
    start(async () => {
      const r = await askJarvisAction({ question, history, consent });
      setTurns((x) => [...x, r.error ? { role: 'assistant', text: r.error, error: true } : { role: 'assistant', text: r.answer ?? '', proposals: r.proposals }]);
      if (byVoice || voiceReply) speak(r.error ?? r.answer ?? '');
      if (!r.error) setConsent(true);
    });
  };

  return (
    <section aria-label="Mit Jarvis sprechen" className="card grid gap-3">
      <p className="eyebrow">▸ Frag Claude</p>
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={!consent} className="btn btn-secondary min-h-9 px-3 text-[.66rem] normal-case tracking-normal">{s}</button>)}
        </div>
      )}
      <div className="grid gap-2" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'ml-8 justify-self-end border border-line bg-sea-soft/50 px-3 py-2' : `mr-4 border-l-2 px-3 py-1 ${t.error ? 'border-bad text-bad' : 'border-sea'}`}>
            <p className="mono mb-0.5 text-[.58rem] uppercase tracking-widest text-muted">{t.role === 'user' ? 'Du' : 'Jarvis'}</p>
            <p className="whitespace-pre-wrap leading-relaxed">{t.text}</p>
            {t.proposals && t.proposals.length > 0 && (
              <p className="mt-1 text-sm text-warn">→ {t.proposals.length} Vorschlag/Vorschläge im <Link href="/eingang" className="underline">Eingang</Link> zum Bestätigen</p>
            )}
          </div>
        ))}
        {pending && <p role="status" className="mono flex items-center gap-2 text-[.7rem] uppercase tracking-widest text-sea"><span className="blink inline-block h-2 w-2 bg-sea" /> Jarvis denkt nach …</p>}
        <div ref={endRef} />
      </div>
      {!consent && (
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#3fd2ff]" />
          <span>Einverstanden: Für Antworten sendet Jarvis eine Übersicht deiner Aufgaben, Verträge und Dokument-Zusammenfassungen an Claude (Anthropic). Claude kann nichts senden, kündigen oder bezahlen. Widerruf in den Einstellungen.</span>
        </label>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="grid gap-2">
        <label htmlFor={id} className="sr-only">Deine Frage</label>
        <textarea id={id} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="field resize-none"
          placeholder="Frag mich alles zu deinen Aufgaben, Verträgen, Dokumenten …"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <div className="flex gap-2">
          {dict.supported && (
            <button type="button" onClick={() => { stopSpeaking(); if (dict.listening) dict.stop(); else dict.start(); }} disabled={!consent || pending}
              aria-pressed={dict.listening} aria-label={dict.listening ? 'Zuhören beenden' : 'Sprechen'}
              className={`btn ${dict.listening ? 'btn-primary voice-live' : 'btn-secondary'} shrink-0 px-4`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" /></svg>
              <span className="ml-1.5">{dict.listening ? 'Hört zu …' : 'Sprechen'}</span>
            </button>
          )}
          <button type="submit" className="btn btn-primary flex-1" disabled={!consent || pending || !text.trim()}>Senden</button>
          <button type="button" onClick={() => { setVoiceReply((v) => { if (v) stopSpeaking(); else primeSpeech(); return !v; }); }} aria-pressed={voiceReply}
            aria-label={voiceReply ? 'Vorlesen aus' : 'Antworten vorlesen'} title={voiceReply ? 'Vorlesen aus' : 'Antworten vorlesen'}
            className={`btn ${voiceReply ? 'btn-primary' : 'btn-secondary'} shrink-0 px-3`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" />{voiceReply ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 5 6m0-6-5 6" />}</svg>
          </button>
        </div>
        {dict.error && <p className="text-sm text-warn">{dict.error}</p>}
      </form>
      <p className="text-xs text-muted">Antworten beruhen nur auf deinen Jarvis-Daten. Vorschläge landen im Eingang – nichts passiert ohne dich.</p>
    </section>
  );
}
