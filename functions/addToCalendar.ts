import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId, reminderMinutes = 60 } = await req.json();
    
    // Get report
    const report = await base44.asServiceRole.entities.VisitReport.get(reportId);
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get Google Calendar access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Create event
    const eventData = {
      summary: `Wizyta: ${report.client_name || 'Klient'}`,
      description: [
        `Klient: ${report.client_name}`,
        report.client_address ? `Adres: ${report.client_address}` : '',
        report.client_phone ? `Telefon: ${report.client_phone}` : '',
        report.installation_types?.length ? `Instalacje: ${report.installation_types.join(', ')}` : '',
        report.recommendations ? `\nRekomendacje: ${report.recommendations}` : ''
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: new Date(`${report.visit_date}T09:00:00`).toISOString(),
        timeZone: 'Europe/Warsaw'
      },
      end: {
        dateTime: new Date(`${report.visit_date}T10:00:00`).toISOString(),
        timeZone: 'Europe/Warsaw'
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: reminderMinutes },
          { method: 'email', minutes: 24 * 60 }
        ]
      }
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to create event', details: error }, { status: response.status });
    }

    const event = await response.json();

    return Response.json({
      success: true,
      eventId: event.id,
      eventLink: event.htmlLink
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});