import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfDay } from "date-fns";
import { parseMeetingDate, extractTime, sheetGroupIdOf, isUpcoming } from "@/lib/directorHelpers";

/**
 * Ładuje i filtruje dane dla pulitu dyrektora struktury:
 *  - zarządzane grupy i ich członkowie
 *  - nadchodzące spotkania podlegające pod strukturę (arkusze/prypisania w zarządzanych grupach)
 *  - aktywne kontakty telefoniczne podlegające pod strukturę
 *  - raporty autorów z zarządzanych grup (spotkania + wizyty)
 */
export function useDirectorData(currentUser, accessReady) {
  const isDirector = currentUser?.role === "structure_director";
  const enabled = accessReady && isDirector;

  const managedGroupIds = useMemo(
    () => (isDirector ? currentUser?.managedGroupIds || [] : []),
    [isDirector, currentUser?.managedGroupIds],
  );

  const groupsQ = useQuery({ queryKey: ["groups"], queryFn: () => base44.entities.Group.list(), enabled });
  const allowedUsersQ = useQuery({ queryKey: ["allowedUsers"], queryFn: () => base44.entities.AllowedUser.list(), enabled });
  const sheetMappingsQ = useQuery({ queryKey: ["sheetMappings"], queryFn: () => base44.entities.SheetGroupMapping.list(), enabled });
  const assignmentsQ = useQuery({ queryKey: ["meetingAssignments"], queryFn: () => base44.entities.MeetingAssignment.list(), enabled });
  const hiddenQ = useQuery({ queryKey: ["hiddenMeetings"], queryFn: () => base44.entities.HiddenMeeting.list(), enabled });
  const cacheQ = useQuery({
    queryKey: ["directorMeetingsCache"],
    queryFn: async () => {
      const lite = await base44.entities.MeetingsCache.filter({ cache_key: "meetings_lite" }, "-updated_date", 1);
      if (lite[0]?.meetings_json?.meetings?.length) return lite[0];
      const rows = await base44.entities.MeetingsCache.filter({ cache_key: "meetings_main" }, "-updated_date", 1);
      return rows[0] || null;
    },
    enabled, staleTime: 60 * 1000, refetchInterval: 60 * 1000,
  });
  const phoneDBQ = useQuery({ queryKey: ["phoneContactsDB-director"], queryFn: () => base44.entities.PhoneContact.list(), enabled });
  const rawContactsQ = useQuery({
    queryKey: ["directorRawContacts"],
    queryFn: () => base44.functions.invoke("getMeetingsFromSheets"),
    select: (r) => (r?.data?.phoneContacts || []).filter((c) =>
      !c.sheet?.toLowerCase().includes("spotkania") &&
      !c.sheet?.toLowerCase().includes("kontakt") &&
      !c.sheet?.toLowerCase().includes("ai bober")),
    enabled, staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000,
  });
  const meetingReportsQ = useQuery({ queryKey: ["directorMeetingReports"], queryFn: () => base44.entities.MeetingReport.list("-created_date", 200), enabled });
  const visitReportsQ = useQuery({ queryKey: ["directorVisitReports"], queryFn: () => base44.entities.VisitReport.list("-created_date", 200), enabled });

  const groups = groupsQ.data || [];
  const allAllowedUsers = allowedUsersQ.data || [];
  const sheetMappings = sheetMappingsQ.data || [];
  const meetingAssignments = assignmentsQ.data || [];
  const hiddenMeetingKeys = useMemo(() => new Set((hiddenQ.data || []).map((h) => h.meeting_key)), [hiddenQ.data]);
  const allMeetings = cacheQ.data?.meetings_json?.meetings || [];
  const phoneContactsFromDB = phoneDBQ.data || [];
  const rawContacts = rawContactsQ.data || [];
  const meetingReports = meetingReportsQ.data || [];
  const visitReports = visitReportsQ.data || [];

  const loading = groupsQ.isLoading || allowedUsersQ.isLoading || cacheQ.isLoading || phoneDBQ.isLoading || rawContactsQ.isLoading;

  const managedGroups = useMemo(
    () => groups.filter((g) => managedGroupIds.includes(g.id)),
    [groups, managedGroupIds],
  );

  const groupNameById = useMemo(() => {
    const map = {};
    groups.forEach((g) => { map[g.id] = g.name; });
    return map;
  }, [groups]);

  const membersByGroup = useMemo(() => {
    const map = {};
    managedGroupIds.forEach((id) => { map[id] = []; });
    allAllowedUsers.forEach((u) => {
      const gid = u.data?.group_id || u.group_id;
      if (gid && managedGroupIds.includes(gid)) {
        map[gid].push({ email: u.data?.email || u.email, name: u.data?.name || u.name, role: u.data?.role || u.role });
      }
    });
    return map;
  }, [allAllowedUsers, managedGroupIds]);

  const emailToGroupId = useMemo(() => {
    const map = {};
    allAllowedUsers.forEach((u) => {
      const email = u.data?.email || u.email;
      const gid = u.data?.group_id || u.group_id;
      if (email && gid) map[email] = gid;
    });
    return map;
  }, [allAllowedUsers]);

  const assignmentByKey = useMemo(() => {
    const map = {};
    meetingAssignments.forEach((a) => { if (a.meeting_key) map[a.meeting_key] = a; });
    return map;
  }, [meetingAssignments]);

  // Nadchodzące spotkania podlegające pod strukturę dyrektora
  const meetings = useMemo(() => {
    if (!isDirector) return [];
    const res = [];
    allMeetings.forEach((m) => {
      const origKey = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
      if (hiddenMeetingKeys.has(origKey)) return;
      const assignment = assignmentByKey[origKey];
      const calendar = m.meeting_calendar;
      if (!calendar) return;
      const d = parseMeetingDate(calendar);
      if (!d || !isUpcoming(d)) return;

      const sheetGroupId = sheetGroupIdOf(sheetMappings, m.sheet);
      const inMyGroups =
        (sheetGroupId && managedGroupIds.includes(sheetGroupId)) ||
        (assignment && managedGroupIds.includes(assignment.assigned_group_id)) ||
        assignment?.assigned_user_email === currentUser?.email;
      if (!inMyGroups) return;

      const groupId = assignment?.assigned_group_id || sheetGroupId || null;
      res.push({
        ...m,
        meeting_key: origKey,
        meeting_date: format(startOfDay(d), "yyyy-MM-dd"),
        time: extractTime(calendar),
        groupId,
        assignedEmail: assignment?.assigned_user_email || "",
        assignedName: assignment?.assigned_user_name || "",
      });
    });
    res.sort((a, b) => (a.meeting_date < b.meeting_date ? -1 : a.meeting_date > b.meeting_date ? 1 : 0));
    return res;
  }, [allMeetings, assignmentByKey, sheetMappings, managedGroupIds, hiddenMeetingKeys, isDirector, currentUser?.email]);

  // Aktywne kontakty podlegające pod strukturę
  const contacts = useMemo(() => {
    if (!isDirector) return [];
    const dbByKey = {};
    phoneContactsFromDB.forEach((c) => { dbByKey[c.contact_key] = c; });

    const mergedRaw = rawContacts.map((c) => {
      const db = dbByKey[c.contact_key];
      return db ? { ...c, ...db, sheet: c.sheet } : c;
    });
    const manual = phoneContactsFromDB
      .filter((c) => c.contact_key?.startsWith("manual_") && !c.is_archived)
      .map((c) => ({
        ...c,
        phone: c.phone || c.client_phone || "",
        address: c.address || c.client_address || "",
      }));

    const all = [...mergedRaw, ...manual];
    const res = [];
    all.forEach((c) => {
      if (c.is_archived) return;
      const sheetGroupId = sheetGroupIdOf(sheetMappings, c.sheet);
      const inMyGroups =
        (sheetGroupId && managedGroupIds.includes(sheetGroupId)) ||
        (c.assigned_group_id && managedGroupIds.includes(c.assigned_group_id)) ||
        c.assigned_user_email === currentUser?.email;
      if (!inMyGroups) return;
      const groupId = c.assigned_group_id || sheetGroupId || null;
      res.push({
        ...c,
        groupId,
        assignedName: c.assigned_user_name || "",
        assignedEmail: c.assigned_user_email || "",
      });
    });
    return res;
  }, [rawContacts, phoneContactsFromDB, sheetMappings, managedGroupIds, isDirector, currentUser?.email]);

  // Raporty autorów z zarządzanych grup
  const reports = useMemo(() => {
    if (!isDirector) return [];
    const memberEmails = new Set();
    Object.values(membersByGroup).flat().forEach((m) => memberEmails.add(m.email));
    memberEmails.add(currentUser?.email);
    const all = [
      ...meetingReports.map((r) => ({ type: "meeting", author: r.author_email || r.created_by, client: r.client_name })),
      ...visitReports.map((r) => ({ type: "visit", author: r.author_email || r.created_by, client: r.client_name })),
    ];
    return all.filter((r) => r.author && memberEmails.has(r.author));
  }, [meetingReports, visitReports, membersByGroup, isDirector, currentUser?.email]);

  const statsPerGroup = useMemo(() => {
    return managedGroups.map((g) => {
      const members = membersByGroup[g.id] || [];
      const memberEmails = new Set(members.map((m) => m.email));
      const groupMeetings = meetings.filter((m) => m.groupId === g.id);
      const groupContacts = contacts.filter((c) => c.groupId === g.id);
      const groupReports = reports.filter((r) => emailToGroupId[r.author] === g.id || memberEmails.has(r.author));
      return {
        group: g,
        members: members.length,
        meetings: groupMeetings.length,
        meetingsAssigned: groupMeetings.filter((m) => m.assignedEmail).length,
        contacts: groupContacts.length,
        contactsAssigned: groupContacts.filter((c) => c.assignedEmail).length,
        reports: groupReports.length,
      };
    });
  }, [managedGroups, membersByGroup, meetings, contacts, reports, emailToGroupId]);

  const totals = useMemo(() => ({
    groups: managedGroups.length,
    members: Object.values(membersByGroup).flat().length,
    meetings: meetings.length,
    meetingsAssigned: meetings.filter((m) => m.assignedEmail).length,
    contacts: contacts.length,
    contactsAssigned: contacts.filter((c) => c.assignedEmail).length,
    reports: reports.length,
  }), [managedGroups, membersByGroup, meetings, contacts, reports]);

  return {
    managedGroups, groupNameById, membersByGroup,
    meetings, contacts, reports, statsPerGroup, totals, loading,
    cacheRefreshedAt: cacheQ.data?.last_refreshed,
  };
}