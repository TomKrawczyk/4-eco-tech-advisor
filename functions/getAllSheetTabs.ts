import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function extractSpreadsheetId(val) {
  if (!val) return '';
  // Extract ID from URL if full URL is provided
  const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return val;
}

const SPREADSHEET_ID = extractSpreadsheetId(Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const ua = allowedUsers.find(a => (a.email || a.data?.email) === user.email);
    const role = ua?.role || ua?.data?.role;

    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    const meta = await res.json();
    const tabs = meta.sheets.map(s => s.properties.title);

    return Response.json({ tabs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});