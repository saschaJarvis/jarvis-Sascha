import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { Certainty, PageTitle, Section } from '@/components/ui';
import { checkLtv } from '@/lib/domain/property';

interface PropertyRow {
  project_name: string; developer: string | null; location: string | null; unit_no: string | null;
  size_sqft: string | null; size_certainty: string | null; view_text: string | null; view_certainty: string | null;
  financing_ltv_pct: string | null; financing_certainty: string | null; purchase_price_minor: string | null;
  expected_completion: string | null; completion_certainty: string | null; photo_document_id: string | null;
}

export default async function DubaiPage() {
  const s = await requireUser();
  const [profile, props, open] = await Promise.all([
    db(s).profile(),
    db(s).run((q) => q<PropertyRow>('select * from properties where deleted_at is null order by created_at limit 1')),
    db(s).openTasks(),
  ]);
  const p = props[0];
  const reloc = open.filter((t) => t.domain === 'relocation');
  const ltv = p?.financing_ltv_pct ? checkLtv({ buyer: 'expat', stage: 'off_plan', use: 'first_home', valueAed: 0, plannedLtvPct: Number(p.financing_ltv_pct) }) : null;

  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} eyebrow="Dubai" title="Dein Weg nach Dubai" />

      <Section title="Umzug">
        <div className="card">
          <p className="text-lg font-bold">{profile.moving_date ? new Date(profile.moving_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Umzugsdatum noch offen'}</p>
          {profile.moving_date && <Certainty value={profile.moving_date_certainty} />}
          <p className="mt-2 text-muted">{reloc.length} Umzugsaufgaben offen.</p>
          <ul className="mt-2 grid gap-1">
            {reloc.slice(0, 5).map((t) => <li key={t.id}><Link className="underline" href={`/aufgaben/${t.id}`}>{t.title}</Link></li>)}
          </ul>
        </div>
      </Section>

      <Section title="Deine Wohnung">
        {p ? (
          <div className="card grid gap-3">
            <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-line bg-sand text-center text-sm text-muted">
              Platzhalter – hier erscheint nur ein echtes Foto deiner Einheit,<br />sobald du eines mit Nutzungsrecht hochlädst.
            </div>
            <p className="text-lg font-bold">{p.project_name}{p.developer && !p.project_name.toLowerCase().includes(p.developer.toLowerCase()) ? ` · ${p.developer}` : ''}</p>
            <dl className="grid gap-2 text-sm">
              <Row label="Lage" value={p.location} />
              <Row label="Größe" value={p.size_sqft ? `${Number(p.size_sqft).toLocaleString('de-DE')} sqft` : null} c={p.size_certainty} />
              <Row label="Aussicht" value={p.view_text} c={p.view_certainty} />
              <Row label="Geplante Finanzierung" value={p.financing_ltv_pct ? `${Number(p.financing_ltv_pct)} %` : null} c={p.financing_certainty} />
              <Row label="Fertigstellung" value={p.expected_completion} c={p.completion_certainty} />
              <Row label="Kaufpreis" value={null} />
            </dl>
            {ltv && !ltv.withinLimit && (
              <div className="notice notice-warn text-sm">
                <p><strong>Bitte mit der Bank klären:</strong> Für Off-Plan-Käufe nennt die VAE-Zentralbank eine Obergrenze von {ltv.maxLtvPct} % Finanzierung. Geplant sind {Number(p.financing_ltv_pct)} %.</p>
                <p className="mt-1">Quelle: {ltv.source}</p>
              </div>
            )}
            <p className="text-xs text-muted">„vermutet“ = deine Angabe, noch nicht durch Kaufvertrag (SPA), Oqood oder Bankunterlagen belegt.</p>
          </div>
        ) : <p className="card text-muted">Noch keine Wohnung erfasst.</p>}
      </Section>

      <Section title="Unterlagen, die Jarvis braucht">
        <ul className="card grid gap-1 text-sm">
          {['Kaufvertrag (SPA)', 'Oqood-Registrierung', 'Zahlungsplan + Quittungen', 'Bankangebot (Zins, Laufzeit, LTV)', 'Service-Charge-Bescheid', 'Übergabe-/Snagging-Protokoll'].map((d) => <li key={d}>☐ {d}</li>)}
        </ul>
        <Link href="/leben/dokumente?ordner=uae_property" className="btn btn-primary mt-3 w-full">Unterlagen hochladen</Link>
      </Section>
    </div>
  );
}

function Row({ label, value, c }: { label: string; value: string | null; c?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-right font-semibold">{value ?? <span className="font-normal text-muted">unbekannt</span>}{value && c ? <Certainty value={c} /> : null}</dd>
    </div>
  );
}
