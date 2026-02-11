import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';

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
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    const labelWidth = 60;
    let y = 20;

    // Helper function to add text with proper wrapping
    const addField = (label, value, currentY) => {
      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, margin, currentY);
      
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || ''), contentWidth - labelWidth);
      doc.text(lines, margin + labelWidth, currentY);
      
      return currentY + (lines.length * 6);
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPORT WIZYTY TECHNICZNEJ', margin, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('4-ECO Green Energy', margin, y);
    y += 5;
    doc.text(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);

    // Section: Client info
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DANE KLIENTA', margin + 2, y + 5.5);
    y += 12;
    doc.setTextColor(0, 0, 0);
    
    if (report.client_name) y = addField('Klient:', report.client_name, y);
    if (report.client_address) y = addField('Adres:', report.client_address, y);
    if (report.client_phone) y = addField('Telefon:', report.client_phone, y);
    if (report.visit_date) y = addField('Data wizyty:', new Date(report.visit_date).toLocaleDateString('pl-PL'), y);
    if (report.installation_types?.length) y = addField('Rodzaj instalacji:', report.installation_types.join(', '), y);
    y += 8;

    // Section: Installation data
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DANE INSTALACJI', margin + 2, y + 5.5);
      y += 12;
      doc.setTextColor(0, 0, 0);
      
      if (report.launch_date) y = addField('Data uruchomienia:', report.launch_date, y);
      if (report.contractor) y = addField('Wykonawca:', report.contractor, y);
      if (report.annual_production_kwh) y = addField('Roczna produkcja:', `${report.annual_production_kwh} kWh`, y);
      if (report.energy_imported_kwh) y = addField('Energia pobrana (1.8.0):', `${report.energy_imported_kwh} kWh`, y);
      if (report.energy_exported_kwh) y = addField('Energia oddana (2.8.0):', `${report.energy_exported_kwh} kWh`, y);
      y += 8;
    }

    // Section: Technical check
    const checks = [
      { label: 'Autokonsumpcja', value: report.autoconsumption_rating },
      { label: 'Stan paneli', value: report.panels_condition },
      { label: 'Mocowania', value: report.mounting_condition },
      { label: 'Przewody DC/AC', value: report.cables_condition },
      { label: 'Zabezpieczenia SPD, RCD', value: report.protection_condition },
      { label: 'Odczyt falownika', value: report.inverter_reading },
      { label: 'Uziemienie', value: report.grounding_condition },
      { label: 'Mozliwosci rozbudowy', value: report.expansion_possibilities },
      { label: 'Potencjal modernizacji', value: report.modernization_potential },
      { label: 'Rekomendacje', value: report.recommendations },
      { label: 'Dodatkowe uwagi', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('KONTROLA TECHNICZNA', margin + 2, y + 5.5);
      y += 12;
      doc.setTextColor(0, 0, 0);
      
      checks.forEach(item => {
        y = addField(item.label + ':', item.value, y);
      });
      y += 8;
    }

    // Section: Interview
    const interview = [
      { label: 'Roczny koszt energii', value: report.interview_annual_cost },
      { label: 'Liczba mieszkancow', value: report.interview_residents },
      { label: 'Godziny wyjscia do pracy/szkoly', value: report.interview_work_schedule },
      { label: 'Godzina powrotu do domu', value: report.interview_return_time },
      { label: 'Obecnosc w domu 10:00-15:00', value: report.interview_home_during_day },
      { label: 'Pora najwiekszego zuzycia energii', value: report.interview_peak_usage },
      { label: 'Czas uzywania urzadzen', value: report.interview_appliance_usage },
      { label: 'Ogrzewanie wody', value: report.interview_water_heating },
      { label: 'Sprzet elektryczny w domu', value: report.interview_equipment },
      { label: 'Plany zakupowe', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('WYWIAD ENERGETYCZNY', margin + 2, y + 5.5);
      y += 12;
      doc.setTextColor(0, 0, 0);
      
      interview.forEach(item => {
        y = addField(item.label + ':', item.value, y);
      });
      y += 8;
    }

    // Section: Signature
    if (report.client_signature) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PODPIS KLIENTA:', margin, y);
      y += 8;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(12);
      const signatureLines = doc.splitTextToSize(report.client_signature, contentWidth);
      doc.text(signatureLines, margin, y);
    }
    
    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`Strona ${i} z ${pageCount}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('4-ECO Green Energy | Raport wygenerowany automatycznie', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');

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