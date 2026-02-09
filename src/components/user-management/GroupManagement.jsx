import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Users } from "lucide-react";
import { toast } from "react-hot-toast";

export default function GroupManagement({ allowedUsers }) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupLeaderId, setGroupLeaderId] = useState("");
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
                return (
                  <div key={group.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGroupMutation.mutate(group.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{usersInGroup.length} użytkowników w grupie</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}