import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create' || !data) {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    // Get all admin users
    const adminUsers = await base44.asServiceRole.entities.AllowedUser.filter({ role: 'admin' });

    // Send notifications to all admins
    for (const admin of adminUsers) {
      // Check preferences
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ 
        user_email: admin.email 
      });
      const preferences = prefs[0];

      const shouldNotifyInApp = preferences?.new_report_in_app ?? true;
      const shouldNotifyEmail = preferences?.new_report_email ?? false;

      if (shouldNotifyInApp) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          type: 'new_report',
          title: 'Nowy raport utworzony',
          message: `Raport dla klienta ${data.client_name || 'Bez nazwy'} został dodany do systemu.`,
          link: `/VisitReports?id=${data.id}`,
          is_read: false,
        });
      }

      if (shouldNotifyEmail) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: '4-ECO: Nowy raport utworzony',
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">4-ECO Green Energy</h1>
              </div>
              <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #1f2937; margin-top: 0;">Nowy raport utworzony</h2>
                <p style="color: #4b5563; line-height: 1.6;">
                  Raport dla klienta <strong>${data.client_name || 'Bez nazwy'}</strong> został dodany do systemu.
                </p>
                <p style="color: #6b7280; font-size: 14px;">Data wizyty: ${data.visit_date || 'Nie podano'}</p>
              </div>
              <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                <p>To powiadomienie zostało wysłane z aplikacji 4-ECO</p>
              </div>
            </div>
          `,
        });
      }
    }

    return Response.json({ success: true, notified: adminUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});