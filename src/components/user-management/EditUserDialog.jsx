import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EditUserDialog({ user, open, onClose, onSave, allUsers, groups }) {
  const [formData, setFormData] = useState({
    name: "",
    role: "user",
    notes: "",
    group_id: "",
    assigned_to: ""
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.data?.name || user.name || "",
        role: user.data?.role || user.role || "user",
        notes: user.data?.notes || user.notes || "",
        group_id: user.data?.group_id || user.group_id || "",
        assigned_to: user.data?.assigned_to || user.assigned_to || ""
      });
    }
  }, [user]);

  const availableLeaders = allUsers.filter(u => {
    if (u.id === user?.id) return false;
    const userRole = u.data?.role || u.role;
    if (formData.role === "user") return userRole === "team_leader" || userRole === "group_leader";
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
              setFormData({ ...formData, role: val });
              if (val === "admin" || val === "group_leader") {
                setFormData(prev => ({ ...prev, assigned_to: "" }));
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Użytkownik</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="group_leader">Group Leader</SelectItem>
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
          {(formData.role === "user" || formData.role === "team_leader") && availableLeaders.length > 0 && (
            <div>
              <Label>Przypisz do {formData.role === "user" ? "Team/Group Leadera" : "Group Leadera"}</Label>
              <Select value={formData.assigned_to} onValueChange={(val) => setFormData({ ...formData, assigned_to: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Brak przypisania</SelectItem>
                  {availableLeaders.map(leader => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.data?.name || leader.name} ({leader.data?.role || leader.role})
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave}>Zapisz zmiany</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}