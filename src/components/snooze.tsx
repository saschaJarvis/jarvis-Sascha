import { snoozeAction } from '@/app/(app)/aufgaben/actions';

export function SnoozeMenu({ id }: { id: string }) {
  return (
    <details className="relative">
      <summary className="btn-quiet inline-flex cursor-pointer list-none items-center">Später …</summary>
      <form action={snoozeAction} className="absolute right-0 z-10 mt-1 grid w-52 gap-1 rounded-2xl border border-line bg-card p-2 shadow-lg">
        <input type="hidden" name="id" value={id} />
        <button name="preset" value="2h" className="btn btn-secondary min-h-11 text-base">In 2 Stunden</button>
        <button name="preset" value="morgen" className="btn btn-secondary min-h-11 text-base">Morgen früh</button>
        <button name="preset" value="woche" className="btn btn-secondary min-h-11 text-base">Nächste Woche</button>
      </form>
    </details>
  );
}
