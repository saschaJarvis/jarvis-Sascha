import { test } from 'node:test';
import assert from 'node:assert/strict';

// auth.ts ist server-only; die Freigabelogik ist hier nachgebildet und muss identisch bleiben.
const isAllowed = (env: string | undefined, id: string) => {
  const list = (env ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return list.length === 0 || list.includes(id);
};

test('Freigabeliste: nur eingetragene Konten; leer = alle (Entwicklung)', () => {
  assert.equal(isAllowed('a-1, b-2', 'a-1'), true);
  assert.equal(isAllowed('a-1,b-2', 'c-3'), false);
  assert.equal(isAllowed(undefined, 'c-3'), true);
  assert.equal(isAllowed('', 'c-3'), true);
});
