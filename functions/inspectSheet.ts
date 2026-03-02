import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const spreadsheetId = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const { sheetTitle } = await req.json().catch(() => ({}));
    const tab = sheetTitle || 'Świętokrzyskie';

    // Pobierz pierwsze 50 wierszy
    const range = `'${tab}'!A1:Z50`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return Response.json({ headers: [], rows: [] });

    const headers = rows[0];
    // Znajdź index kolumny "zainteresowany"
    const intIdx = headers.findIndex(h => h.toLowerCase().includes('zainteresowany'));

    // Zwróć unikalne wartości tej kolumny
    const uniqueValues = [...new Set(rows.slice(1).map(r => r[intIdx] || '').filter(Boolean))];

    return Response.json({ headers, intIdx, uniqueValues, sampleRows: rows.slice(1, 6) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});