import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const records = await base44.asServiceRole.entities.MeetingsCache.filter({ cache_key: 'meetings_main' }, '-updated_date', 1);
    const cache = records[0] || null;
    return Response.json({
      success: true,
      status: cache?.status || 'idle',
      last_refreshed: cache?.last_refreshed || null,
      meetings_count: cache?.meetings_count || 0,
      message: 'Automatyczne odświeżanie spotkań obsługuje teraz funkcja refreshMeetingsCache uruchamiana z harmonogramu.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});