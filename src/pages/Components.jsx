import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Star, ExternalLink, Zap, Battery, Box } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";

export default function ComponentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("power");

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['components'],
    queryFn: () => base44.entities.Component.list(),
  });

  const typeIcons = {
    panel: Box,
    inverter: Zap,
    storage: Battery
  };

  const typeLabels = {
    panel: "Panel PV",
    inverter: "Falownik",
    storage: "Magazyn energii"
  };

  const filtered = components
    .filter(c => {
      const matchesType = typeFilter === "all" || c.type === typeFilter;
      const matchesSearch = 
        c.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
        c.model?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "power") return (b.power || 0) - (a.power || 0);
      if (sortBy === "price") return (a.price || 0) - (b.price || 0);
      if (sortBy === "efficiency") return (b.efficiency || 0) - (a.efficiency || 0);
      return 0;
    });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Baza komponentów" 
        subtitle="Porównaj i wybierz najlepsze komponenty dla instalacji"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Szukaj producenta lub modelu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Typ komponentu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie typy</SelectItem>
              <SelectItem value="panel">Panele PV</SelectItem>
              <SelectItem value="inverter">Falowniki</SelectItem>
              <SelectItem value="storage">Magazyny energii</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sortuj według" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="power">Moc (malejąco)</SelectItem>
              <SelectItem value="price">Cena (rosnąco)</SelectItem>
              <SelectItem value="efficiency">Sprawność (malejąco)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Ładowanie komponentów...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Nie znaleziono komponentów spełniających kryteria
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((component) => {
            const Icon = typeIcons[component.type];
            return (
              <motion.div
                key={component.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[component.type]}
                      </Badge>
                    </div>
                  </div>
                  {component.is_recommended && (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  )}
                </div>

                <h3 className="font-bold text-gray-900 mb-1">{component.manufacturer}</h3>
                <p className="text-sm text-gray-600 mb-3">{component.model}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Moc:</span>
                    <span className="font-semibold text-gray-900">
                      {component.power} {component.type === 'panel' ? 'Wp' : component.type === 'storage' ? 'kWh' : 'kW'}
                    </span>
                  </div>
                  {component.efficiency && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sprawność:</span>
                      <span className="font-semibold text-gray-900">{component.efficiency}%</span>
                    </div>
                  )}
                  {component.warranty_years && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Gwarancja:</span>
                      <span className="font-semibold text-gray-900">{component.warranty_years} lat</span>
                    </div>
                  )}
                  {component.price && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cena:</span>
                      <span className="font-semibold text-green-600">{component.price.toLocaleString()} zł</span>
                    </div>
                  )}
                </div>

                {component.features && component.features.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {component.features.slice(0, 3).map((feature, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {component.datasheet_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(component.datasheet_url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Karta katalogowa
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}