import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function MeetingAcceptanceModal({ meeting, open, onClose }) {
  const [mode, setMode] = useState(null); // 'reject' or null
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReject = async () => {
    if (!reason.trim()) {
      setError("Powód jest obowiązkowy");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await base44.functions.invoke("handleMeetingAcceptance", {
        meeting_assignment_id: meeting.id,
        status: "rejected",
        rejection_reason: reason
      });

      if (response.data.in_rejected_pool) {
        alert("Spotkanie odrzucone po raz drugi i trafiło do puli dla administratora.");
      } else {
        alert("Spotkanie odrzucone i zwrócone do Twojego menadżera.");
      }

      onClose(true);
    } catch (err) {
      setError(err.message || "Błąd podczas odrzucania");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    setError("");

    try {
      await base44.functions.invoke("handleMeetingAcceptance", {
        meeting_assignment_id: meeting.id,
        status: "accepted"
      });

      alert("Spotkanie zaakceptowane!");
      onClose(true);
    } catch (err) {
      setError(err.message || "Błąd podczas akceptacji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Czy przyjmujesz to spotkanie?</DialogTitle>
          <DialogDescription>
            {meeting?.client_name} - {meeting?.meeting_calendar}
          </DialogDescription>
        </DialogHeader>

        {!mode && (
          <div className="space-y-3 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div className="font-semibold mb-1">Szczegóły spotkania:</div>
              <div className="space-y-1 text-xs">
                <div><strong>Klient:</strong> {meeting?.client_name}</div>
                <div><strong>Telefon:</strong> {meeting?.client_phone}</div>
                <div><strong>Adres:</strong> {meeting?.client_address}</div>
                <div><strong>Data:</strong> {meeting?.meeting_calendar}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Akceptuj
              </Button>
              <Button
                onClick={() => setMode("reject")}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4" />
                Odrzuć
              </Button>
            </div>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-3 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm font-semibold text-red-800 mb-2">Potwierdź odrzucenie spotkania</div>
              <div className="text-xs text-red-700 mb-3">
                Spotkanie wróci do Twojego menadżera. Jeśli zostanie odrzucone ponownie, trafi do puli dla administratora.
              </div>

              <label className="block text-xs font-medium text-gray-700 mb-2">
                Powód odrzucenia *
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Wpisz powód odrzucenia (np. brak dostępności, złe dane klienta, itp.)"
                className="text-sm mb-3"
                rows={4}
              />

              {error && <div className="text-xs text-red-600 mb-2">{error}</div>}

              <div className="flex gap-2">
                <Button
                  onClick={() => setMode(null)}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={loading || !reason.trim()}
                  variant="destructive"
                  className="flex-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Potwierdź odrzucenie
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}