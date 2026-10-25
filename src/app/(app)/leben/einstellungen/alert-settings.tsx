'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { connectTelegramAction, disablePushAction, disconnectTelegramAction, saveAlertKindsAction, savePushSubscriptionAction, sendTestAlertAction, type AlertState } from './alert-actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export interface AlertConfig {
  kinds: { outflow: boolean; inflow: boolean; price: boolean; statement: boolean; other: boolean };
  pct: number;
  otherPct: number;
  pushEnabled: boolean;
  pushDevices: number;
  telegramBot: string | null;
  telegramLinked: boolean;
  telegramCode: string | null;
  vapidKey: string | null;
}

export function AlertSettings({ cfg }: { cfg: AlertConfig }) {
  return (
    <div className="grid gap-3">
      <PushCard cfg={cfg} />
      <TelegramCard cfg={cfg} />
      <KindsCard cfg={cfg} />
      <TestCard enabled={cfg.pushEnabled || cfg.telegramLinked} />
    </div>
  );
}

function PushCard({ cfg }: { cfg: AlertConfig }) {
  const [state, setState] = useState<AlertState>();
  const [pending, start] = useTransition();
  const [env, setEnv] = useState<{ supported: boolean; standalone: boolean; ios: boolean }>({ supported: true, standalone: true, ios: false });
  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setEnv({ supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, standalone, ios });
  }, []);

  const enable = () => start(async () => {
    try {
      if (!cfg.vapidKey) return setState({ error: 'Push ist auf dem Server noch nicht eingerichtet.' });
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState({ error: 'Mitteilungen wurden nicht erlaubt. In den iPhone-Einstellungen → Mitteilungen → Jarvis einschalten.' });
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.vapidKey) as BufferSource });
      setState(await savePushSubscriptionAction(JSON.stringify(sub.toJSON()), env.ios ? 'iPhone/iPad' : navigator.platform || 'Browser'));
    } catch (e) { setState({ error: `Push konnte nicht eingeschaltet werden (${(e as Error).message}).` }); }
  });

  return (
    <div className="card grid gap-2">
      <p className="font-semibold">📱 Push aufs iPhone</p>
      {cfg.pushEnabled
        ? <p className="text-sm text-good">An – {cfg.pushDevices} Gerät{cfg.pushDevices === 1 ? '' : 'e'} angemeldet.</p>
        : <p className="text-sm text-muted">Mitteilungen direkt von Jarvis, auch wenn die App zu ist.</p>}
      {env.ios && !env.standalone && (
        <p className="notice notice-info text-sm">Auf dem iPhone geht Push nur, wenn Jarvis als App auf dem Home-Bildschirm liegt: in Safari unten auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Dann Jarvis von dort öffnen und hier einschalten.</p>
      )}
      {!env.supported && !(env.ios && !env.standalone) && <p className="text-sm text-warn">Dieser Browser kann keine Push-Nachrichten.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !env.supported || (env.ios && !env.standalone)} onClick={enable} className="btn btn-primary">
          {pending ? 'Einen Moment …' : cfg.pushEnabled ? 'Dieses Gerät (neu) anmelden' : 'Push einschalten'}
        </button>
        {cfg.pushEnabled && <form action={disablePushAction}><button className="btn btn-secondary">Push aus</button></form>}
      </div>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </div>
  );
}

