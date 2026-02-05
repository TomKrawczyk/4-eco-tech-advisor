import React from "react";
import { motion } from "framer-motion";

const content = {
  magazyn: {
    title: "Magazyn Energii – Zwiększ Autokonsumpcję",
    intro: "Magazyn energii pozwala przechowywać nadwyżki wyprodukowanej energii z instalacji fotowoltaicznej i wykorzystywać ją wieczorem oraz w nocy, gdy panele nie pracują. To klucz do maksymalizacji oszczędności.",
    sections: [
      {
        title: "Dlaczego magazyn energii?",
        points: [
          "Zwiększasz autokonsumpcję z 30-40% do nawet 80-90%",
          "Wykorzystujesz własną energię wieczorem i w nocy",
          "Minimalizujesz zakup drogiego prądu z sieci",
          "Uniezależniasz się od rosnących cen energii",
          "Zabezpieczenie awaryjne podczas blackoutów",
          "Optymalizacja kosztów w systemie net-billing"
        ]
      },
      {
        title: "Jak to działa?",
        points: [
          "Dzień: Nadwyżka energii z paneli ładuje magazyn zamiast trafiać do sieci",
          "Wieczór/Noc: Dom pobiera energię z magazynu zamiast z sieci",
          "Rano: Cykl się powtarza – pełna kontrola nad własną energią",
          "Inteligentny system zarządzania optymalizuje przepływ energii"
        ]
      },
      {
        title: "Pojemność i dobór",
        points: [
          "Typowa rodzina 4-osobowa: magazyn 5-10 kWh",
          "Z pompą ciepła: rozważ 10-15 kWh",
          "Z samochodem elektrycznym: minimum 10 kWh",
          "Zasada: pojemność ≈ wieczorne/nocne zużycie energii",
          "Koszt: około 2500-4000 zł za 1 kWh pojemności",
          "Żywotność: 6000-8000 cykli ładowania (10-15 lat)"
        ]
      },
      {
        title: "Technologia i bezpieczeństwo",
        points: [
          "LFP (litowo-żelazowo-fosforanowa) – najbezpieczniejsza technologia",
          "Sprawność ładowania/rozładowania około 95%",
          "Kompaktowa konstrukcja – montaż wewnątrz lub na zewnątrz",
          "Cicha praca – brak hałasu",
          "Popularne marki: Huawei LUNA, BYD, Pylontech, Deye"
        ]
      }
    ]
  },
  autokonsumpcja: {
    title: "Autokonsumpcja – Jak Maksymalnie Oszczędzać",
    intro: "Autokonsumpcja to bezpośrednie wykorzystanie energii wyprodukowanej przez Twoją instalację PV. Im więcej własnej energii zużywasz od razu, tym większe oszczędności. Nauczmy się, jak to robić mądrze.",
    sections: [
      {
        title: "Czym jest autokonsumpcja?",
        points: [
          "Autokonsumpcja = Wyprodukowana energia − Oddana do sieci",
          "Im wyższy % autokonsumpcji, tym większe oszczędności",
          "Cel: minimum 60%, optymalnie powyżej 70-80%",
          "W net-billingu autokonsumpcja jest KLUCZOWA dla opłacalności"
        ]
      },
      {
        title: "Urządzenia energochłonne – kiedy włączać?",
        points: [
          "Pralka, zmywarka, suszarka: programuj na godziny 10:00-15:00",
          "Podgrzewanie wody: steruj bojlerem tak, by pracował w dzień",
          "Pompa ciepła: włącz tryb dzienny, grzej dom w godzinach produkcji PV",
          "Ładowanie samochodu elektrycznego: zawsze w ciągu dnia (11:00-16:00)",
          "Odkurzacz, żelazko, robot sprzątający: używaj w godzinach słonecznych",
          "Klimatyzacja latem: chłodź dom gdy świeci słońce"
        ]
      },
      {
        title: "Inteligentne sterowanie zużyciem",
        points: [
          "Inteligentne gniazdka z harmonogramem czasowym",
          "Sterowniki z czujnikiem nadwyżki PV – automatyczne włączanie grzałki w bojlerze",
          "System HEMS (Home Energy Management System) – kompleksowe zarządzanie",
          "Monitoruj produkcję PV na bieżąco i reaguj"
        ]
      },
      {
        title: "Net-billing – dlaczego autokonsumpcja jest ważniejsza niż kiedyś?",
        points: [
          "Do 2022: Net-metering – bilansowanie 1:1 lub 1:0.8 (prosumer)",
          "Od 2022: Net-billing – sprzedajesz po cenie rynkowej (~0.20-0.30 zł/kWh), kupujesz po taryfie (~0.90 zł/kWh)",
          "Oddanie energii do sieci nie opłaca się tak jak wcześniej",
          "Musisz zużywać jak najwięcej energii na miejscu, gdy jest produkowana",
          "Magazyn energii pomaga wykorzystać nadwyżki wieczorem/nocą"
        ]
      },
      {
        title: "Przykład optymalizacji dnia",
        points: [
          "6:00-8:00 – Przygotowanie śniadania, kawa (PV zaczyna pracować)",
          "9:00-11:00 – Uruchom pralkę, zmywarkę",
          "11:00-15:00 – Szczyt produkcji: ładuj samochód, grzej wodę, pracuj w domu",
          "15:00-17:00 – Schładzaj/ogrzewaj dom pompą ciepła, używaj AGD",
          "17:00-22:00 – Energia z magazynu (jeśli masz) lub minimum poboru z sieci",
          "Noc – Energia z magazynu lub niskoenergetyczne urządzenia"
        ]
      }
    ]
  },
  ekonomia: {
    title: "Ekonomia i Zwrot Inwestycji",
    intro: "Poznaj rzeczywiste koszty, oszczędności i czas zwrotu inwestycji w magazyn energii i optymalizację autokonsumpcji.",
    sections: [
      {
        title: "Koszty magazynu energii",
        points: [
          "Magazyn 5 kWh: około 12 000 - 15 000 zł",
          "Magazyn 10 kWh: około 22 000 - 30 000 zł",
          "Magazyn 15 kWh: około 35 000 - 45 000 zł",
          "Instalacja: 2 000 - 4 000 zł",
          "Razem z montażem i konfiguracją"
        ]
      },
      {
        title: "Oszczędności roczne",
        points: [
          "Bez magazynu: autokonsumpcja 30-40% → oszczędność ~2 000 - 3 000 zł/rok",
          "Z magazynem: autokonsumpcja 70-85% → oszczędność ~5 000 - 7 000 zł/rok",
          "Różnica: około 3 000 - 4 000 zł/rok dodatkowych oszczędności",
          "Zwrot z magazynu: 7-10 lat (w zależności od cen energii)"
        ]
      },
      {
        title: "Dofinansowanie – Mój Prąd 6.0",
        points: [
          "Magazyn energii: do 16 000 zł dofinansowania",
          "System zarządzania energią (HEMS): do 3 000 zł",
          "Pompa ciepła powietrze-woda: do 19 400 zł",
          "Łącznie można otrzymać nawet 38 400 zł dotacji",
          "Warunek: system musi być podłączony do sieci (net-billing)"
        ]
      },
      {
        title: "Kalkulator zwrotu inwestycji (przykład)",
        points: [
          "Koszt magazynu 10 kWh z montażem: 28 000 zł",
          "Dotacja Mój Prąd: -16 000 zł",
          "Koszt po dotacji: 12 000 zł",
          "Dodatkowa oszczędność rocznie: 3 500 zł",
          "Zwrot inwestycji: 12 000 / 3 500 = ~3,5 roku",
          "Korzyść po 10 latach: 35 000 zł − 12 000 zł = 23 000 zł zysku"
        ]
      }
    ]
  }
};

export default function Education() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <div className="text-center space-y-3 py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Edukacja
        </h1>
        <p className="text-gray-600 text-lg">
          Magazyn energii i autokonsumpcja – praktyczny przewodnik dla właścicieli instalacji PV
        </p>
      </div>

      {Object.entries(content).map(([key, topic]) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {topic.title}
            </h2>
            <p className="text-green-50 leading-relaxed">
              {topic.intro}
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {topic.sections.map((section, i) => (
              <div key={i} className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-700 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      <div className="bg-green-50 rounded-2xl border border-green-200 p-6 md:p-8 text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          Potrzebujesz pomocy w doborze magazynu energii?
        </h3>
        <p className="text-gray-700 mb-4">
          Skontaktuj się z naszym doradcą technicznym. Pomożemy dobrać optymalne rozwiązanie dla Twojego domu.
        </p>
        <div className="text-sm text-gray-600">
          <div className="font-semibold text-green-600 text-base">4-ECO Green Energy</div>
          <div>Profesjonalne doradztwo techniczne i sprzedaż</div>
        </div>
      </div>
    </div>
  );
}