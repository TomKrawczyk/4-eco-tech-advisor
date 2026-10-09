import React from "react";

function Stat({ label, value, sub }) {
  return (
    <div className="text-center px-2">
      <div className="font-semibold text-gray-900 text-sm">{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

export default function GroupStatTable({ statsPerGroup, loading }) {
  if (loading) {
    return <div className="text-sm text-gray-400 py-6 text-center">Ładowanie statystyk…</div>;
  }
  if (!statsPerGroup || statsPerGroup.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Brak zarządzanych grup. Uzupełnij „Zarządzane grupy" w edycji swojego konta.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {statsPerGroup.map((s) => (
        <div key={s.group.id} className="bg-white rounded-xl border border-gray-200 p-3 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-12 sm:col-span-3 font-semibold text-gray-800 text-sm truncate">{s.group.name}</div>
          <div className="col-span-3 sm:col-span-2"><Stat label="Członk." value={s.members} /></div>
          <div className="col-span-3 sm:col-span-3"><Stat label="Spotkania" value={s.meetings} sub={`${s.meetingsAssigned} przypisane`} /></div>
          <div className="col-span-3 sm:col-span-2"><Stat label="Kontakty" value={s.contacts} sub={`${s.contactsAssigned} przypisane`} /></div>
          <div className="col-span-3 sm:col-span-2"><Stat label="Raporty" value={s.reports} /></div>
        </div>
      ))}
    </div>
  );
}