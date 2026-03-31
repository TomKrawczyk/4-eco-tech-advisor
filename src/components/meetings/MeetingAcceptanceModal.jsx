import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function MeetingAcceptanceModal({ meeting, open, onOpenChange }) {
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["rejectedMeetings"] });
      queryClient.invalidateQueries({ queryKey: ["myMeetingAcceptances"] });
      onOpenChange(false);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Wystąpił błąd.");
    },
  });

  const handleAccept = () => {
    handleAcceptanceMutation.mutate({ status: "accepted" });
  };

  const handleReject = () => {
    if (!rejectionReason) {
      toast.warning("Podaj powód odrzucenia.");
      return;
    }
    handleAcceptanceMutation.mutate({ status: "rejected", reason: rejectionReason });
  };

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setRejectionReason("");
        onOpenChange(isOpen);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Potwierdź decyzję</DialogTitle>
          <DialogDescription>
            Spotkanie z <span className="font-semibold">{meeting.client_name}</span> w dniu {meeting.meeting_calendar}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <p className="text-sm">Czy akceptujesz to spotkanie?</p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-3 rounded-r-lg text-xs">
                <div className="flex">
                    <div className="py-1"><AlertTriangle className="h-4 w-4 text-yellow-500 mr-3"/></div>
                    <div>
                        Odrzucenie spotkania będzie odnotowane. Wielokrotne odrzucenia mogą prowadzić do tymczasowej blokady konta.
                    </div>
                </div>
            </div>
            <div>
                <label className="text-sm font-medium" htmlFor="rejectionReason">
                    Powód odrzucenia (wymagane jeśli odrzucasz)
                </label>
                <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="np. Błędny adres, klient nieodbiera, rezygnacja klienta..."
                    className="mt-1"
                />
            </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason || handleAcceptanceMutation.isPending}
            >
                <XCircle className="w-4 h-4 mr-2" />
                Odrzuć
            </Button>
            <Button
                variant="default"
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