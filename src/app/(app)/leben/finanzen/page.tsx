import { PageTitle } from '@/components/ui';

export default function FinancePage() {
  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Finanzen" />
      <div className="card grid gap-3">
        <p className="font-semibold">Hier entsteht dein Finanz-Cockpit.</p>
        <p className="text-muted">Die Rechenlogik ist fertig und getestet (Kontoauszug-Import, Dubletten, Umbuchungen, Abos, Prognose in 3 Szenarien). Die Ansicht dazu kommt im nächsten Schritt.</p>
        <p className="notice notice-info">Jarvis fragt nie nach Bank-Passwörtern, Seed-Phrasen oder privaten Schlüsseln. Du lädst nur Exporte (CSV/XLSX) hoch.</p>
      </div>
    </div>
  );
}
