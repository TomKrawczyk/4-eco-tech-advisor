import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

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

    // Pobierz tylko wiersz 1 (nagłówki) z każdej zakładki – batch request
    const ranges = sheets.map(s => `'${s.title}'!A1:Z1`);
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let headers = {};
    if (batchRes.ok) {
      const batchData = await batchRes.json();
      (batchData.valueRanges || []).forEach(vr => {
        const sheetTitle = vr.range?.split('!')[0]?.replace(/'/g, '');
        headers[sheetTitle] = (vr.values?.[0] || []);
      });
    }

    // Połącz wyniki
    const result = sheets.map(s => ({
      ...s,
      headers: headers[s.title] || []
    }));

    return Response.json({ sheets: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});