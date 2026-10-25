-- Ganze Konten (nur ansehen) auch für Bitcoin und Zcash: Blockbook-Descriptor mit erweitertem ÖFFENTLICHEM Schlüssel,
-- z. B. sh(wpkh(xpub…)). Private Schlüssel (xprv/yprv/zprv) passen nicht ins Muster.
alter table public.btc_wallets drop constraint if exists btc_wallets_address_check;
alter table public.btc_wallets add constraint btc_wallets_address_check check (
  address ~ '^([13][1-9A-HJ-NP-Za-km-z]{25,34}|(bc1|BC1)[02-9ac-hj-np-zAC-HJ-NP-Z]{11,71})$'
  or address ~ '^(sh\(wpkh\(|wpkh\(|pkh\(|tr\()(xpub|ypub|zpub)[1-9A-HJ-NP-Za-km-z]{100,112}\)\)?$'
);
alter table public.zec_wallets drop constraint if exists zec_wallets_address_check;
alter table public.zec_wallets add constraint zec_wallets_address_check check (
  address ~ '^t[13][1-9A-HJ-NP-Za-km-z]{33}$'
  or address ~ '^pkh\(xpub[1-9A-HJ-NP-Za-km-z]{100,112}\)$'
);
alter table public.ltc_wallets drop constraint if exists ltc_wallets_address_check;
alter table public.ltc_wallets add constraint ltc_wallets_address_check check (
  address ~ '^([LM][1-9A-HJ-NP-Za-km-z]{26,33}|ltc1[02-9ac-hj-np-z]{20,80})$'
  or address ~ '^(sh\(wpkh\(|wpkh\(|pkh\(|tr\()(xpub|ypub|zpub|Ltub|Mtub)[1-9A-HJ-NP-Za-km-z]{100,112}\)\)?$'
);
