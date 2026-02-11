import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import PDFDocument from 'npm:pdfkit@0.15.0';

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
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    const pdfPromise = new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Helper functions
    const addSectionHeader = (title) => {
      if (doc.y > 700) doc.addPage();
      doc.rect(40, doc.y, 515, 25).fill('#22c55e');
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text(title, 45, doc.y - 18);
      doc.moveDown(0.5);
      doc.fillColor('#000000');
    };

    const addField = (label, value) => {
      if (!value) return;
      if (doc.y > 720) doc.addPage();
      
      doc.fontSize(10).font('Helvetica-Bold').text(label, 40, doc.y, { continued: true, width: 150 });
      doc.font('Helvetica').text(String(value), { width: 365 });
      doc.moveDown(0.3);
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('RAPORT WIZYTY TECHNICZNEJ', 40, 40);
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').fillColor('#666666').text('4-ECO Green Energy');
    doc.text(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`);
    doc.fillColor('#000000');
    doc.moveDown(1.5);

    // Client section
    addSectionHeader('DANE KLIENTA');
    addField('Klient:', report.client_name);
    addField('Adres:', report.client_address);
    addField('Telefon:', report.client_phone);
    addField('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : '');
    addField('Rodzaj instalacji:', report.installation_types?.join(', '));
    doc.moveDown(1);

    // Installation section
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE INSTALACJI');
      addField('Data uruchomienia:', report.launch_date);
      addField('Wykonawca:', report.contractor);
      addField('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : '');
      addField('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : '');
      addField('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : '');
      doc.moveDown(1);
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
      addSectionHeader('KONTROLA TECHNICZNA');
      checks.forEach(item => addField(item.label, item.value));
      doc.moveDown(1);
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
      addSectionHeader('WYWIAD ENERGETYCZNY');
      interview.forEach(item => addField(item.label, item.value));
      doc.moveDown(1);
    }

    // Signature
    if (report.client_signature) {
      if (doc.y > 700) doc.addPage();
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').text('PODPIS KLIENTA:');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Oblique').text(report.client_signature);
    }

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#999999');
      doc.text(`Strona ${i + 1} z ${pages.count}`, 40, 780, { align: 'center', width: 515 });
      doc.text('4-ECO Green Energy', 40, 790, { align: 'center', width: 515 });
    }

    doc.end();
    const pdfBuffer = await pdfPromise;

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