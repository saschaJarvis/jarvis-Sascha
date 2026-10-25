-- Ethereum-Adressen zulassen (nur öffentlich: 0x + 40 Hex). 64-Hex (privater Schlüssel) passt bewusst NICHT.
alter table public.crypto_wallets drop constraint crypto_wallets_chain_check;
alter table public.crypto_wallets drop constraint crypto_wallets_address_check;
alter table public.crypto_wallets add constraint crypto_wallets_address_check check (
  (chain = 'xrp' and address ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$') or
  (chain = 'eth' and address ~ '^0x[0-9a-fA-F]{40}$'));
drop index public.crypto_wallets_unique;
create unique index crypto_wallets_unique on public.crypto_wallets (user_id, chain, lower(address)) where deleted_at is null;
