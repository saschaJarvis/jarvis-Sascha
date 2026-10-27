'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Spracheingabe (Diktat) und Vorlesen – beides direkt im Browser (Safari/Chrome), ohne Zusatzdienst. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;
const Recognition = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function useDictation(onPartial: (text: string) => void, onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec>(null);
  const cb = useRef({ onPartial, onFinal });
  cb.current = { onPartial, onFinal };
  useEffect(() => { setSupported(!!Recognition()); return () => rec.current?.abort?.(); }, []);

  const start = useCallback(() => {
    const R = Recognition();
    if (!R) return;
    rec.current?.abort?.();
    stopSpeaking();
    primeSpeech(); // iOS: Vorlesen muss einmal durch einen Tipp freigeschaltet werden
    const r = new R();
    r.lang = 'de-DE';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let final = '';
    r.onresult = (e: Rec) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      cb.current.onPartial((final + interim).trim());
    };
    r.onerror = (e: Rec) => {
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Mikrofon ist blockiert – bitte in den Einstellungen für diese Seite erlauben.'
        : e.error === 'no-speech' ? 'Ich habe nichts gehört – tipp nochmal aufs Mikrofon.' : null);
    };
    r.onend = () => { setListening(false); rec.current = null; if (final.trim()) cb.current.onFinal(final.trim()); };
    rec.current = r;
    setError(null);
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, []);

  const stop = useCallback(() => rec.current?.stop?.(), []);
  return { supported, listening, error, start, stop };
}

/** Antwort auf Deutsch vorlesen (Markdown-Zeichen werden entfernt). */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  const clean = text.replace(/[*_#`>|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'de-DE';
  const voices = synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('de'));
  u.voice = voices.find((v) => /premium|enhanced|natural/i.test(v.name)) ?? voices[0] ?? null;
  u.rate = 1.05;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Leere Äußerung im Tipp-Moment – danach darf Safari auch später (nach der Antwort) vorlesen. */
export function primeSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}
