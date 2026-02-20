import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const emailTemplate = (title, sections, link) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">4-ECO Green Energy</h1>
  </div>
  <div style="padding: 32px 30px; background: #f9fafb;">
    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">${title}</h2>
    ${sections}
    ${link ? `<div style="margin-top: 24px;"><a href="${link}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Zobacz raport</a></div>` : ''}
  </div>
  <div style="padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
    To powiadomienie zostało wysłane z aplikacji 4-ECO Green Energy
  </div>
</div>
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create' || !data) {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const creatorEmail = data.created_by;
    const allUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const creator = allUsers.find(u => (u.data?.email || u.email) === creatorEmail);
    const creatorName = data.author_name || creator?.data?.name || creator?.name || creatorEmail || 'Nieznany';

    const adminUsers = await base44.asServiceRole.entities.AllowedUser.filter({ role: 'admin' });

    for (const admin of adminUsers) {
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: admin.email });
      const preferences = prefs[0];

      const shouldNotifyInApp = preferences?.new_report_in_app ?? true;
      const shouldNotifyEmail = preferences?.new_report_email ?? false;

      if (shouldNotifyInApp) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          type: 'new_report',
          title: 'Nowy raport utworzony',
          message: `Raport dla klienta ${data.client_name || 'Bez nazwy'} został dodany przez ${creatorName}.`,
          link: `/VisitReports?id=${data.id}`,
          is_read: false,
        });
      }

      if (shouldNotifyEmail) {
        const sections = `
          <p style="color: #4b5563; line-height: 1.7; margin: 0 0 10px 0;">
            Do systemu dodano nowy raport wizyty technicznej.
          </p>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; color: #1f2937;">
              <strong>Klient:</strong> ${data.client_name || 'Bez nazwy'}
            </p>
            <p style="margin: 0 0 8px 0; color: #1f2937;">
              <strong>Data wizyty:</strong> ${data.visit_date || 'Nie podano'}
            </p>
            ${data.installation_types?.length ? `<p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Rodzaj instalacji:</strong> ${data.installation_types.join(', ')}</p>` : ''}
          </div>
          <div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0 0 4px 0; color: #14532d; font-weight: bold;">Autor raportu</p>
            <p style="margin: 0 0 4px 0; color: #166534;">${creatorName}</p>
            <p style="margin: 0; color: #15803d; font-size: 13px;">${creatorEmail}</p>
          </div>
        `;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: '4-ECO: Nowy raport utworzony',
          body: emailTemplate('Nowy raport utworzony', sections, null),
        });
      }
    }

    return Response.json({ success: true, notified: adminUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});