'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { friendlyDbError } from '@/server/db';
import { FOLDERS, storeUpload } from '@/server/storage';

export type DocState = { error?: string; ok?: string } | undefined;

export async function uploadDocumentAction(_: DocState, fd: FormData): Promise<DocState> {
  const s = await requireUser();
  const file = fd.get('file');
  const p = z.object({ title: z.string().trim().min(2).max(200), folder: z.enum(FOLDERS) })
    .safeParse({ title: fd.get('title'), folder: fd.get('folder') });
  if (!p.success) return { error: 'Bitte Titel und Ordner angeben.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Bitte eine Datei auswählen.' };
  try {
    const r = await storeUpload(s, file, { title: p.data.title, folder: p.data.folder });
    revalidatePath('/leben/dokumente');
    if (r.scan === 'infected') return { error: 'Die Datei wurde als gefährlich erkannt und gesperrt.' };
    return { ok: `Gespeichert.${r.duplicateOf ? ` Hinweis: Diese Datei liegt schon als „${r.duplicateOf}“ vor.` : ''}` };
  } catch (e) {
    return { error: e instanceof Error && e.message.startsWith('Datei') ? e.message : friendlyDbError(e) };
  }
}
