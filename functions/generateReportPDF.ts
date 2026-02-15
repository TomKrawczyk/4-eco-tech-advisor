import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Missing reportId' }, { status: 400 });
    }

    const report = await base44.entities.VisitReport.get(reportId);

    const doc = new jsPDF();
    let yPos = 40;

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('RAPORT WIZYTY TECHNICZNEJ', 42, yPos);
    yPos += 15;

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('4-ECO Green Energy', 42, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 42, yPos);
    yPos += 20;

    // Sekcja: Dane klienta
    doc.setFillColor(34, 197, 94);
    doc.rect(42, yPos, 510, 23, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255);
    doc.text('DANE KLIENTA', 48, yPos + 15);
    yPos += 30;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Klient:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.client_name || 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Adres:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.client_address || 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Telefon:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.client_phone || 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Data wizyty:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'Brak danych', 184, yPos);
    yPos += 20;

    // Sekcja: Instalacja
    doc.setFillColor(34, 197, 94);
    doc.rect(42, yPos, 510, 23, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255);
    doc.text('DANE INSTALACJI', 48, yPos + 15);
    yPos += 30;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Typy instalacji:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.installation_types?.join(', ') || 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Data uruchomienia:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.launch_date || 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Wykonawca:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.contractor || 'Brak danych', 184, yPos);
    yPos += 20;

    // Dane energetyczne
    doc.setFillColor(34, 197, 94);
    doc.rect(42, yPos, 510, 23, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255);
    doc.text('DANE ENERGETYCZNE', 48, yPos + 15);
    yPos += 30;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Roczna produkcja:', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Energia pobrana (1.8.0):', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : 'Brak danych', 184, yPos);
    yPos += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Energia oddana (2.8.0):', 42, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : 'Brak danych', 184, yPos);
    yPos += 12;

    if (report.autoconsumption_rating) {
      doc.setFillColor(255, 255, 153);
      doc.rect(42, yPos - 2, 510, 14, 'F');
      doc.setFont(undefined, 'bold');
      doc.text('Autokonsumpcja:', 42, yPos + 8);
      doc.setFont(undefined, 'normal');
      doc.text(report.autoconsumption_rating, 184, yPos + 8);
      yPos += 24;
    } else {
      yPos += 12;
    }

    // Nowa strona dla inspekcji
    doc.addPage();
    yPos = 40;

    doc.setFillColor(34, 197, 94);
    doc.rect(42, yPos, 510, 23, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255);
    doc.text('INSPEKCJA TECHNICZNA', 48, yPos + 15);
    yPos += 30;

    const technicalChecks = [
      { label: 'Stan paneli', value: report.panels_condition },
      { label: 'Stan mocowań', value: report.mounting_condition },
      { label: 'Przewody DC/AC', value: report.cables_condition },
      { label: 'Zabezpieczenia', value: report.protection_condition },
      { label: 'Odczyt falownika', value: report.inverter_reading },
      { label: 'Uziemienie', value: report.grounding_condition }
    ];

    doc.setFontSize(10);
    doc.setTextColor(0);

    technicalChecks.forEach(check => {
      doc.setFont(undefined, 'bold');
      doc.text(`${check.label}:`, 42, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(check.value || 'Brak danych', 184, yPos);
      yPos += 12;
    });

    yPos += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Możliwości rozbudowy:', 42, yPos);
    yPos += 12;
    doc.setFont(undefined, 'normal');
    const expansion = doc.splitTextToSize(report.expansion_possibilities || 'Brak danych', 450);
    doc.text(expansion, 42, yPos);
    yPos += expansion.length * 6 + 10;

    doc.setFont(undefined, 'bold');
    doc.text('Potencjał modernizacji:', 42, yPos);
    yPos += 12;
    doc.setFont(undefined, 'normal');
    doc.text(report.modernization_potential || 'Brak danych', 42, yPos);
    yPos += 15;

    doc.setFont(undefined, 'bold');
    doc.text('Rekomendacje:', 42, yPos);
    yPos += 12;
    doc.setFont(undefined, 'normal');
    const recommendations = doc.splitTextToSize(report.recommendations || 'Brak danych', 450);
    doc.text(recommendations, 42, yPos);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Doradca: ${user.full_name || user.email}`, 42, 820);
    doc.text(`Strona 1/2`, 520, 820);

    const pdfOutput = doc.output('datauristring');
    const base64String = pdfOutput.split(',')[1];

    const filename = `raport_${report.client_name?.replace(/\s+/g, '_') || 'wizyta'}_${new Date().toISOString().split('T')[0]}.pdf`;

    return Response.json({ 
      pdf: base64String,
      filename: filename
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});