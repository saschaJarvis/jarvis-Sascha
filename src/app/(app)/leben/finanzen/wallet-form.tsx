'use client';
import { useActionState, useEffect, useRef } from 'react';
import { addAccountAction, addGoldAction, addManualCryptoAction, addStockAction, addWalletAction, setBalanceAction, setManualAmountAction, setStockQuantityAction } from './actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function AddWalletForm() {
  const [state, action] = useActionState(addWalletAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="w-addr">Öffentliche Adresse (BTC, ETH, XRP, ADA, ALGO, ZEC, ATOM, XLM, LTC, DOT, VET oder SOL/RENDER)</label>
        <textarea id="w-addr" name="address" required autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={2000} rows={2}
          className="field mono text-sm" placeholder="bc1… / 0x… / r… / addr1… / t1… / cosmos1… / G… / M… / Ltub…" />
        <p className="mt-1 text-xs text-muted">In Ledger Live: Konto → „Empfangen“ → Adresse kopieren. Die Art erkennt Jarvis selbst (0x… mit Guthaben nur auf VeChain wird als VeChain erkannt). Für ein ganzes Litecoin-Konto: Konto bearbeiten → Erweitert → den Schlüssel (Ltub…) oder den ganzen Text einfügen.</p>
      </div>
      <div>
        <label className="label" htmlFor="w-label">Bezeichnung</label>
        <input id="w-label" name="label" maxLength={40} placeholder="z. B. Ledger ETH" className="field" />
      </div>
      <Submit>Adresse hinzufügen</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function AddAccountForm() {
  const [state, action] = useActionState(addAccountAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="label" htmlFor="a-name">Name</label>
          <input id="a-name" name="name" required maxLength={60} className="field" placeholder="z. B. Emirates NBD Giro" />
        </div>
        <div>
          <label className="label" htmlFor="a-inst">Bank (optional)</label>
          <input id="a-inst" name="institution" maxLength={60} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="a-kind">Art</label>
          <select id="a-kind" name="kind" className="field" defaultValue="checking">
            <option value="checking">Girokonto</option><option value="savings">Sparkonto</option><option value="deposit">Festgeld</option>
            <option value="credit_card">Kreditkarte</option><option value="crypto_exchange">Krypto-Börse</option><option value="other">Sonstiges</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-bal">Kontostand</label>
          <input id="a-bal" name="balance" required inputMode="decimal" className="field mono" placeholder="12.345,67" />
        </div>
        <div>
          <label className="label" htmlFor="a-cur">Währung</label>
          <select id="a-cur" name="currency" className="field" defaultValue="AED"><option>AED</option><option>EUR</option><option>USD</option></select>
        </div>
      </div>
      <p className="text-xs text-muted">Kreditkarte mit Minus eintragen (z. B. -1.200). Keine IBAN, kein Passwort nötig.</p>
      <Submit>Konto hinzufügen</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function BalanceForm({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState(setBalanceAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0 flex-1">
        <label className="label" htmlFor={`b-${id}`}>Neuer Kontostand</label>
        <input id={`b-${id}`} name="balance" required inputMode="decimal" className="field mono" aria-label={`Neuer Kontostand ${label}`} />
      </div>
      <Submit className="btn btn-quiet">Speichern</Submit>
      <div className="w-full"><ErrorNote error={state?.error} /><OkNote message={state?.ok} /></div>
    </form>
  );
}

export function AddGoldForm({ metal = 'gold' }: { metal?: 'gold' | 'platinum' }) {
  const [state, action] = useActionState(addGoldAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="metal" value={metal} />
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="label" htmlFor={`${metal}-label`}>Bezeichnung</label>
          <input id={`${metal}-label`} name="label" maxLength={60} className="field" placeholder={metal === 'platinum' ? 'z. B. Platinbarren 1 oz' : 'z. B. Barren 100 g Valcambi'} />
        </div>
        <div>
          <label className="label" htmlFor={`${metal}-g-qty`}>Menge</label>
          <input id={`${metal}-g-qty`} name="qty" required inputMode="decimal" className="field mono" placeholder="100" />
        </div>
        <div>
          <label className="label" htmlFor={`${metal}-g-unit`}>Einheit</label>
          <select id={`${metal}-g-unit`} name="unit" className="field" defaultValue="g"><option value="g">Gramm</option><option value="oz">Unzen (oz)</option><option value="tola">Tola</option></select>
        </div>
        <div>
          <label className="label" htmlFor={`${metal}-g-pur`}>Feingehalt</label>
          <select id={`${metal}-g-pur`} name="purity" className="field" defaultValue="999">
            {metal === 'platinum'
              ? <><option value="999">999,5 (Barren/Münze)</option><option value="950">950 (Schmuck)</option><option value="900">900</option></>
              : <><option value="999">999,9 (24 K)</option><option value="995">995</option><option value="916">916 (22 K)</option>
                <option value="875">875 (21 K)</option><option value="750">750 (18 K)</option><option value="585">585 (14 K)</option><option value="333">333 (8 K)</option></>}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${metal}-g-form`}>Form</label>
          <select id={`${metal}-g-form`} name="form" className="field" defaultValue="bar"><option value="bar">Barren</option><option value="coin">Münze</option><option value="jewelry">Schmuck</option><option value="other">Sonstiges</option></select>
        </div>
      </div>
      <Submit>{metal === 'platinum' ? 'Platin hinzufügen' : 'Gold hinzufügen'}</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function AddManualForm({ symbols }: { symbols: string[] }) {
  const [state, action] = useActionState(addManualCryptoAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="m-sym">Coin</label>
          <select id="m-sym" name="symbol" className="field" defaultValue="HBAR">{symbols.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label" htmlFor="m-amt">Menge</label>
          <input id="m-amt" name="amount" required inputMode="decimal" className="field" placeholder="55.000" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="m-venue">Wo?</label><input id="m-venue" name="venue" maxLength={40} className="field" placeholder="Bitpanda" /></div>
        <div><label className="label" htmlFor="m-label">Bezeichnung</label><input id="m-label" name="label" maxLength={40} className="field" placeholder="Bitpanda HBAR" /></div>
      </div>
      <Submit>Hinzufügen</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function ManualAmountForm({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState(setManualAmountAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`ma-${id}`}>Neue Menge {label}</label>
      <input id={`ma-${id}`} name="amount" required inputMode="decimal" className="field min-h-9 flex-1 py-1" placeholder="neue Menge" />
      <button className="btn btn-secondary min-h-9 px-3 text-[.66rem]">Speichern</button>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function AddStockForm() {
  const [state, action] = useActionState(addStockAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="s-q">Aktie / ETF</label>
        <input id="s-q" name="query" required autoComplete="off" spellCheck={false} className="field mono text-sm" placeholder="ISIN, Kürzel oder Name – z. B. US0378331005, SAP.DE" />
        <p className="mt-1 text-xs text-muted">Am sichersten mit der ISIN aus deinem Depot. Jarvis sucht den Kurs selbst (bevorzugt deutsche Börse in EUR).</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="s-qty">Stück</label><input id="s-qty" name="qty" required inputMode="decimal" className="field" placeholder="25" /></div>
        <div><label className="label" htmlFor="s-venue">Depot</label><input id="s-venue" name="venue" maxLength={40} className="field" placeholder="z. B. eToro, Trade Republic" /></div>
      </div>
      <div><label className="label" htmlFor="s-label">Bezeichnung (optional)</label><input id="s-label" name="label" maxLength={60} className="field" placeholder="wird sonst automatisch gesetzt" /></div>
      <Submit>Aktie hinzufügen</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

export function StockQtyForm({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState(setStockQuantityAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`sq-${id}`}>Neue Stückzahl {label}</label>
      <input id={`sq-${id}`} name="qty" required inputMode="decimal" className="field min-h-9 flex-1 py-1" placeholder="neue Stückzahl" />
      <button className="btn btn-secondary min-h-9 px-3 text-[.66rem]">Speichern</button>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}
