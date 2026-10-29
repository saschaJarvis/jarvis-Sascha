-- Neuer Dokumente-Ordner „Bedienungsanleitungen“ (manuals) unter Leben.
alter table public.documents drop constraint documents_folder_check;
alter table public.documents add constraint documents_folder_check check (folder in (
  'identity', 'housing', 'office', 'storage', 'business', 'taxes', 'banks', 'crypto', 'insurance',
  'subscriptions', 'shipping', 'customs', 'visa', 'uae_property', 'utilities', 'healthcare', 'vehicles',
  'travel', 'legal', 'metals', 'manuals', 'other'));