function TelegramCard({ cfg }: { cfg: AlertConfig }) {
  const [state, action] = useActionState(connectTelegramAction, undefined);
  const code = state?.code ?? cfg.telegramCode;
  const bot = state?.bot ?? cfg.telegramBot;
  return (
    <div className="card grid gap-2">
      <p className="font-semibold">✈️ Telegram</p>
      {cfg.telegramLinked ? (
        <>
          <p className="text-sm text-good">Verbunden mit @{cfg.telegramBot}.</p>
          <form action={disconnectTelegramAction}><button className="btn btn-secondary">Telegram trennen</button></form>
        </>
      ) : code && bot ? (
        <div className="grid gap-2 text-sm">
          <p>Letzter Schritt: Öffne deinen Bot und schicke ihm diese Nachricht:</p>
          <p className="mono select-all rounded border border-line bg-paper px-3 py-2 text-base">/start {code}</p>
          <a className="btn btn-primary" href={`https://t.me/${bot}?start=${code}`} target="_blank" rel="noopener noreferrer">In Telegram öffnen</a>
          <p className="text-xs text-muted">Danach diese Seite neu laden – dann steht hier „Verbunden“.</p>
        </div>
      ) : (
        <form action={action} className="grid gap-2">
          <ol className="list-decimal pl-5 text-sm text-muted">
            <li>In Telegram <b>@BotFather</b> öffnen → <b>/newbot</b> → Namen wählen, z. B. „Jarvis Sascha“.</li>
            <li>BotFather schickt einen Schlüssel (sieht aus wie <span className="mono">1234567890:AA…</span>) – hier einfügen.</li>
          </ol>
          <input name="token" required autoComplete="off" spellCheck={false} className="field mono text-sm" placeholder="1234567890:AA…" />
          <Submit>Bot verbinden</Submit>
          <p className="text-xs text-muted">Der Bot gehört nur dir. Jarvis nutzt ihn ausschließlich zum Senden von Warnungen.</p>
        </form>
      )}
      <ErrorNote error={state?.error} />
    </div>
  );
}

function KindsCard({ cfg }: { cfg: AlertConfig }) {
  const [state, action] = useActionState(saveAlertKindsAction, undefined);
  const Box = ({ name, label, hint }: { name: keyof AlertConfig['kinds']; label: string; hint: string }) => (
    <label className="flex items-start gap-2">
      <input type="checkbox" name={name} defaultChecked={cfg.kinds[name]} className="mt-1 h-4 w-4 accent-[#3fd2ff]" />
      <span><b>{label}</b><span className="block text-xs text-muted">{hint}</span></span>
    </label>
  );
  return (
    <form action={action} className="card grid gap-3 text-sm">
      <p className="font-semibold">Was gemeldet wird</p>
      <Box name="outflow" label="🚨 Abfluss aus einem Wallet" hint="Sofort, auch in der Ruhezeit – das solltest immer nur du gewesen sein." />
      <Box name="inflow" label="Eingang" hint="Ab 25 € Gegenwert, z. B. nach einem Kauf." />
      <Box name="price" label="Starke Kursbewegung" hint="Dein Krypto-Bestand seit heute früh – nur Kurse, ohne Ein-/Auszahlungen." />
      <label className="flex items-center gap-2 pl-6">ab <input name="pct" defaultValue={String(cfg.pct).replace('.', ',')} inputMode="decimal" className="field w-20 py-1" /> %</label>
      <Box name="other" label="Aktien & Edelmetalle" hint="Wert deiner Aktien/ETFs, Gold und Platin seit heute früh – nur Kurse." />
      <label className="flex items-center gap-2 pl-6">ab <input name="opct" defaultValue={String(cfg.otherPct).replace('.', ',')} inputMode="decimal" className="field w-20 py-1" /> %</label>
      <Box name="statement" label="Kontoauszug ausgewertet" hint="Mit Auffälligkeiten aus dem Auszug." />
      <Submit>Speichern</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <p className="text-xs text-muted">Jarvis prüft alle 5 Minuten. Außer Abflüssen kommt nichts während deiner Ruhezeit (oben einstellbar) – das wird danach nachgeholt.</p>
    </form>
  );
}

function TestCard({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<AlertState>();
  const [pending, start] = useTransition();
  return (
    <div className="card grid gap-2">
      <button type="button" disabled={!enabled || pending} className="btn btn-secondary" onClick={() => start(async () => setState(await sendTestAlertAction()))}>
        {pending ? 'Sende …' : 'Testnachricht schicken'}
      </button>
      {!enabled && <p className="text-xs text-muted">Erst Push oder Telegram einrichten.</p>}
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </div>
  );
}
