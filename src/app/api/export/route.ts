import { NextResponse } from 'next/server';
import { getSession, stepUpFresh } from '@/server/auth';
import { withUser } from '@/server/db';

/** DSGVO-Export: alle eigenen Daten als JSON. Erfordert frisches Step-up (auch in der DB-Funktion geprüft). */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.aal !== 'aal2') return new NextResponse('Nicht angemeldet', { status: 401 });
  if (!stepUpFresh(s)) {
    const url = new URL('/sicherheit/code', req.url);
    url.searchParams.set('weiter', '/api/export');
    url.searchParams.set('grund', 'Du lädst alle deine Daten herunter.');
    return NextResponse.redirect(url);
  }
  const rows = await withUser(s.claims, (q) => q<{ data: unknown }>('select app.export_my_data() as data'));
  const body = JSON.stringify(rows[0].data, null, 2);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="jarvis-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
