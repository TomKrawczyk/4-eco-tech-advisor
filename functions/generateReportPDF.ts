import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

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
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595, 842]); // A4
    const margin = 40;
    const pageWidth = 595;
    const pageHeight = 842;
    let y = pageHeight - margin;

    const checkNewPage = () => {
      if (y < 60) {
        page = pdfDoc.addPage([595, 842]);
        y = pageHeight - margin;
      }
    };

    const addText = (text, x, yPos, size, fontType, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x, y: yPos, size, font: fontType, color });
    };

    const addSectionHeader = (title) => {
      checkNewPage();
      page.drawRectangle({ x: margin, y: y - 20, width: pageWidth - 2 * margin, height: 20, color: rgb(0.133, 0.773, 0.369) });
      addText(title, margin + 5, y - 15, 12, fontBold, rgb(1, 1, 1));
      y -= 30;
    };

    const addField = (label, value) => {
      if (!value) return;
      checkNewPage();
      addText(label, margin, y, 10, fontBold);
      
      const valueStr = String(value);
      const maxWidth = 400;
      const words = valueStr.split(' ');
      let line = '';
      let lines = [];
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const width = font.widthOfTextAtSize(testLine, 10);
        if (width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);
      
      lines.forEach((l, i) => {
        addText(l, margin + 150, y - (i * 15), 10, font);
      });
      
      y -= Math.max(15, lines.length * 15);
    };

    // Header
    addText('RAPORT WIZYTY TECHNICZNEJ', margin, y, 20, fontBold);
    y -= 25;
    addText('4-ECO Green Energy', margin, y, 11, font, rgb(0.4, 0.4, 0.4));
    y -= 15;
    addText(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, margin, y, 10, font, rgb(0.4, 0.4, 0.4));
    y -= 30;

    // Client section
    addSectionHeader('DANE KLIENTA');
    addField('Klient:', report.client_name);
    addField('Adres:', report.client_address);
    addField('Telefon:', report.client_phone);
    addField('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : '');
    addField('Rodzaj instalacji:', report.installation_types?.join(', '));
    y -= 20;

    // Installation section
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE INSTALACJI');
      addField('Data uruchomienia:', report.launch_date);
      addField('Wykonawca:', report.contractor);
      addField('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : '');
      addField('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : '');
      addField('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : '');
      y -= 20;
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
      y -= 20;
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
      y -= 20;
    }

    // Signature
    if (report.client_signature) {
      checkNewPage();
      y -= 10;
      addText('PODPIS KLIENTA:', margin, y, 10, fontBold);
      y -= 15;
      addText(report.client_signature, margin, y, 11, font);
    }

    // Add page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Strona ${i + 1} z ${pages.length}`, {
        x: pageWidth / 2 - 40,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      p.drawText('4-ECO Green Energy', {
        x: pageWidth / 2 - 50,
        y: 20,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
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