import React from "react";
import { motion } from "framer-motion";
import StorageComparisonChart from "../components/charts/StorageComparisonChart";

const content = {
  bezMagazynu: {
    title: "Używanie instalacji PV bez magazynu energii",
    intro: "Instalacja fotowoltaiczna bez magazynu energii działa dobrze, ale wymaga świadomego zarządzania zużyciem. Energia jest produkowana głównie w ciągu dnia, więc kluczem jest dostosowanie nawyków do momentu produkcji.",
    sections: [
      {
        title: "Jak działa instalacja bez magazynu?",
        points: [
          "Energia produkowana przez panele jest od razu wykorzystywana w domu",
          "Nadwyżki energii są automatycznie oddawane do sieci",
          "Wieczorem i nocą pobierasz energię z sieci, za którą płacisz standardową cenę",
          "Autokonsumpcja typowo wynosi 30-40% (zależy od stylu życia)",
          "W systemie net-billing sprzedajesz energię po cenie rynkowej (~0.20-0.30 zł/kWh), kupujesz po taryfie (~0.90 zł/kWh)"
        ]
      },
      {
        title: "Praktyczne zasady użytkowania",
        points: [
          "Wykorzystuj urządzenia energochłonne między 10:00 a 15:00",
          "Pralka, zmywarka: włączaj w godzinach produkcji PV",
          "Bojler: ogrzewaj wodę w ciągu dnia, nie wieczorem",
          "Ładowanie urządzeń: telefony, laptopy – zawsze w dzień",
          "Gotowanie: jeśli masz kuchenkę elektryczną, planuj posiłki na środek dnia",
          "Klimatyzacja/ogrzewanie: maksymalnie wykorzystuj godziny słoneczne"
        ]
      },
      {
        title: "Monitorowanie produkcji i zużycia",
        points: [
          "Sprawdzaj aplikację falownika, aby wiedzieć, kiedy produkujesz najwięcej energii",
          "Obserwuj bilans: produkcja vs zużycie w czasie rzeczywistym",
          "Unikaj dużego poboru energii wieczorem i w nocy",
          "Analizuj dane z licznika: porównuj odczyty 1.8.0 (pobór) i 2.8.0 (oddanie)",
          "Oblicz swoją autokonsumpcję: (Produkcja − Eksport) / Produkcja × 100%"
        ]
      },
      {
        title: "Ograniczenia i wyzwania",
        points: [
          "Wieczorem i w nocy musisz korzystać z energii sieciowej",
          "W pochmurne dni produkcja jest niska, więcej energii z sieci",
          "W zimie produkcja spada – wyższe rachunki za energię",
          "Trudno wykorzystać całą energię w dzień, jeśli jesteś w pracy",
          "Oddawanie energii do sieci jest nieopłacalne (niska cena sprzedaży)"
        ]
      },
      {
        title: "Kiedy warto rozważyć magazyn?",
        points: [
          "Duża część energii jest oddawana do sieci (eksport >60%)",
          "Nie ma możliwości korzystania z urządzeń w ciągu dnia",
          "Zużycie koncentruje się wieczorem i w nocy (dom jest pusty w dzień)",
          "Chcesz zwiększyć niezależność od sieci",
          "Rosnące ceny energii – magazyn staje się bardziej opłacalny"
        ]
      }
    ]
  },
  zMagazynem: {
    title: "Używanie instalacji PV z magazynem energii",
    intro: "Magazyn energii zmienia sposób korzystania z instalacji fotowoltaicznej. Nadwyżki energii z dnia są przechowywane i wykorzystywane wieczorem oraz nocą, co znacząco zwiększa niezależność energetyczną.",
    sections: [
      {
        title: "Jak działa instalacja z magazynem?",
        points: [
          "W ciągu dnia energia z paneli zasila dom, a nadwyżki trafiają do magazynu",
          "Magazyn ładuje się automatycznie, gdy produkcja przewyższa zużycie",
          "Wieczorem i w nocy dom korzysta z energii zgromadzonej w magazynie",
          "Dopiero gdy magazyn jest pusty, energia pobierana jest z sieci",
          "Autokonsumpcja wzrasta do 70-90%, w zależności od pojemności magazynu"
        ]
      },
      {
        title: "Zmiana nawyków użytkowania",
        points: [
          "Nie musisz już koncentrować całego zużycia na dzień",
          "Możesz korzystać z urządzeń wieczorem – energia pochodzi z magazynu",
          "Rano energia z magazynu – zamiast z sieci",
          "Mniej stresu o optymalizację każdej czynności",
          "Większa elastyczność w codziennym życiu"
        ]
      },
      {
        title: "Automatyczne zarządzanie",
        points: [
          "System sam decyduje, kiedy ładować magazyn, a kiedy go rozładowywać",
          "Priorytet: najpierw dom, potem magazyn, na końcu oddanie do sieci",
          "Możliwość ustawienia 'trybu rezerwowego' – część energii zawsze w magazynie",
          "Niektóre systemy pozwalają ręcznie zarządzać ładowaniem",
          "Monitorowanie stanu naładowania w aplikacji"
        ]
      },
      {
        title: "Dobór pojemności magazynu",
        points: [
          "Przeanalizuj swoje wieczorne i nocne zużycie energii (np. 8-10 kWh)",
          "Magazyn powinien pokryć większość zużycia, gdy panele nie pracują",
          "Typowa rodzina 4-osobowa: magazyn 5-10 kWh",
          "Dom z pompą ciepła: 10-15 kWh",
          "Większa pojemność = wyższa autokonsumpcja, ale dłuższy zwrot inwestycji"
        ]
      },
      {
        title: "Eksploatacja i utrzymanie",
        points: [
          "Magazyn nie wymaga konserwacji – technologia LFP jest trwała",
          "Sprawność ładowania/rozładowania: około 95%",
          "Żywotność: 6000-8000 cykli (10-15 lat użytkowania)",
          "System automatycznie dba o kondycję baterii",
          "Monitoruj stan magazynu przez aplikację – sprawdzaj, czy działa optymalnie"
        ]
      },
      {
        title: "Korzyści długoterminowe",
        points: [
          "Znacznie niższe rachunki za energię – oszczędność 50-70%",
          "Niezależność od rosnących cen energii elektrycznej",
          "Zwiększona wartość nieruchomości",
          "Komfort użytkowania – brak konieczności planowania zużycia",
          "Bezpieczeństwo energetyczne – rezerwa na wypadek awarii sieci"
        ]
      }
    ]
  },
  porownanie: {
    title: "Porównanie: Co wybrać?",
    intro: "Wybór pomiędzy instalacją z magazynem a bez magazynu zależy od wielu czynników. Oto szczegółowe porównanie, które pomoże podjąć decyzję.",
    sections: [
      {
        title: "Aspekty finansowe",
        points: [
          "Bez magazynu: niski koszt początkowy, oszczędność ~2500-3500 zł/rok",
          "Z magazynem: wyższy koszt początkowy (+20000-30000 zł), oszczędność ~5000-7000 zł/rok",
          "Zwrot inwestycji z magazynu: 7-10 lat (bez dotacji), 3-5 lat (z dotacją Mój Prąd)",
          "Bez magazynu: szybszy zwrot z samej instalacji PV",
          "Z magazynem: wyższe długoterminowe oszczędności"
        ]
      },
      {
        title: "Styl życia i elastyczność",
        points: [
          "Bez magazynu: wymaga dostosowania nawyków do produkcji PV",
          "Z magazynem: elastyczność w korzystaniu z energii o każdej porze",
          "Bez magazynu: lepsze dla osób będących w domu w ciągu dnia",
          "Z magazynem: idealne dla pracujących osób, które są w domu wieczorem",
          "Bez magazynu: wymaga świadomego planowania użycia urządzeń"
        ]
      },
      {
        title: "Technologia i utrzymanie",
        points: [
          "Bez magazynu: prostsza instalacja, mniej elementów do nadzoru",
          "Z magazynem: bardziej zaawansowany system, automatyczne zarządzanie",
          "Bez magazynu: brak dodatkowych kosztów utrzymania",
          "Z magazynem: żywotność baterii 10-15 lat, później wymiana",
          "Oba rozwiązania: monitoring przez aplikacje falownika"
        ]
      },
      {
        title: "Dla kogo które rozwiązanie?",
        points: [
          "Bez magazynu: dom z osobami w ciągu dnia, świadome zarządzanie energią, ograniczony budżet",
          "Z magazynem: pracujące osoby, wieczorne zużycie energii, pompa ciepła/samochód elektryczny",
          "Bez magazynu: niski budżet, chęć szybkiego zwrotu inwestycji",
          "Z magazynem: wyższy budżet, priorytet = niezależność i komfort",
          "Oba: mogą być optymalne w zależności od indywidualnej sytuacji"
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
          Praktyczny przewodnik użytkowania instalacji fotowoltaicznych
        </p>
      </div>

      {/* Visual comparison first */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Wizualizacja: Z magazynem vs Bez magazynu
          </h2>
          <p className="text-green-50 leading-relaxed">
            Zobacz różnicę w poborze energii z sieci w ciągu doby
          </p>
        </div>
        <div className="p-6 md:p-8">
          <StorageComparisonChart />
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h4 className="font-bold text-gray-900 mb-2">Bez magazynu energii</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Autokonsumpcja: 30-40%</li>
                <li>• Wysoki import z sieci wieczorem/nocą</li>
                <li>• Nadwyżki dzienne oddawane do sieci</li>
                <li>• Import: ~15 kWh/dzień</li>
              </ul>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <h4 className="font-bold text-gray-900 mb-2">Z magazynem energii</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Autokonsumpcja: 70-90%</li>
                <li>• Minimalne zapotrzebowanie z sieci</li>
                <li>• Energia dostępna 24/7 z magazynu</li>
                <li>• Import: ~4 kWh/dzień</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>

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
          Potrzebujesz pomocy w optymalizacji instalacji?
        </h3>
        <p className="text-gray-700 mb-4">
          Skontaktuj się z naszym doradcą technicznym. Pomożemy przeanalizować Twoje zużycie i dobrać optymalne rozwiązanie.
        </p>
        <div className="text-sm text-gray-600">
          <div className="font-semibold text-green-600 text-base">4-ECO Green Energy</div>
          <div>Profesjonalne doradztwo techniczne</div>
        </div>
      </div>
    </div>
  );
}