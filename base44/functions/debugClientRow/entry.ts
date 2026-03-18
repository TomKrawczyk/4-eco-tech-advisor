import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SPREADSHEET_ID = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  await base44.auth.me();

  const body = await req.json().catch(() => ({}));
  const sheetTitle = body.sheetTitle || 'Pomorskie - 2';
  const clientName = body.clientName || 'MARCIN GŁODOWSKI';

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

  const range = `'${sheetTitle}'!A1:Z3000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return Response.json({ error: 'No data' });

  const headers = rows[0];
  const nameIdx = headers.findIndex(h => h.includes('Imię i nazwisko'));

  // Znajdź wiersz klienta
  const clientRow = rows.slice(1).find(r => (r[nameIdx] || '').trim() === clientName.trim());

  return Response.json({
    headers,
    clientRow: clientRow || null,
    rowWithHeaders: clientRow ? headers.map((h, i) => ({ col: i, header: h, value: clientRow[i] || '' })) : null,
    addressIdxExact: headers.findIndex(h => h === 'Adres'),
    addressIdxTrim: headers.findIndex(h => h.trim() === 'Adres'),
    headerChars: headers.slice(0, 6).map(h => ({ header: h, chars: [...h].map(c => c.charCodeAt(0)) })),
  });
});