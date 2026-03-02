import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const spreadsheetId = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Pobierz metadane arkusza (wszystkie zakładki)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaRes.ok) {
      const err = await metaRes.text();
      return Response.json({ error: `Metadata error: ${err}` }, { status: 500 });
    }

    const meta = await metaRes.json();
    const sheets = meta.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      index: s.properties.index,
      rowCount: s.properties.gridProperties?.rowCount,
      colCount: s.properties.gridProperties?.columnCount
    }));

    // Pobierz pierwsze 3 wiersze z każdej zakładki (nagłówki + przykładowe dane)
    const previews = {};
    for (const sheet of sheets.slice(0, 20)) { // max 20 zakładek
      const range = `'${sheet.title}'!A1:Z3`;
      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (dataRes.ok) {
        const d = await dataRes.json();
        previews[sheet.title] = d.values || [];
      }
    }

    return Response.json({ sheets, previews });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});