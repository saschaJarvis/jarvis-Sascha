export const CATEGORY_LABEL: Record<string, string> = {
  residential_lease: 'Wohnungsmiete', commercial_lease: 'Gewerbemiete/Büro', storage: 'Lagerraum', telecom: 'Telefon/Internet',
  energy: 'Strom/Gas', insurance: 'Versicherung', subscription: 'Abo', banking: 'Bank', membership: 'Mitgliedschaft', vehicle: 'Fahrzeug', other: 'Sonstiges',
};

export const CHANNEL_LABEL: Record<string, string> = {
  postal_registered: 'Brief per Einwurf-Einschreiben', postal_courier: 'Brief per Bote (mit Zeuge)', email: 'E-Mail',
  online_button: 'Kündigungsbutton auf der Website', in_person: 'Persönliche Übergabe gegen Empfangsbestätigung',
};

export const CLOSURE_LABEL: Record<string, string> = {
  written_confirmation: 'Schriftliche Bestätigung erhalten', handover_protocol: 'Übergabeprotokoll unterschrieben',
  keys_returned: 'Alle Schlüssel zurückgegeben', final_invoice: 'Schlussrechnung geprüft/bezahlt', deposit: 'Kaution zurückerhalten',
  no_further_debits: 'Keine weiteren Abbuchungen',
};

export const DOMAIN_LABEL: Record<string, string> = {
  relocation: 'Umzug', finance: 'Geld', contracts: 'Verträge', documents: 'Dokumente', property: 'Dubai-Wohnung',
  business: 'Firma', general: 'Allgemein', taxes: 'Steuern',
};
