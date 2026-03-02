import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, User } from "lucide-react";

export default function DetailsModal({ open, onOpenChange, data }) {
  if (!data) return null;

  const hasComments = data.comments?.trim();
  const hasAgent = data.agent?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Szczegóły kontaktu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasAgent && (
            <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase">Agent</span>
              </div>
              <p className="text-sm text-gray-800">{data.agent}</p>
            </div>
          )}

          {hasComments && (
            <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase">Komentarz</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.comments}</p>
            </div>
          )}

          {!hasComments && !hasAgent && (
            <p className="text-sm text-gray-500 text-center py-4">Brak szczegółów do wyświetlenia</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}