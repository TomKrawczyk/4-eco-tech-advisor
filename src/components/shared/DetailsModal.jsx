import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, User, HelpCircle, Phone } from "lucide-react";

export default function DetailsModal({ open, onOpenChange, data }) {
  if (!data) return null;

  const hasPhone = data.phone?.trim();
  const hasComments = data.comments?.trim();
  const hasAgent = data.agent?.trim();
  const hasInterview = data.interview_data && Object.keys(data.interview_data).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

          {hasInterview && (
            <div className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase">Pytania i odpowiedzi</span>
              </div>
              <div className="space-y-3">
                {Object.entries(data.interview_data).map(([question, answer]) => (
                  <div key={question} className="bg-white rounded p-2.5">
                    <p className="text-xs font-semibold text-purple-700 mb-1">{question}</p>
                    <p className="text-sm text-gray-800">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasComments && !hasAgent && !hasInterview && (
            <p className="text-sm text-gray-500 text-center py-4">Brak szczegółów do wyświetlenia</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}