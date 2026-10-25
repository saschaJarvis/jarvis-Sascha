-- Litecoin: ganzes Konto über den erweiterten ÖFFENTLICHEN Schlüssel (nur ansehen).
-- Gespeichert als Blockbook-Descriptor, z. B. sh(wpkh(Ltub…)). Private Schlüssel (Ltpv/Mtpv/…prv) passen nicht ins Muster.
alter table public.ltc_wallets drop constraint if exists ltc_wallets_address_check;
alter table public.ltc_wallets add constraint ltc_wallets_address_check check (
  address ~ '^([LM][1-9A-HJ-NP-Za-km-z]{26,33}|ltc1[02-9ac-hj-np-z]{20,80})$'
  or address ~ '^(sh\(wpkh\(|wpkh\(|pkh\()(Ltub|Mtub|zpub|xpub)[1-9A-HJ-NP-Za-km-z]{100,112}\)\)?$'
);
