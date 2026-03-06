import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const spreadsheetId = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
    const { getConnection } = await base44.asServiceRole.connectors;
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const body = await req.json().catch(() => ({}));
    const tab = body.sheetName || 'Małopolskie';

    const range = `'${tab}'!A1:Z3000`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return Response.json({ error: 'no data' });

    const headers = rows[0];
    const intIdx = headers.findIndex(h => h.toLowerCase().includes('zainteresowany'));

    // Zbierz wszystkie unikalne wartości w kolumnie "Zainteresowany"
    const uniqueValues = {};
    for (const row of rows.slice(1)) {
      const name = (row[1] || '').trim();
      if (!name) continue;
      const val = (row[intIdx] || '').trim();
      uniqueValues[val] = (uniqueValues[val] || 0) + 1;
    }

    return Response.json({
      sheetName: tab,
      intIdx,
      intHeader: headers[intIdx],
      uniqueValues,
      totalRows: rows.length - 1,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});