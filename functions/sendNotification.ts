import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const emailTemplate = (title, rows, link) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">4-ECO Green Energy</h1>
  </div>
  <div style="padding: 32px 30px; background: #f9fafb;">
    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">${title}</h2>
    ${rows.map(row => `<p style="color: #4b5563; line-height: 1.7; margin: 0 0 10px 0;">${row}</p>`).join('')}
    ${link ? `<div style="margin-top: 24px;"><a href="${link}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Zobacz szczegóły</a></div>` : ''}
  </div>
  <div style="padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
    To powiadomienie zostało wysłane z aplikacji 4-ECO Green Energy
  </div>
</div>
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email, type, title, message, link, send_email } = await req.json();

    const notification = await base44.asServiceRole.entities.Notification.create({
      user_email,
      type,
      title,
      message,
      link: link || null,
      is_read: false,
    });

    if (send_email) {
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email });
      const preferences = prefs[0];

      const emailFieldMap = {
        new_report: 'new_report_email',
        system_error: 'system_errors_email',
        user_activity: 'user_activity_email',
      };

      const shouldSendEmail = preferences?.[emailFieldMap[type]] ?? false;

      if (shouldSendEmail) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user_email,
          subject: `4-ECO: ${title}`,
          body: emailTemplate(title, [message], link),
        });
      }
    }

    return Response.json({ success: true, notification });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});