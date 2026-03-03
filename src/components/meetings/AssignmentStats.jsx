import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart2, Calendar, Phone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AssignmentStats({ onClose }) {
  const { data: meetingAssignments = [] } = useQuery({
    queryKey: ["meetingAssignmentsStats"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
  });

  const { data: phoneContacts = [] } = useQuery({
    queryKey: ["phoneContactsStats"],
    queryFn: () => base44.entities.PhoneContact.list(),
  });

  // Policz przypisania spotkań per handlowiec
  const meetingStats = React.useMemo(() => {
    const map = {};
    meetingAssignments.forEach(a => {
      const email = a.assigned_user_email;
      const name = a.assigned_user_name || email;
      if (!email) return;
      if (!map[email]) map[email] = { name, count: 0 };
      map[email].count++;
    });
    return Object.entries(map)
      .map(([email, v]) => ({ email, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [meetingAssignments]);

  // Policz przypisania kontaktów telefonicznych per handlowiec
  const contactStats = React.useMemo(() => {
    const map = {};
    phoneContacts.forEach(c => {
      const email = c.assigned_user_email;
      const name = c.assigned_user_name || email;
      if (!email) return;
      if (!map[email]) map[email] = { name, count: 0 };
      map[email].count++;
    });
    return Object.entries(map)
      .map(([email, v]) => ({ email, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [phoneContacts]);

  const maxMeeting = meetingStats[0]?.count || 1;
  const maxContact = contactStats[0]?.count || 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">Statystyki przypisań</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Spotkania */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="w-3.5 h-3.5 text-violet-600" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Spotkania</span>
          <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
            {meetingAssignments.length} łącznie
          </Badge>
        </div>
        {meetingStats.length === 0 ? (
          <p className="text-xs text-gray-400">Brak przypisań</p>
        ) : (
          <div className="space-y-1.5">
            {meetingStats.map(({ email, name, count }) => (
              <div key={email}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 truncate max-w-[140px]">{name}</span>
                  <span className="text-xs font-bold text-violet-700 shrink-0">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full transition-all"
                    style={{ width: `${(count / maxMeeting) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kontakty */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Phone className="w-3.5 h-3.5 text-orange-600" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Kontakty tel.</span>
          <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
            {phoneContacts.filter(c => c.assigned_user_email).length} łącznie
          </Badge>
        </div>
        {contactStats.length === 0 ? (
          <p className="text-xs text-gray-400">Brak przypisań</p>
        ) : (
          <div className="space-y-1.5">
            {contactStats.map(({ email, name, count }) => (
              <div key={email}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 truncate max-w-[140px]">{name}</span>
                  <span className="text-xs font-bold text-orange-700 shrink-0">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all"
                    style={{ width: `${(count / maxContact) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}