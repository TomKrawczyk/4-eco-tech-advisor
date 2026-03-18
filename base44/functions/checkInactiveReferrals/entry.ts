import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user (required for admin functions)
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Fetch all referrals
    const referrals = await base44.asServiceRole.entities.Referral.list();
    
    const inactiveReferrals = referrals.filter(ref => {
      // Only check 'new' and 'contacted' statuses
      if (!['new', 'contacted'].includes(ref.status)) return false;
      
      // Check last action date or created date
      const lastDate = ref.last_action_date ? new Date(ref.last_action_date) : new Date(ref.created_date);
      
      // If older than 3 days, it's inactive
      return lastDate < threeDaysAgo;
    });

    console.log(`Found ${inactiveReferrals.length} inactive referrals`);

    const notifications = [];
    
    for (const referral of inactiveReferrals) {
      const assignedTo = referral.assigned_to || referral.created_by;
      
      if (!assignedTo) continue;

      // Create notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: assignedTo,
          type: 'user_activity',
          title: 'Brak reakcji na polecenie',
          message: `Polecenie od ${referral.client_name} (${referral.client_phone}) oczekuje na działanie od ponad 3 dni. Status: ${referral.status}`,
          link: `/Referrals`,
          metadata: {
            referral_id: referral.id,
            days_inactive: Math.floor((now - new Date(referral.last_action_date || referral.created_date)) / (1000 * 60 * 60 * 24))
          }
        });
        
        notifications.push({ referral_id: referral.id, user: assignedTo });

        // Check user notification preferences
        const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: assignedTo });
        const userPref = prefs[0];
        
        // Send email if enabled
        if (userPref?.user_activity_email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: '4-ECO System',
            to: assignedTo,
            subject: `⏰ Przypomnienie: Polecenie wymaga reakcji`,
            body: `
Witaj,

Polecenie wymaga Twojej uwagi:

📋 Klient: ${referral.client_name}
📞 Telefon: ${referral.client_phone}
📍 Status: ${referral.status}
⏱️ Oczekuje od: ${Math.floor((now - new Date(referral.last_action_date || referral.created_date)) / (1000 * 60 * 60 * 24))} dni

${referral.source_client ? `Polecił: ${referral.source_client}` : ''}
${referral.notes ? `Notatki: ${referral.notes}` : ''}

Zaloguj się do systemu, aby podjąć działanie.

---
4-ECO Green Energy
            `.trim()
          });
        }
      } catch (error) {
        console.error(`Error creating notification for referral ${referral.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      checked: referrals.length,
      inactive: inactiveReferrals.length,
      notifications_sent: notifications.length,
      notifications
    });

  } catch (error) {
    console.error('Check inactive referrals error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});