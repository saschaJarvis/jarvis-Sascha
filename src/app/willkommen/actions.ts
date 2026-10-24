'use server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { withService } from '@/server/db';
import { assertTimeZone } from '@/lib/domain/time';

export type OState = { error?: string } | undefined;

export async function onboardingStepAction(_: OState, fd: FormData): Promise<OState> {
  const s = await requireUser();
  const step = z.coerce.number().int().min(1).max(4).parse(fd.get('step'));
  try {
    if (step === 1) {
      const name = String(fd.get('display_name') ?? '').trim().slice(0, 60);
      const tz = String(fd.get('timezone') ?? 'Europe/Berlin');
      assertTimeZone(tz);
      await db(s).run((q) => q(`update profiles set display_name = nullif($1,''), timezone = $2,
        onboarding = onboarding || '{"s1":true}' where id = auth.uid()`, [name, tz]));
    } else if (step === 2) {
      const unknown = fd.get('unknown') === 'on';
      const d = String(fd.get('moving_date') ?? '');
      if (!unknown && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'Bitte ein Datum wählen oder „weiß ich noch nicht“ ankreuzen.' };
      await db(s).run((q) => q(`update profiles set moving_date = $1, moving_date_certainty = case when $1::date is null then null else 'verified'::certainty end,
        onboarding = onboarding || '{"s2":true}' where id = auth.uid()`, [unknown ? null : d]));
    } else if (step === 3) {
      const qs = String(fd.get('quiet_hours_start') ?? '21:30'); const qe = String(fd.get('quiet_hours_end') ?? '08:00');
      if (!/^\d{2}:\d{2}$/.test(qs) || !/^\d{2}:\d{2}$/.test(qe)) return { error: 'Uhrzeit ungültig.' };
      const email = fd.get('ch_email') === 'on';
      await db(s).run(async (q) => {
        await q(`update profiles set quiet_hours_start = $1, quiet_hours_end = $2, onboarding = onboarding || '{"s3":true}' where id = auth.uid()`, [qs, qe]);
        await q(`insert into consent_records (user_id, purpose, granted, text_version) values (auth.uid(), 'notify.email', $1, 'notify-v1')`, [email]);
      });
    } else {
      const withDemo = fd.get('demo') === 'yes';
      if (withDemo) {
        // Fiktive, klar markierte Beispieldaten (seed/demo.sql); uid ist eine geprüfte UUID aus der Session
        if (!/^[0-9a-f-]{36}$/.test(s.userId)) throw new Error('ungültig');
        const sql = (await readFile(path.join(process.cwd(), 'seed/demo.sql'), 'utf8')).replaceAll(':uid', `'${s.userId}'`);
        await withService((q) => q(sql), 'owner');
      }
      await db(s).run((q) => q(`update profiles set onboarding = onboarding || jsonb_build_object('done', true, 'demo', $1::boolean) where id = auth.uid()`, [withDemo]));
      revalidatePath('/', 'layout');
      redirect('/');
    }
  } catch (e) {
    unstable_rethrow(e);
    console.error('[onboarding]', e);
    return { error: 'Das hat nicht geklappt. Bitte erneut versuchen.' };
  }
  redirect(`/willkommen?schritt=${step + 1}`);
}
