import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const spreadsheetId = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const { sheetTitle } = await req.json().catch(() => ({}));

    if (sheetTitle) {
      // Pobierz dane z konkretnej zakładki (pierwsze 10 wierszy)
      const range = `'${sheetTitle}'!A1:Z10`;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      return Response.json({ values: data.values || [] });
    }

    // Pobierz listę zakładek
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const sheets = meta.sheets.map(s => s.properties.title);
    return Response.json({ sheets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});