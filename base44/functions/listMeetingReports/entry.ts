import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  resolveAccessContext,
  listAll,
  denyAndLog,
} from '../../shared/accessControl.ts';

Deno.serve(async (req) => {
  try {
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const base44 = createClientFromRequest(req);
    const ctx = await resolveAccessContext(base44);

    if (!ctx.authenticated) {
      return denyAndLog(base44, 'no_session');
    }
    if (!ctx.allowed) {
      // Nie ma wpisu w AllowedUser — brak dostępu do danych klientów
      return Response.json({ reports: [] });
    }

    // Admin widzi wszystko
    if (ctx.isAdmin) {
      const reports = await listAll(base44.asServiceRole.entities.MeetingReport);
      if (payload.count_only) {
        return Response.json({ total: reports.length, role: ctx.role });
      }
      return Response.json({ reports, total: reports.length, role: ctx.role });
    }

    // Pozostałe role: tylko rekordy widocznych emaili (hierarchia)
    const [byAuthor, byCreator] = await Promise.all([
      base44.asServiceRole.entities.MeetingReport.filter(
        { author_email: { $in: ctx.visibleEmails } }, '-created_date', 1000,
      ),
      base44.asServiceRole.entities.MeetingReport.filter(
        { created_by: { $in: ctx.visibleEmails } }, '-created_date', 1000,
      ),
    ]);
    const seen = new Set();
    const visibleReports = [...byAuthor, ...byCreator].filter((report) => {
      if (seen.has(report.id)) return false;
      seen.add(report.id);
      return true;
    });

    if (payload.count_only) {
      return Response.json({ total: visibleReports.length, role: ctx.role });
    }

    console.log(
      `listMeetingReports OK: ${ctx.email} (${ctx.role}) -> ${visibleReports.length} reports`,
    );
    return Response.json({ reports: visibleReports, total: visibleReports.length, role: ctx.role });
  } catch (error) {
    console.error('listMeetingReports FAILED:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});