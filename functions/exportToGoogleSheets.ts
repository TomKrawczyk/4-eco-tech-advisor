import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await req.json();

    if (!reportId) {
      return Response.json({ error: 'Brak ID raportu' }, { status: 400 });
    }

    // Pobierz raport
    const report = await base44.entities.VisitReport.get(reportId);

    if (!report) {
      return Response.json({ error: 'Raport nie znaleziony' }, { status: 404 });
    }

    // Pobierz token dostępu do Google Sheets
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // ID arkusza głównego (możesz go zmienić lub pobrać z zmiennej środowiskowej)
    let SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');

    if (!SPREADSHEET_ID) {
      return Response.json({ 
        error: 'Brak ID arkusza Google Sheets. Ustaw GOOGLE_SHEETS_SPREADSHEET_ID w ustawieniach.' 
      }, { status: 500 });
    }

    // Wyekstrahuj ID z pełnego URL jeśli użytkownik podał URL
    const match = SPREADSHEET_ID.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      SPREADSHEET_ID = match[1];
    }

    // Przygotuj dane do eksportu
    const rowData = [
      report.visit_date || '',
      report.client_name || '',
      report.client_address || '',
      report.client_phone || '',
      report.installation_types?.join(', ') || '',
      report.launch_date || '',
      report.contractor || '',
      report.annual_production_kwh || '',
      report.energy_imported_kwh || '',
      report.energy_exported_kwh || '',
      report.autoconsumption_rating || '',
      report.panels_condition || '',
      report.mounting_condition || '',
      report.cables_condition || '',
      report.protection_condition || '',
      report.inverter_reading || '',
      report.grounding_condition || '',
      report.expansion_possibilities || '',
      report.modernization_potential || '',
      report.recommendations || '',
      report.interview_annual_cost || '',
      report.interview_residents || '',
      report.interview_work_schedule || '',
      report.interview_return_time || '',
      report.interview_home_during_day || '',
      report.interview_peak_usage || '',
      report.interview_appliance_usage || '',
      report.interview_water_heating || '',
      report.interview_equipment || '',
      report.interview_purchase_plans || '',
      report.status || '',
      new Date().toISOString()
    ];

    // Sprawdź czy arkusz "Raporty" istnieje, jeśli nie - utwórz
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      return Response.json({ 
        error: 'Błąd dostępu do Google Sheets', 
        details: errorText,
        spreadsheetId: SPREADSHEET_ID
      }, { status: 500 });
    }
    
    const spreadsheetData = await sheetsResponse.json();
    const sheetExists = spreadsheetData.sheets?.some(s => s.properties.title === 'Raporty');

    if (!sheetExists) {
      // Utwórz nowy arkusz "Raporty"
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
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
                  title: 'Raporty'
                }
              }
            }]
          })
        }
      );

      // Dodaj nagłówki
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Raporty!A1:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[
              'Data wizyty', 'Klient', 'Adres', 'Telefon', 'Typ instalacji',
              'Data uruchomienia', 'Wykonawca', 'Produkcja roczna (kWh)',
              'Energia pobrana (kWh)', 'Energia oddana (kWh)', 'Ocena autokonsumpcji',
              'Stan paneli', 'Stan mocowań', 'Stan przewodów', 'Stan zabezpieczeń',
              'Odczyt falownika', 'Stan uziemienia', 'Możliwości rozbudowy',
              'Potencjał modernizacji', 'Rekomendacje',
              'Roczny koszt energii', 'Liczba mieszkańców', 'Wyjście do pracy',
              'Powrót do domu', 'Obecność w domu (10-15)', 'Szczyt zużycia',
              'Używanie urządzeń', 'Ogrzewanie wody', 'Sprzęt elektryczny',
              'Plany zakupowe', 'Status', 'Data eksportu'
            ]]
          })
        }
      );
    }

    // Dodaj dane raportu
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Raporty!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!appendResponse.ok) {
      const error = await appendResponse.json();
      return Response.json({ error: 'Błąd eksportu do Google Sheets', details: error }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Raport wyeksportowany do Google Sheets',
      spreadsheetId: SPREADSHEET_ID
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});