import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function MeetingAcceptanceModal({ meeting, open, onOpenChange, onDecisionMade }) {
  const [rejectionReason, setRejectionReason] = useState("");

  const handleAcceptanceMutation = useMutation({
    mutationFn: ({ status, reason }) => {
      return base44.functions.invoke("handleMeetingAcceptance", {
        assignmentId: meeting?.id,
        status,
        reason,
      });
    },
    onSuccess: () => {
      toast.success("Twoja decyzja została zapisana.");
      setRejectionReason("");
      onDecisionMade?.();
    },
    onError: (error) => {
      toast.error(error.message || "Wystąpił błąd.");
    },
  });

  const handleAccept = () => {
    handleAcceptanceMutation.mutate({ status: "accepted" });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.warning("Podaj powód odrzucenia.");
      return;
    }
    handleAcceptanceMutation.mutate({ status: "rejected", reason: rejectionReason });
  };

  if (!meeting) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Blokujemy zamknięcie bez decyzji – jedynie rodzic może to wymusić
        if (!isOpen && !onDecisionMade) return;
        onOpenChange?.(isOpen);
      }}
    >
      <DialogContent
        // Wyłącz zamknięcie przez kliknięcie poza / escape gdy wymagana decyzja
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Potwierdź decyzję</DialogTitle>
          <DialogDescription>
            Spotkanie z <span className="font-semibold">{meeting.client_name}</span> w dniu{" "}
            <span className="font-semibold">{meeting.meeting_calendar}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-orange-50 border-l-4 border-orange-400 text-orange-800 p-3 rounded-r-lg text-xs">
            <div className="flex gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                Musisz podjąć decyzję — zaakceptować lub odrzucić to spotkanie.{" "}
                <strong>Nie możesz pominąć tego kroku.</strong> Wielokrotne odrzucenia mogą prowadzić do tymczasowej blokady konta.
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="rejectionReason">
              Powód odrzucenia <span className="text-gray-400 font-normal">(wymagane tylko przy odrzuceniu)</span>
            </label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="np. Błędny adres, klient nieodbiera, rezygnacja klienta..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!rejectionReason.trim() || handleAcceptanceMutation.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Odrzuć
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            disabled={handleAcceptanceMutation.isPending}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Akceptuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}