import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pdfMake from 'npm:pdfmake@0.2.10';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'reportId is required' }, { status: 400 });
    }

    const report = await base44.entities.VisitReport.get(reportId);
    
    // Define fonts
    const fonts = {
      Roboto: {
        normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
        bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
        italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf',
        bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf'
      }
    };

    const addField = (label, value) => {
      if (!value) return null;
      return {
        columns: [
          { width: 150, text: label, bold: true, fontSize: 10 },
          { width: '*', text: String(value), fontSize: 10 }
        ],
        margin: [0, 2, 0, 2]
      };
    };

    const content = [
      { text: 'RAPORT WIZYTY TECHNICZNEJ', fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
      { text: '4-ECO Green Energy', fontSize: 11, color: '#666666', margin: [0, 0, 0, 5] },
      { text: `Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, fontSize: 10, color: '#666666', margin: [0, 0, 0, 20] },
      
      // Client section
      { text: 'DANE KLIENTA', fontSize: 12, bold: true, fillColor: '#22c55e', color: 'white', margin: [0, 0, 0, 10], padding: 5 },
      addField('Klient:', report.client_name),
      addField('Adres:', report.client_address),
      addField('Telefon:', report.client_phone),
      addField('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : ''),
      addField('Rodzaj instalacji:', report.installation_types?.join(', ')),
      { text: '', margin: [0, 10] }
    ].filter(Boolean);

    // Installation section
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      content.push(
        { text: 'DANE INSTALACJI', fontSize: 12, bold: true, fillColor: '#22c55e', color: 'white', margin: [0, 0, 0, 10], padding: 5 },
        addField('Data uruchomienia:', report.launch_date),
        addField('Wykonawca:', report.contractor),
        addField('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : ''),
        addField('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : ''),
        addField('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : ''),
        { text: '', margin: [0, 10] }
      );
    }

    // Technical checks
    const checks = [
      { label: 'Autokonsumpcja:', value: report.autoconsumption_rating },
      { label: 'Stan paneli:', value: report.panels_condition },
      { label: 'Mocowania:', value: report.mounting_condition },
      { label: 'Przewody DC/AC:', value: report.cables_condition },
      { label: 'Zabezpieczenia SPD, RCD:', value: report.protection_condition },
      { label: 'Odczyt falownika:', value: report.inverter_reading },
      { label: 'Uziemienie:', value: report.grounding_condition },
      { label: 'Możliwości rozbudowy:', value: report.expansion_possibilities },
      { label: 'Potencjał modernizacji:', value: report.modernization_potential },
      { label: 'Rekomendacje:', value: report.recommendations },
      { label: 'Dodatkowe uwagi:', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      content.push(
        { text: 'KONTROLA TECHNICZNA', fontSize: 12, bold: true, fillColor: '#22c55e', color: 'white', margin: [0, 0, 0, 10], padding: 5 },
        ...checks.map(item => addField(item.label, item.value)).filter(Boolean),
        { text: '', margin: [0, 10] }
      );
    }

    // Interview
    const interview = [
      { label: 'Roczny koszt energii:', value: report.interview_annual_cost },
      { label: 'Liczba mieszkańców:', value: report.interview_residents },
      { label: 'Wyjście do pracy/szkoły:', value: report.interview_work_schedule },
      { label: 'Powrót do domu:', value: report.interview_return_time },
      { label: 'Obecność w domu (10-15):', value: report.interview_home_during_day },
      { label: 'Szczyt zużycia:', value: report.interview_peak_usage },
      { label: 'Używanie urządzeń:', value: report.interview_appliance_usage },
      { label: 'Ogrzewanie wody:', value: report.interview_water_heating },
      { label: 'Sprzęt:', value: report.interview_equipment },
      { label: 'Plany zakupowe:', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      content.push(
        { text: 'WYWIAD ENERGETYCZNY', fontSize: 12, bold: true, fillColor: '#22c55e', color: 'white', margin: [0, 0, 0, 10], padding: 5 },
        ...interview.map(item => addField(item.label, item.value)).filter(Boolean),
        { text: '', margin: [0, 10] }
      );
    }

    // Signature
    if (report.client_signature) {
      content.push(
        { text: '', margin: [0, 10] },
        { text: 'PODPIS KLIENTA:', fontSize: 10, bold: true, margin: [0, 5] },
        { text: report.client_signature, fontSize: 11, italics: true }
      );
    }

    const docDefinition = {
      content,
      defaultStyle: {
        font: 'Roboto'
      },
      pageMargins: [40, 40, 40, 60],
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Strona ${currentPage} z ${pageCount}`, alignment: 'center', fontSize: 8, color: '#999999' },
        ],
        margin: [40, 10]
      })
    };

    const printer = new pdfMake(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve) => {
      pdfDoc.on('end', resolve);
      pdfDoc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=raport_${report.client_name?.replace(/\s/g, '_') || 'wizyta'}.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});