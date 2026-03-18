import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const spreadsheetId = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const { sheetTitle } = await req.json().catch(() => ({}));
    const tab = sheetTitle || 'Świętokrzyskie';

    // Pobierz pierwsze 200 wierszy
    const range = `'${tab}'!A1:Z200`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return Response.json({ headers: [], rows: [] });

    const headers = rows[0];
    const intIdx = headers.findIndex(h => h.toLowerCase().includes('zainteresowany'));
    const commentIdx = headers.findIndex(h => h.toLowerCase().includes('komentarz dws') || (h.toLowerCase().includes('komentarz') && h.toLowerCase().includes('dws')));
    const calendarIdx = headers.findIndex(h => h.toLowerCase().includes('rozmowy') && h.toLowerCase().includes('dat'));

    // Pobierz wszystkie wiersze "Spotkanie" i pokaż wartości kluczowych kolumn
    const meetings = rows.slice(1)
      .filter(r => (r[intIdx] || '').toLowerCase().includes('spotkanie') && (r[1] || '').trim())
      .slice(0, 10)
      .map(r => ({
        name: r[1],
        zainteresowany: r[intIdx],
        komentarz_dws: r[commentIdx],
        kolumna_kalendarza: r[calendarIdx],
        komentarz_idx: commentIdx,
        calendar_idx: calendarIdx,
        col_before_comment: commentIdx > 0 ? r[commentIdx - 1] : null,
      }));

    return Response.json({ headers, intIdx, commentIdx, calendarIdx, meetings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});