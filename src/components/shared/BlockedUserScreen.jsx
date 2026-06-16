import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function BlockedUserScreen({ currentUser }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-100" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Konto zablokowane</h1>
              <p className="text-sm text-green-50">Dostęp do głównych funkcji został tymczasowo ograniczony.</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="text-sm font-semibold text-red-800 mb-2">Powód blokady</div>
            <p className="text-sm text-red-700">{currentUser?.blocked_reason || "Brak wymaganego raportowania."}</p>
            {currentUser?.blocked_at && (
              <p className="text-xs text-red-600 mt-2">Zablokowano: {new Date(currentUser.blocked_at).toLocaleString("pl-PL")}</p>
            )}
          </div>

          <p className="text-sm text-gray-600 leading-6">
            Uzupełnij zaległe raporty — konto zostanie odblokowane automatycznie po ich uzupełnieniu
            <span className="font-medium text-gray-900"> w ciągu doby</span> lub skontaktuj się z przełożonym.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link to={createPageUrl("MeetingReports")}>
                <FileText className="w-4 h-4 mr-2" />
                Uzupełnij raport po spotkaniu
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
              <Link to={createPageUrl("PhoneContacts")}>
                <Phone className="w-4 h-4 mr-2" />
                Uzupełnij raport po kontakcie
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}