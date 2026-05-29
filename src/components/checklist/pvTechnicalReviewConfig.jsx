export const pvTechnicalReviewSections = [
  {
    title: "Dane klienta",
    fields: [
      { key: "client_name", label: "Imię i nazwisko klienta", placeholder: "Jan Kowalski" },
      { key: "client_address", label: "Adres", placeholder: "ul. Słoneczna 12, 00-000 Warszawa" },
      { key: "client_phone", label: "Numer telefonu", placeholder: "600 123 456" },
    ],
  },
  {
    title: "Okresy i zużycie",
    fields: [
      { key: "one_month", label: "1 miesiąc", placeholder: "np. 320 zł" },
      { key: "twelve_months", label: "12 miesięcy", placeholder: "np. 3840 zł" },
      { key: "ten_years", label: "10 lat", placeholder: "np. 38400 zł" },
      { key: "future_increases", label: "Podwyżki na przestrzeni najbliższych lat", placeholder: "np. 8% rocznie" },
      { key: "current_usage", label: "Obecne zużycie", placeholder: "np. 6200 kWh" },
      { key: "produced_energy", label: "Wyprodukowano", placeholder: "np. 5400 kWh" },
      { key: "returned_to_grid", label: "Oddano do sieci", placeholder: "np. 3200 kWh" },
      { key: "taken_from_grid", label: "Pobrano z sieci", placeholder: "np. 2800 kWh" },
    ],
  },
  {
    title: "Gwarancja",
    fields: [
      { key: "warranty_performance", label: "Produktywność", placeholder: "np. 25 lat" },
      { key: "warranty_mechanical", label: "Mechaniczna / uszkodzenia", placeholder: "np. 12 lat" },
    ],
  },
  {
    title: "Koszty",
    fields: [
      { key: "retail_cost_outside_project", label: "Koszt detal poza projektem", placeholder: "np. 48 000 zł" },
      { key: "project_cost", label: "Koszt w projekcie", placeholder: "np. 39 900 zł" },
      { key: "support_installation_cost", label: "Koszt instalacji w projekcie „Wsparcie energetyczne”", placeholder: "np. 28 000 zł" },
    ],
  },
  {
    title: "Rozliczenie końcowe",
    fields: [
      { key: "system_price", label: "Cena systemu", placeholder: "np. 39 900 zł" },
      { key: "grant_amount", label: "Dotacja", placeholder: "np. 10 000 zł" },
      { key: "thermomodernization_relief", label: "Termomodernizacja", placeholder: "np. 6 000 zł" },
      { key: "final_amount", label: "Finalny", placeholder: "np. 23 900 zł", readOnly: true },
      { key: "subscription_months", label: "Abonament (płatny po ... miesiącach)", placeholder: "np. 12" },
    ],
  },
  {
    title: "Po nadpłacie dofinansowań",
    fields: [
      { key: "post_subsidy_installment", label: "Rata po nadpłacie dofinansowań", placeholder: "np. 299 zł" },
      { key: "post_subsidy_months", label: "Liczba miesięcy po nadpłacie dofinansowań", placeholder: "np. 84" },
      { key: "post_subsidy_years", label: "Miesięcy = lat po nadpłacie dofinansowań", placeholder: "np. 84 miesięcy = 7 lat" },
      { key: "technician_contact", label: "Kontakt z technikiem", placeholder: "np. 510-630-268" },
    ],
  },
];

export const pvTechnicalReviewInitialState = Object.fromEntries(
  pvTechnicalReviewSections.flatMap(section => section.fields.map(field => [field.key, ""]))
);