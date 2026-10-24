import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { readVersion } from '@/server/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.aal !== 'aal2') return new NextResponse('Nicht angemeldet', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Nicht gefunden', { status: 404 });
  const f = await readVersion(s, id);
  if (!f) return new NextResponse('Nicht gefunden oder noch nicht geprüft', { status: 404 });
  return new NextResponse(new Uint8Array(f.buf), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
