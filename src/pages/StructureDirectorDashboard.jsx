import React, { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { useDirectorData } from "@/components/director/useDirectorData";
import DirectorSummaryCards from "@/components/director/DirectorSummaryCards";
import GroupStatTable from "@/components/director/GroupStatTable";
import DirectorMeetingsList from "@/components/director/DirectorMeetingsList";
import DirectorContactsList from "@/components/director/DirectorContactsList";
import PageHeader from "@/components/shared/PageHeader";

export default function StructureDirectorDashboard() {
  const { currentUser, accessChecked } = useCurrentUser();
  const data = useDirectorData(currentUser, accessChecked);
  const [tab, setTab] = useState("meetings");

  useEffect(() => {
    if (accessChecked && currentUser) {
      import("@/lib/logActivity").then((m) => m.default({ action_type: "page_view", page_name: "StructureDirectorDashboard" }));
    }
  }, [accessChecked, currentUser]);

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (currentUser?.role !== "structure_director") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <ShieldAlert className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-lg font-semibold text-gray-800">Pulpit dyrektora struktury</h2>
        <p className="text-sm text-gray-500 mt-1">Ten widok jest dostępny tylko dla roli „Dyrektor struktury".</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pulpit dyrektora struktury" subtitle="Zbiorcze statystyki oraz spotkania i kontakty z zarządzanych grup" />

      <DirectorSummaryCards totals={data.totals} loading={data.loading} />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Statystyki według grup</h3>
        <GroupStatTable statsPerGroup={data.statsPerGroup} loading={data.loading} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-1 border-b border-gray-100 mb-4">
          <button
            onClick={() => setTab("meetings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "meetings" ? "border-green-500 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Spotkania ({data.meetings.length})
          </button>
          <button
            onClick={() => setTab("contacts")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "contacts" ? "border-green-500 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Kontakty ({data.contacts.length})
          </button>
        </div>
        {tab === "meetings" ? (
          <DirectorMeetingsList meetings={data.meetings} groupNameById={data.groupNameById} loading={data.loading} />
        ) : (
          <DirectorContactsList contacts={data.contacts} groupNameById={data.groupNameById} loading={data.loading} />
        )}
      </div>
    </div>
  );
}