import React from "react";
import { Shield } from "lucide-react";

export default function ChecklistAccessNotice() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak dostępu do checklisty</h3>
      <p className="text-sm text-gray-600">Ta wersja checklisty nie jest przypisana do Twojej grupy.</p>
    </div>
  );
}