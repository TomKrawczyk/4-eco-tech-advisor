import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
    const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");

    const referrals = await base44.asServiceRole.entities.Referral.list('-created_date');
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();

    const rows = [
      ['Data utworzenia', 'Utworzył', 'Klient', 'Telefon', 'Adres', 'Źródło', 'Status', 'Uwagi']
    ];

    for (const ref of referrals) {
      const creator = allowedUsers.find(u => (u.data?.email || u.email) === ref.created_by);
      const creatorName = creator?.data?.name || creator?.name || ref.created_by;

      rows.push([
        new Date(ref.created_date).toLocaleDateString('pl-PL'),
        creatorName,
        ref.client_name || '',
        ref.client_phone || '',
        ref.client_address || '',
        ref.source_client || '',
        ref.status || '',
        ref.notes || ''
      ]);
    }

    const sheetName = `Polecenia ${new Date().toLocaleDateString('pl-PL')}`;

    const addSheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              }
            }
          }]
        })
      }
    );

    if (!addSheetResponse.ok) {
      throw new Error('Błąd tworzenia arkusza');
    }

    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows
        })
      }
    );

    if (!updateResponse.ok) {
      throw new Error('Błąd zapisu danych');
    }

    return Response.json({ 
      success: true, 
      message: `Wyeksportowano ${referrals.length} poleceń do arkusza "${sheetName}"` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});