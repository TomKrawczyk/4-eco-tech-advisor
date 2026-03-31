import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Send, Archive } from "lucide-react";

export default function RejectedMeetings() {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: acceptances = [] } = useQuery({
    queryKey: ["rejectedMeetings"],
    queryFn: async () => {
      const accs = await base44.entities.MeetingAcceptance.filter({
        in_rejected_pool: true
      });
      return accs;
    }
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => base44.entities.MeetingAssignment.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list()
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list()
  });

  // Mapuj acceptances do assignments
  const rejectedMeetings = useMemo(() => {
    return acceptances
      .map(acc => {
        const assignment = assignments.find(a => a.id === acc.meeting_assignment_id);
        return assignment ? { ...assignment, ...acc } : null;
      })
      .filter(Boolean)
      .filter(m => {
        const matchesUser = !selectedUser || m.assigned_user_email === selectedUser;
        const matchesGroup = !selectedGroup || m.assigned_group_id === selectedGroup;
        const matchesSearch = !searchTerm || 
          m.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.client_phone?.includes(searchTerm);
        return matchesUser && matchesGroup && matchesSearch;
      });
  }, [acceptances, assignments, selectedUser, selectedGroup, searchTerm, users]);

  const reassignMutation = useMutation({
    mutationFn: async ({ meetingId, userEmail, groupId }) => {
      const user = users.find(u => u.email === userEmail);
      await base44.entities.MeetingAssignment.update(meetingId, {
        assigned_user_email: userEmail,
        assigned_user_name: user?.name,
        assigned_group_id: groupId,
        assigned_group_name: groups.find(g => g.id === groupId)?.name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rejectedMeetings"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    }
  });

  if (acceptances.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Brak odrzuconych spotkań</h2>
        <p className="text-gray-600 text-sm">Wszystkie spotkania zostały zaakceptowane.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pula odrzuconych spotkań"
        subtitle="Spotkania odrzucone 2+ razy przez handlowców"
      />

      {/* Filtry */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Szukaj klienta</label>
            <Input
              placeholder="Nazwa lub telefon"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Grupa</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Wszystkie grupy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Wszystkie grupy</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Handlowiec</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Wszyscy handlowcy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Wszyscy handlowcy</SelectItem>
                {users.filter(u => ['user', 'team_leader'].includes(u.role)).map(u => (
                  <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-gray-600">
              <strong>{rejectedMeetings.length}</strong> spotkań
            </div>
          </div>
        </div>
      </Card>

      {/* Lista spotkań */}
      <div className="space-y-2">
        {rejectedMeetings.map(meeting => (
          <RejectedMeetingCard
            key={meeting.id}
            meeting={meeting}
            users={users}
            groups={groups}
            onReassign={(userEmail, groupId) => {
              reassignMutation.mutate({
                meetingId: meeting.id,
                userEmail,
                groupId
              });
            }}
            isLoading={reassignMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function RejectedMeetingCard({ meeting, users, groups, onReassign, isLoading }) {
  const [showReassign, setShowReassign] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  const handleReassign = () => {
    if (selectedUser && selectedGroup) {
      onReassign(selectedUser, selectedGroup);
      setShowReassign(false);
      setSelectedUser("");
      setSelectedGroup("");
    }
  };

  return (
    <Card className="p-4 border-red-200 bg-red-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{meeting.client_name}</div>
          <div className="text-xs text-gray-600 mt-1 space-y-1">
            <div>📱 {meeting.client_phone}</div>
            <div>📍 {meeting.client_address}</div>
            <div>📅 {meeting.meeting_calendar}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Odrzucono {meeting.rejection_count}x
          </div>
        </div>
      </div>

      {meeting.rejection_reason && (
        <div className="bg-white rounded p-2 mb-3 text-xs text-gray-700 border border-red-100">
          <strong>Ostatni powód:</strong> {meeting.rejection_reason}
        </div>
      )}

      {!showReassign ? (
        <Button
          onClick={() => setShowReassign(true)}
          size="sm"
          variant="outline"
          className="gap-1"
        >
          <Send className="w-3 h-3" />
          Przypisz innym
        </Button>
      ) : (
        <div className="space-y-2 bg-white p-3 rounded border border-red-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Grupa</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Wybierz grupę" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Handlowiec</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => ['user', 'team_leader'].includes(u.role)).map(u => (
                    <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              onClick={() => setShowReassign(false)}
              size="sm"
              variant="ghost"
              disabled={isLoading}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleReassign}
              size="sm"
              disabled={!selectedUser || !selectedGroup || isLoading}
            >
              Potwierdź
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}