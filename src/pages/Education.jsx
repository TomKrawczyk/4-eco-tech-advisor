import React, { useState } from "react";
import { GraduationCap, Sun, Thermometer, Battery, Zap, Lightbulb, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";

const topics = [
  {
    id: "pv",
    icon: Sun,
    title: "Fotowoltaika – jak działa?",
    color: "yellow",
    sections: [
      {
        title: "Zasada działania instalacji PV",
        content: "Instalacja fotowoltaiczna przekształca energię słoneczną w energię elektryczną za pomocą paneli słonecznych (ogniw krzemowych). Proces ten nazywamy efektem fotowoltaicznym.",
        bullets: [
          "Panele fotowoltaiczne wychwytują promieniowanie słoneczne",
          "Energia słoneczna jest przekształcana w prąd stały (DC)",
          "Falownik konwertuje prąd stały na prąd przemienny (AC) 230V",
          "Energia jest wykorzystywana w domu lub oddawana do sieci",
          "Nadwyżka energii może być magazynowana w bateriach"
        ]
      },
      {
        title: "Kluczowe elementy instalacji",
        content: "Każda instalacja PV składa się z kilku istotnych komponentów:",
        bullets: [
          "Panele fotowoltaiczne (mono- lub polikrystaliczne)",
          "Falownik (stringowy lub mikrofalowniki)",
          "Konstrukcja montażowa (dachowa lub gruntowa)",
          "Zabezpieczenia elektryczne (SPD, RCD, wyłączniki)",
          "System monitoringu i komunikacji (Wi-Fi, LAN)",
          "Okablowanie DC i AC z odpowiednim przekrojem"
        ]
      },
      {
        title: "Orientacja i nachylenie",
        content: "Optymalna wydajność instalacji zależy od orientacji i kąta nachylenia paneli:",
        bullets: [
          "Południe – 100% wydajności (optymalnie)",
          "Płd-Wschód / Płd-Zachód – ok. 90% wydajności",
          "Wschód / Zachód – ok. 80% wydajności",
          "Optymalny kąt nachylenia w Polsce: 30-35°",
          "Unikać zacienienia – każdy cień zmniejsza produkcję"
        ]
      }
    ]
  },
  {
    id: "autokonsumpcja",
    icon: Zap,
    title: "Autokonsumpcja – klucz do oszczędności",
    color: "green",
    sections: [
      {
        title: "Czym jest autokonsumpcja?",
        content: "Autokonsumpcja to bezpośrednie wykorzystanie wyprodukowanej przez instalację PV energii w gospodarstwie domowym. Im wyższy procent autokonsumpcji, tym większe oszczędności.",
        bullets: [
          "Autokonsumpcja = Produkcja PV − Eksport do sieci",
          "Idealny cel: autokonsumpcja powyżej 60%",
          "Kluczowe: dostosowanie zużycia do godzin produkcji",
          "Uruchamiaj urządzenia energochłonne w godzinach szczytu słonecznego (10:00-15:00)"
        ]
      },
      {
        title: "Jak zwiększyć autokonsumpcję?",
        content: "Praktyczne sposoby na podniesienie wskaźnika autokonsumpcji:",
        bullets: [
          "Programuj pralkę, zmywarkę i suszarkę na godziny dzienne",
          "Rozważ montaż magazynu energii (baterii)",
          "Podgrzewaj wodę za pomocą nadwyżki z PV (grzałka + sterownik)",
          "Zainstaluj inteligentne gniazdka z harmonogramem",
          "Ładuj samochód elektryczny w ciągu dnia",
          "Używaj pompy ciepła w trybie dziennym"
        ]
      },
      {
        title: "Net-billing vs Net-metering",
        content: "Od 2022 r. w Polsce obowiązuje system net-billingu dla nowych instalacji:",
        bullets: [
          "Net-metering (do 2022): bilansowanie 1:1 lub 1:0.8 – korzystniejsze",
          "Net-billing: sprzedajesz nadwyżkę po cenie rynkowej, kupujesz po taryfie",
          "W net-billingu autokonsumpcja jest KLUCZOWA dla opłacalności",
          "Magazyn energii pomaga maksymalizować korzyści w net-billingu"
        ]
      }
    ]
  },
  {
    id: "pompy",
    icon: Thermometer,
    title: "Pompy ciepła",
    color: "blue",
    sections: [
      {
        title: "Zasada działania pompy ciepła",
        content: "Pompa ciepła pobiera energię cieplną z otoczenia (powietrze, grunt, woda) i przenosi ją do wnętrza budynku. Działa jak odwrócona lodówka.",
        bullets: [
          "COP (współczynnik efektywności) = 3-5 → za 1 kWh prądu dostajesz 3-5 kWh ciepła",
          "Typy: powietrze-woda, grunt-woda, powietrze-powietrze",
          "Najczęściej stosowane: pompy powietrze-woda (split lub monoblok)",
          "Mogą pracować jako ogrzewanie + chłodzenie (w trybie rewersyjnym)",
          "Idealne w połączeniu z ogrzewaniem podłogowym"
        ]
      },
      {
        title: "Pompa ciepła + fotowoltaika",
        content: "Połączenie pompy ciepła z instalacją PV to idealna kombinacja dla domu niezależnego energetycznie:",
        bullets: [
          "Pompa ciepła zużywa ok. 3000-5000 kWh/rok prądu",
          "Instalacja PV może pokryć to zapotrzebowanie",
          "W lecie nadwyżka PV → klimatyzacja lub podgrzewanie wody",
          "W zimie pompa ciepła pracuje intensywniej, ale PV nadal wspiera",
          "Optymalne: magazyn energii + pompa ciepła + PV = dom bez rachunków"
        ]
      },
      {
        title: "Na co zwrócić uwagę?",
        content: "Kluczowe aspekty przy doborze pompy ciepła:",
        bullets: [
          "Prawidłowy dobór mocy do zapotrzebowania cieplnego budynku",
          "Izolacja budynku – im lepsza, tym mniejsza potrzebna moc",
          "Temperatura zasilania – optymalna: 35-45°C (podłogówka)",
          "Poziom hałasu jednostki zewnętrznej",
          "Klasa energetyczna – A+++ to standard",
          "Gwarancja i serwis – ważne przy wieloletniej eksploatacji"
        ]
      }
    ]
  },
  {
    id: "magazyn",
    icon: Battery,
    title: "Magazyny energii",
    color: "purple",
    sections: [
      {
        title: "Po co magazyn energii?",
        content: "Magazyn energii pozwala przechowywać nadwyżkę energii z instalacji PV i wykorzystywać ją, gdy słońce nie świeci.",
        bullets: [
          "Zwiększa autokonsumpcję nawet do 80-90%",
          "Zapewnia zasilanie awaryjne (UPS) podczas blackoutów",
          "Optymalizuje koszty w systemie net-billing",
          "Pozwala uniezależnić się od sieci energetycznej",
          "Idealne dla domów z pompą ciepła i samochodem elektrycznym"
        ]
      },
      {
        title: "Technologie i pojemności",
        content: "Najpopularniejsze rozwiązania na rynku:",
        bullets: [
          "Technologia LFP (litowo-żelazowo-fosforanowa) – najbezpieczniejsza",
          "Typowe pojemności: 5 kWh, 10 kWh, 15 kWh",
          "Żywotność: 6000-8000 cykli ładowania",
          "Sprawność ładowania/rozładowania: ~95%",
          "Popularne marki: Huawei LUNA, BYD, Pylontech, Deye"
        ]
      },
      {
        title: "Dobór pojemności",
        content: "Jak dobrać odpowiedni magazyn energii:",
        bullets: [
          "Zasada: pojemność ≈ dzienne zużycie wieczorne/nocne (5-15 kWh)",
          "Dla 4-osobowej rodziny typowo: 5-10 kWh",
          "Z pompą ciepła: rozważ 10-15 kWh",
          "Z samochodem elektrycznym: minimum 10 kWh",
          "Koszt: ok. 2500-4000 zł za 1 kWh pojemności"
        ]
      }
    ]
  },
  {
    id: "dotacje",
    icon: Lightbulb,
    title: "Dotacje i finansowanie",
    color: "rose",
    sections: [
      {
        title: "Programy dofinansowania",
        content: "Aktualne programy wspierające OZE w Polsce:",
        bullets: [
          "Mój Prąd 6.0 – dofinansowanie PV, magazynów energii, pomp ciepła",
          "Czyste Powietrze – wymiana ogrzewania + termomodernizacja",
          "Moje Ciepło – dofinansowanie do pomp ciepła",
          "Ulga termomodernizacyjna – odliczenie od podatku do 53 000 zł",
          "Agroenergia – dla rolników i gospodarstw rolnych"
        ]
      },
      {
        title: "Mój Prąd 6.0 – szczegóły",
        content: "Najważniejsze informacje o programie Mój Prąd:",
        bullets: [
          "Dofinansowanie do instalacji PV: do 7 000 zł",
          "Magazyn energii: do 16 000 zł",
          "System zarządzania energią (HEMS): do 3 000 zł",
          "Pompa ciepła: do 19 400 zł (powietrze-woda)",
          "Kolektory słoneczne: do 3 500 zł",
          "Warunek: podłączenie do sieci i net-billing"
        ]
      }
    ]
  }
];

const colorClasses = {
  yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", gradient: "from-yellow-500 to-amber-600" },
  green: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", gradient: "from-green-500 to-emerald-600" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", gradient: "from-blue-500 to-cyan-600" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", gradient: "from-purple-500 to-violet-600" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", gradient: "from-rose-500 to-pink-600" },
};

