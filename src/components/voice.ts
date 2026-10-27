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

// Cloud-Stimme (ElevenLabs) über /api/tts – wird von der App eingeschaltet, wenn der Schlüssel hinterlegt ist
let cloud = false;
export function setCloudVoice(enabled: boolean) { cloud = enabled; }

let audio: HTMLAudioElement | null = null;
let lastUrl: string | null = null;
const player = () => (audio ??= typeof Audio !== 'undefined' ? new Audio() : null);

/** Antwort auf Deutsch vorlesen: ElevenLabs, falls verbunden – sonst (oder bei Fehler) die Gerätestimme. */
export function speak(text: string) {
  if (typeof window === 'undefined' || !text) return;
  stopSpeaking();
  if (cloud) {
    fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const a = player();
        if (!a) throw new Error();
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(await r.blob());
        a.src = lastUrl;
        await a.play();
      })
      .catch(() => deviceSpeak(text));
    return;
  }
  deviceSpeak(text);
}

/** Bestimmte Stimme probehören (Einstellungen). */
export async function previewVoice(text: string, voiceId: string, speed: number, quality: 'fast' | 'best'): Promise<string | null> {
  primeSpeech();
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, voiceId, speed, quality }) });
  if (!r.ok) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Probehören fehlgeschlagen.';
  const a = player();
  if (!a) return null;
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(await r.blob());
  a.src = lastUrl;
  await a.play().catch(() => {});
  return null;
}

function deviceSpeak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const clean = text.replace(/[*_#`>|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'de-DE';
  const voices = synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('de'));
  u.voice = voices.find((v) => /premium|enhanced|natural/i.test(`${v.name} ${v.voiceURI}`)) ?? voices[0] ?? null;
  u.rate = 1.05;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  audio?.pause();
}

/** Leere Äußerung im Tipp-Moment – danach darf Safari auch später (nach der Antwort) vorlesen. */
export function primeSpeech() {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
  // Audio-Element im Tipp-Moment mit Stille starten – danach darf es die ElevenLabs-Antwort abspielen
  const a = player();
  if (a && a.paused) { a.src = SILENCE; a.play().catch(() => {}); }
}

const SILENCE = (() => {
  // 0,1 s Stille als WAV (8 kHz, 8 Bit, mono)
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = ''; b.forEach((x) => (bin += String.fromCharCode(x)));
  return typeof btoa === 'function' ? `data:audio/wav;base64,${btoa(bin)}` : '';
})();
