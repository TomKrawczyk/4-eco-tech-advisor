import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.1';

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
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPORT WIZYTY TECHNICZNEJ', margin, y);
    y += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('4-ECO Green Energy', margin, y);
    y += 4;
    doc.text(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
    y += 10;
    doc.setTextColor(0, 0, 0);

    // Section: Client info
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DANE KLIENTA', margin + 2, y + 5.5);
    y += 12;
    doc.setTextColor(0, 0, 0);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (report.client_name) {
      doc.setFont('helvetica', 'bold');
      doc.text('Klient:', margin, y);
      doc.setFont('helvetica', 'normal');
      const nameLines = doc.splitTextToSize(report.client_name, contentWidth - 30);
      doc.text(nameLines, margin + 30, y);
      y += 6 * nameLines.length;
    }
    if (report.client_address) {
      doc.setFont('helvetica', 'bold');
      doc.text('Adres:', margin, y);
      doc.setFont('helvetica', 'normal');
      const addressLines = doc.splitTextToSize(report.client_address, contentWidth - 30);
      doc.text(addressLines, margin + 30, y);
      y += 6 * addressLines.length;
    }
    if (report.client_phone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Telefon:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(report.client_phone, margin + 30, y);
      y += 6;
    }
    if (report.visit_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Data wizyty:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(report.visit_date).toLocaleDateString('pl-PL'), margin + 30, y);
      y += 6;
    }
    if (report.installation_types?.length) {
      doc.setFont('helvetica', 'bold');
      doc.text('Rodzaj instalacji:', margin, y);
      doc.setFont('helvetica', 'normal');
      const typeLines = doc.splitTextToSize(report.installation_types.join(', '), contentWidth - 40);
      doc.text(typeLines, margin + 40, y);
      y += 6 * typeLines.length;
    }
    y += 6;

    // Section: Installation data
    if (report.launch_date || report.contractor || report.annual_production_kwh) {
      if (y > 240) {
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
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (report.launch_date) {
        doc.setFont('helvetica', 'bold');
        doc.text('Data uruchomienia:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(report.launch_date, margin + 45, y);
        y += 6;
      }
      if (report.contractor) {
        doc.setFont('helvetica', 'bold');
        doc.text('Wykonawca:', margin, y);
        doc.setFont('helvetica', 'normal');
        const contractorLines = doc.splitTextToSize(report.contractor, contentWidth - 45);
        doc.text(contractorLines, margin + 45, y);
        y += 6 * contractorLines.length;
      }
      if (report.annual_production_kwh) {
        doc.setFont('helvetica', 'bold');
        doc.text('Roczna produkcja:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${report.annual_production_kwh} kWh`, margin + 45, y);
        y += 6;
      }
      if (report.energy_imported_kwh) {
        doc.setFont('helvetica', 'bold');
        doc.text('Energia pobrana (1.8.0):', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${report.energy_imported_kwh} kWh`, margin + 60, y);
        y += 6;
      }
      if (report.energy_exported_kwh) {
        doc.setFont('helvetica', 'bold');
        doc.text('Energia oddana (2.8.0):', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${report.energy_exported_kwh} kWh`, margin + 60, y);
        y += 6;
      }
      y += 6;
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
      { label: 'Możliwości rozbudowy', value: report.expansion_possibilities },
      { label: 'Potencjał modernizacji', value: report.modernization_potential },
      { label: 'Rekomendacje', value: report.recommendations },
      { label: 'Dodatkowe uwagi', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      if (y > 240) {
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
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      checks.forEach(item => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.label}:`, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(item.value, contentWidth - 5);
        doc.text(splitText, margin + 5, y);
        y += (splitText.length * 5) + 3;
      });
      y += 6;
    }

    // Section: Interview
    const interview = [
      { label: 'Roczny koszt energii', value: report.interview_annual_cost },
      { label: 'Liczba mieszkańców', value: report.interview_residents },
      { label: 'Godziny wyjścia do pracy/szkoły', value: report.interview_work_schedule },
      { label: 'Godzina powrotu do domu', value: report.interview_return_time },
      { label: 'Obecność w domu 10:00-15:00', value: report.interview_home_during_day },
      { label: 'Pora największego zużycia energii', value: report.interview_peak_usage },
      { label: 'Czas używania urządzeń', value: report.interview_appliance_usage },
      { label: 'Ogrzewanie wody', value: report.interview_water_heating },
      { label: 'Sprzęt elektryczny w domu', value: report.interview_equipment },
      { label: 'Plany zakupowe', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      if (y > 240) {
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
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      interview.forEach(item => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.label}:`, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(item.value, contentWidth - 5);
        doc.text(splitText, margin + 5, y);
        y += (splitText.length * 5) + 3;
      });
      y += 6;
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