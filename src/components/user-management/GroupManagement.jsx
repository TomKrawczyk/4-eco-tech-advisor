import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Users, Edit, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";

export default function GroupManagement({ allowedUsers }) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupLeaderId, setGroupLeaderId] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: "", description: "", group_leader_id: "" });
  const [expandedGroups, setExpandedGroups] = useState([]);
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.Group.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["groups"]);
      setGroupName("");
      setGroupDescription("");
      setGroupLeaderId("");
      toast.success("Grupa utworzona");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.Group.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["groups"]);
      toast.success("Grupa usunięta");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Group.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["groups"]);
      setEditingGroup(null);
      toast.success("Grupa zaktualizowana");
    },
  });

  const groupLeaders = allowedUsers.filter(u => 
    (u.data?.role || u.role) === "group_leader"
  );

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!groupName) {
      toast.error("Nazwa grupy jest wymagana");
      return;
    }
    createGroupMutation.mutate({
      name: groupName,
      description: groupDescription,
      group_leader_id: groupLeaderId || undefined
    });
  };

  const getUsersInGroup = (groupId) => {
    return allowedUsers.filter(u => (u.data?.group_id || u.group_id) === groupId);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setEditFormData({
      name: group.name,
      description: group.description || "",
      group_leader_id: group.group_leader_id || ""
    });
  };

  const handleSaveEdit = () => {
    if (!editFormData.name) {
      toast.error("Nazwa grupy jest wymagana");
      return;
    }
    updateGroupMutation.mutate({
      id: editingGroup.id,
      data: {
        name: editFormData.name,
        description: editFormData.description || undefined,
        group_leader_id: editFormData.group_leader_id || undefined
      }
    });
  };

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Utwórz nową grupę</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <Label>Nazwa grupy *</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="np. Zespół Warszawa"
              />
            </div>
            <div>
              <Label>Opis</Label>
              <Input
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Opcjonalny opis grupy"
              />
            </div>
            <div>
              <Label>Group Leader</Label>
              <Select value={groupLeaderId} onValueChange={setGroupLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz group leadera..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Brak przypisania</SelectItem>
                  {groupLeaders.map(leader => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.data?.name || leader.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createGroupMutation.isPending}>
              {createGroupMutation.isPending ? "Tworzenie..." : "Utwórz grupę"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Istniejące grupy ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-gray-500 text-sm">Brak grup</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const usersInGroup = getUsersInGroup(group.id);
                const leader = groupLeaders.find(l => l.id === group.group_leader_id);
                const isExpanded = expandedGroups.includes(group.id);
                return (
                  <div key={group.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold">{group.name}</h4>
                        {group.description && (
                          <p className="text-sm text-gray-600">{group.description}</p>
                        )}
                        {leader && (
                          <p className="text-xs text-gray-500 mt-1">
                            Group Leader: {leader.data?.name || leader.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditGroup(group)}
                          title="Edytuj grupę"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                          title="Usuń grupę"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGroupExpanded(group.id)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sm text-gray-600 hover:bg-gray-50">
                          <Users className="w-4 h-4" />
                          <span>{usersInGroup.length} użytkowników w grupie</span>
                          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        {usersInGroup.length === 0 ? (
                          <p className="text-sm text-gray-500 pl-6">Brak użytkowników w tej grupie</p>
                        ) : (
                          <div className="space-y-1 pl-6">
                            {usersInGroup.map(user => (
                              <div key={user.id} className="text-sm py-1 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="font-medium">{user.data?.name || user.name}</span>
                                <span className="text-gray-500">({user.data?.email || user.email})</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  (user.data?.role || user.role) === "team_leader" ? "bg-green-100 text-green-700" :
                                  (user.data?.role || user.role) === "group_leader" ? "bg-blue-100 text-blue-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {
                                    (user.data?.role || user.role) === "team_leader" ? "Team Leader" :
                                    (user.data?.role || user.role) === "group_leader" ? "Group Leader" :
                                    "Użytkownik"
                                  }
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj grupę</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nazwa grupy *</Label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Opis</Label>
              <Input
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Group Leader</Label>
              <Select 
                value={editFormData.group_leader_id} 
                onValueChange={(val) => setEditFormData({ ...editFormData, group_leader_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz group leadera..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Brak przypisania</SelectItem>
                  {groupLeaders.map(leader => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.data?.name || leader.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>Anuluj</Button>
            <Button onClick={handleSaveEdit} disabled={updateGroupMutation.isPending}>
              {updateGroupMutation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}