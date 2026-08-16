import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { Input } from "@/components/ui/input";
import { EyeOff, Search, ShieldAlert } from "lucide-react";
import HiddenLeadRow from "@/components/contact-packages/HiddenLeadRow";
import { isHiddenFromAdvisor } from "@/components/contact-packages/leadExpiry";

export default function HiddenLeads() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [search, setSearch] = useState("");
  const isAdmin = currentUser?.role === "admin";

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["hidden-leads"],
    queryFn: () => base44.entities.ContactLead.filter({ status: { $in: ["not_interested", "no_answer", "wrong_number"] } }, "-updated_date", 5000),
    enabled: isAdmin,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["contact-packages-names"],
    queryFn: () => base44.entities.ContactPackage.list(),
    enabled: isAdmin,
  });

  const packageNames = useMemo(() => {
    const map = {};
    packages.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [packages]);

  const hidden = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return leads
      .filter(l => isHiddenFromAdvisor(l, now))
      .filter(l => !q ||
        l.client_name?.toLowerCase().includes(q) ||
        l.client_phone?.includes(search.trim()) ||
        l.assigned_user_name?.toLowerCase().includes(q) ||
        l.assigned_user_email?.toLowerCase().includes(q)
      );
  }, [leads, search]);

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-center">
        <div>
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">Ta zakładka jest dostępna tylko dla administratora.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ukryte kontakty</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kontakty ukryte handlowcom: niezainteresowani i błędne numery po 48 godzinach, brak odpowiedzi po 5 dniach od zmiany statusu.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Szukaj klienta lub handlowca..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : hidden.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <EyeOff className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Brak ukrytych kontaktów</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Ukrytych kontaktów: {hidden.length}</p>
          {hidden.map(lead => (
            <HiddenLeadRow key={lead.id} lead={lead} packageName={packageNames[lead.package_id]} />
          ))}
        </div>
      )}
    </div>
  );
}