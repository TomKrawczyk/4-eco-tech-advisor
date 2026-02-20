import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileText, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function ReportSelector({ onSelectReport, currentReport }) {
  const [showDialog, setShowDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const userAccess = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (userAccess) {
        user.displayName = userAccess.data?.name || userAccess.name;
      }
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: reports = [] } = useQuery({
    queryKey: ['visitReports'],
    queryFn: () => base44.entities.VisitReport.list('-updated_date', 50),
  });

  const handleCreateNew = async () => {
    if (!newClientName.trim()) return;
    setCreating(true);
    const newReport = await base44.entities.VisitReport.create({
      client_name: newClientName,
      visit_date: new Date().toISOString().split("T")[0],
      status: "draft",
      author_name: currentUser?.displayName || currentUser?.full_name || currentUser?.email || "",
      author_email: currentUser?.email || "",
    });
    setCreating(false);
    setShowDialog(false);
    setNewClientName("");
    onSelectReport(newReport);
  };

  if (currentReport) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{currentReport.client_name}</div>
              <div className="text-sm text-gray-600">
                {currentReport.visit_date ? new Date(currentReport.visit_date).toLocaleDateString('pl-PL') : 'Brak daty'}
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDialog(true)}
            className="text-gray-600"
          >
            Zmień raport
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Wybierz lub utwórz raport</h3>
            <p className="text-sm text-gray-600">Kontynuuj istniejący raport lub rozpocznij nowy</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Wybierz raport
          </Button>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wybierz lub utwórz raport</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium text-gray-900">Utwórz nowy raport</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Imię i nazwisko klienta"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateNew()}
                />
                <Button 
                  onClick={handleCreateNew}
                  disabled={!newClientName.trim() || creating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Utwórz
                </Button>
              </div>
            </div>

            {/* Existing Reports */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">Ostatnie raporty</Label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {reports.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Brak raportów
                  </div>
                ) : (
                  reports.map((report) => (
                    <motion.button
                      key={report.id}
                      onClick={() => {
                        onSelectReport(report);
                        setShowDialog(false);
                      }}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{report.client_name}</div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'Brak daty'}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>
                              Zaktualizowano: {new Date(report.updated_date).toLocaleDateString('pl-PL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}