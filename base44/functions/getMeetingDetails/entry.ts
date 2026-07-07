import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const meetingKey = String(payload.meeting_key || '').trim();
    if (!meetingKey) return Response.json({ error: 'meeting_key required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.MeetingsCache.filter({ cache_key: 'meetings_main' }, '-updated_date', 1);
    const meetings = rows[0]?.meetings_json?.meetings || [];
    const meeting = meetings.find((m) => `${m.sheet}__${m.client_name}__${m.meeting_calendar}` === meetingKey);

    if (!meeting) return Response.json({ meeting: null });

    return Response.json({
      meeting: {
        agent: meeting.agent || '',
        comments: meeting.comments || '',
        interview_data: meeting.interview_data || {},
        meeting_note: meeting.meeting_note || '',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});