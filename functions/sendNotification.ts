import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email, type, title, message, link, send_email } = await req.json();

    // Create in-app notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_email,
      type,
      title,
      message,
      link: link || null,
      is_read: false,
    });

    // Check user preferences and send email if needed
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
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">4-ECO Green Energy</h1>
              </div>
              <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
                <p style="color: #4b5563; line-height: 1.6;">${message}</p>
                ${link ? `<a href="${link}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">Zobacz szczegóły</a>` : ''}
              </div>
              <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                <p>To powiadomienie zostało wysłane z aplikacji 4-ECO</p>
              </div>
            </div>
          `,
        });
      }
    }

    return Response.json({ success: true, notification });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});