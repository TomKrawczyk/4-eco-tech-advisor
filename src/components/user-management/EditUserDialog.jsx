import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Key, Loader2, RotateCcw, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

export default function EditUserDialog({ user, open, onClose, onSave, onRefresh, allUsers, groups }) {
  const [formData, setFormData] = useState({
    name: "",
    role: "advisor",
    notes: "",
    group_id: "",
    assigned_to: ""
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetReports, setShowResetReports] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resettingReports, setResettingReports] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockUntilDate, setBlockUntilDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.data?.name || user.name || "",
        role: user.data?.role || user.role || "advisor",
        notes: user.data?.notes || user.notes || "",
        group_id: user.data?.group_id || user.group_id || "",
        assigned_to: user.data?.assigned_to || user.assigned_to || ""
      });
    }
  }, [user]);

  const availableLeaders = allUsers.filter(u => {
    if (u.id === user?.id) return false;
    const userRole = u.data?.role || u.role;
    const subordinateRoles = ["advisor", "test_user", "serviceman", "auditor"];
    if (subordinateRoles.includes(formData.role)) return userRole === "team_leader" || userRole === "group_leader";
    if (formData.role === "team_leader") return userRole === "group_leader";
    return false;
  });

  const handleSave = () => {
    const updates = { ...formData };
    if (!updates.assigned_to) delete updates.assigned_to;
    if (!updates.group_id) delete updates.group_id;
    if (!updates.notes) delete updates.notes;
    onSave(user.id, updates);
  };

  const handleResetReports = async () => {
    setResettingReports(true);
    setShowResetReports(false);
    try {
      const userEmail = user?.email || user?.data?.email;
      const userName = formData.name || user?.data?.name || user?.name || "";

      // Pobierz wszystkie przypisania spotkań tego użytkownika
      const [assignments, existingReports] = await Promise.all([
        base44.entities.MeetingAssignment.filter({ assigned_user_email: userEmail }),
        base44.entities.MeetingReport.filter({ author_email: userEmail }),
      ]);

      const today = new Date();
      const normalizePhone = p => (p || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
      const normalizeName = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

      // Znajdź przypisania bez raportu (przeszłe)
      const missing = assignments.filter(a => {
        const dateStr = a.meeting_date || a.meeting_calendar;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d) || d >= today) return false;

        const aPhone = normalizePhone(a.client_phone);
        const aName = normalizeName(a.client_name);

        return !existingReports.some(r => {
          const rPhone = normalizePhone(r.client_phone);
          const rName = normalizeName(r.client_name);
          const phoneMatch = aPhone.length >= 7 && rPhone.length >= 7 && aPhone === rPhone;
          const nameMatch = rName === aName || (rName.length > 2 && aName.startsWith(rName)) || (aName.length > 2 && rName.startsWith(aName));
          return phoneMatch || nameMatch;
        });
      });

      // Utwórz raporty completed dla każdego brakującego spotkania
      await Promise.all(missing.map(a =>
        base44.entities.MeetingReport.create({
          client_name: a.client_name,
          client_phone: a.client_phone || "",
          client_address: a.client_address || "",
          meeting_date: a.meeting_date || a.meeting_calendar?.split(' ')[0] || new Date().toISOString().split('T')[0],
          status: "completed",
          description: "Raport wyzerowany przez administratora",
          author_name: userName,
          author_email: userEmail,
        })
      ));

      // Zeruj licznik i odblokuj
      await base44.entities.AllowedUser.update(user.id, {
        missing_reports_count: 0,
        is_blocked: false,
        blocked_reason: ""
      });

      toast.success(`Licznik wyzerowany. Uzupełniono ${missing.length} brakujących raportów.`);
    } catch (error) {
      toast.error('Błąd: ' + error.message);
    } finally {
      setResettingReports(false);
    }
  };

  const blockedUntilValue = user?.data?.blocked_until || user?.blocked_until || "";
  const isAdminBlocked = blockedUntilValue
    ? new Date(blockedUntilValue) >= new Date(new Date().toISOString().split("T")[0])
    : false;

  const handleAdminBlock = async () => {
    if (!blockUntilDate) return;
    setSavingBlock(true);
    try {
      await base44.entities.AllowedUser.update(user.id, {
        is_blocked: true,
        blocked_until: blockUntilDate,
        blocked_reason: blockReason || "Blokada administracyjna",
      });
      sessionStorage.removeItem('layout_user_cache');
      toast.success(`Użytkownik zablokowany do ${blockUntilDate}`);
      setShowBlockDialog(false);
      setBlockUntilDate("");
      setBlockReason("");
      onRefresh();
    } catch (error) {
      toast.error("Błąd: " + error.message);
    } finally {
      setSavingBlock(false);
    }
  };

  const handleAdminUnblock = async () => {
    setSavingBlock(true);
    try {
      await base44.entities.AllowedUser.update(user.id, {
        is_blocked: false,
        blocked_until: "",
        blocked_reason: "",
      });
      sessionStorage.removeItem('layout_user_cache');
      toast.success("Blokada administracyjna zdjęta");
      onRefresh();
    } catch (error) {
      toast.error("Błąd: " + error.message);
    } finally {
      setSavingBlock(false);
    }
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    try {
      await base44.functions.invoke('sendPasswordResetEmail', {
        targetEmail: user?.email || user?.data?.email,
        targetName: formData.name
      });
      toast.success('Email ze wskazówkami resetowania został wysłany');
      setShowResetPassword(false);
    } catch (error) {
      toast.error('Błąd: ' + error.message);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edytuj użytkownika</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email || user?.data?.email || ""} disabled className="bg-gray-50" />
          </div>
          <div>
            <Label>Imię</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Rola</Label>
            <Select value={formData.role} onValueChange={(val) => {
              setFormData(prev => ({
                ...prev,
                role: val,
                assigned_to: (val === "admin" || val === "group_leader" || val === "hr_admin") ? "" : prev.assigned_to
              }));
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advisor">Doradca</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="group_leader">Lider grupy</SelectItem>
                <SelectItem value="hr_admin">Administrator HR</SelectItem>
                <SelectItem value="test_user">Użytkownik testowy</SelectItem>
                <SelectItem value="serviceman">Serwisant</SelectItem>
                <SelectItem value="auditor">Audytor</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div>
              <Label>Grupa</Label>
              <Select value={formData.group_id} onValueChange={(val) => setFormData({ ...formData, group_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz grupę..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Brak grupy</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {(["advisor","team_leader","test_user","serviceman","auditor"].includes(formData.role)) && availableLeaders.length > 0 && (
            <div>
              <Label>Przypisz do {formData.role === "team_leader" ? "Group Leadera" : "Team/Group Leadera"}</Label>
              <Select value={formData.assigned_to} onValueChange={(val) => setFormData({ ...formData, assigned_to: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Brak przypisania</SelectItem>
                  {availableLeaders.map(leader => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.data?.name || leader.name} — {leader.data?.email || leader.email} ({leader.data?.role || leader.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Notatki</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Dodatkowe informacje"
            />
          </div>
        </div>
        {isAdminBlocked && (
          <div className="mx-0 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Blokada administracyjna aktywna do <strong>{user?.data?.blocked_until || user?.blocked_until}</strong>
              {(user?.data?.blocked_reason || user?.blocked_reason) && ` — ${user?.data?.blocked_reason || user?.blocked_reason}`}
            </span>
          </div>
        )}
        <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setShowResetReports(true)}
              disabled={resettingReports}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              {resettingReports ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Zeruj raporty
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowResetPassword(true)}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <Key className="w-4 h-4 mr-2" />
              Resetuj hasło
            </Button>
            {isAdminBlocked ? (
              <Button
                variant="outline"
                onClick={handleAdminUnblock}
                disabled={savingBlock}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                {savingBlock ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LockOpen className="w-4 h-4 mr-2" />}
                Odblokuj
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowBlockDialog(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Lock className="w-4 h-4 mr-2" />
                Zablokuj czasowo
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={handleSave}>Zapisz zmiany</Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showResetReports} onOpenChange={setShowResetReports}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerowanie zaległych raportów</AlertDialogTitle>
            <AlertDialogDescription>
              Operacja automatycznie uzupełni wszystkie brakujące raporty dla <strong>{user?.data?.name || user?.name}</strong> ze statusem "zakończone" i odblokuje konto. Baner z zaległościami przestanie się wyświetlać. Czy kontynuować?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetReports}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Tak, zeruj raporty
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blokada czasowa użytkownika</AlertDialogTitle>
            <AlertDialogDescription>
              Użytkownik <strong>{user?.data?.name || user?.name}</strong> zostanie zablokowany do wybranej daty włącznie. Blokada działa niezależnie od raportów – nawet jeśli uzupełni wszystkie, nie odzyska dostępu przed tą datą.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm mb-1 block">Zablokuj do daty *</Label>
              <input
                type="date"
                value={blockUntilDate}
                onChange={e => setBlockUntilDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <Label className="text-sm mb-1 block">Powód blokady (opcjonalnie)</Label>
              <input
                type="text"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="np. naruszenie regulaminu, nieobecność..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setBlockUntilDate(""); setBlockReason(""); }}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdminBlock}
              disabled={!blockUntilDate || savingBlock}
              className="bg-red-600 hover:bg-red-700"
            >
              {savingBlock && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Zablokuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetowanie hasła</AlertDialogTitle>
            <AlertDialogDescription>
              Email ze wskazówkami resetowania hasła będzie wysłany na adres <strong>{user?.email || user?.data?.email}</strong>. Użytkownik będzie mógł zmienić hasło poprzez stronę logowania.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetPassword}
              disabled={resettingPassword}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {resettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Wyślij email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}