export default function Education() {
  const [openTopic, setOpenTopic] = useState(null);
  const [openSections, setOpenSections] = useState({});

  const toggleTopic = (id) => setOpenTopic(openTopic === id ? null : id);
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title="Edukacja"
        subtitle="Fotowoltaika, pompy ciepła, magazyny energii, dotacje"
        color="purple"
      />

      <div className="space-y-3">
        {topics.map((topic) => {
          const c = colorClasses[topic.color];
          const isOpen = openTopic === topic.id;

          return (
            <div key={topic.id} className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => toggleTopic(topic.id)}
                className={`w-full flex items-center gap-4 p-5 transition-all text-left ${
                  isOpen ? `${c.bg}` : "bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shrink-0`}>
                  <topic.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white">{topic.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{topic.sections.length} rozdziałów</p>
                </div>
                <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-2 border-t border-white/5">
                      {topic.sections.map((section, i) => {
                        const sKey = `${topic.id}-${i}`;
                        const sOpen = openSections[sKey];

                        return (
                          <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden">
                            <button
                              onClick={() => toggleSection(sKey)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.03] transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg ${c.bg} flex items-center justify-center text-xs font-bold ${c.text}`}>
                                  {i + 1}
                                </span>
                                <span className="text-sm font-medium text-gray-200">{section.title}</span>
                              </div>
                              <motion.div animate={{ rotate: sOpen ? 180 : 0 }}>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </motion.div>
                            </button>

                            <AnimatePresence>
                              {sOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 pt-1">
                                    <p className="text-sm text-gray-400 leading-relaxed mb-3">{section.content}</p>
                                    <ul className="space-y-2">
                                      {section.bullets.map((bullet, j) => (
                                        <motion.li
                                          key={j}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: j * 0.05 }}
                                          className={`flex items-start gap-2 text-sm text-gray-300 pl-3 border-l-2 ${c.border} py-1`}
                                        >
                                          <span>{bullet}</span>
                                        </motion.li>
                                      ))}
                                    </ul>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}