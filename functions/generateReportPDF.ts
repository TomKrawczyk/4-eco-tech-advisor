import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

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
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('Raport wizyty technicznej', 20, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('4-ECO Green Energy', 20, y);
    y += 10;

    // Client info
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Dane klienta', 20, y);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (report.client_name) {
      doc.text(`Klient: ${report.client_name}`, 20, y);
      y += 5;
    }
    if (report.client_address) {
      doc.text(`Adres: ${report.client_address}`, 20, y);
      y += 5;
    }
    if (report.client_phone) {
      doc.text(`Telefon: ${report.client_phone}`, 20, y);
      y += 5;
    }
    if (report.visit_date) {
      doc.text(`Data wizyty: ${new Date(report.visit_date).toLocaleDateString('pl-PL')}`, 20, y);
      y += 5;
    }
    if (report.installation_types?.length) {
      doc.text(`Rodzaj instalacji: ${report.installation_types.join(', ')}`, 20, y);
      y += 5;
    }
    y += 5;

    // Installation data
    if (report.launch_date || report.contractor || report.annual_production_kwh) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Dane instalacji', 20, y);
      y += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (report.launch_date) {
        doc.text(`Data uruchomienia: ${report.launch_date}`, 20, y);
        y += 5;
      }
      if (report.contractor) {
        doc.text(`Wykonawca: ${report.contractor}`, 20, y);
        y += 5;
      }
      if (report.annual_production_kwh) {
        doc.text(`Roczna produkcja: ${report.annual_production_kwh} kWh`, 20, y);
        y += 5;
      }
      if (report.energy_imported_kwh) {
        doc.text(`Energia pobrana (1.8.0): ${report.energy_imported_kwh} kWh`, 20, y);
        y += 5;
      }
      if (report.energy_exported_kwh) {
        doc.text(`Energia oddana (2.8.0): ${report.energy_exported_kwh} kWh`, 20, y);
        y += 5;
      }
      y += 5;
    }

    // Technical check
    const checks = [
      { label: 'Autokonsumpcja', value: report.autoconsumption_rating },
      { label: 'Stan paneli', value: report.panels_condition },
      { label: 'Mocowania', value: report.mounting_condition },
      { label: 'Przewody', value: report.cables_condition },
      { label: 'Zabezpieczenia', value: report.protection_condition },
      { label: 'Falownik', value: report.inverter_reading },
      { label: 'Uziemienie', value: report.grounding_condition },
      { label: 'Rozbudowa', value: report.expansion_possibilities },
      { label: 'Modernizacja', value: report.modernization_potential },
      { label: 'Rekomendacje', value: report.recommendations },
      { label: 'Uwagi', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Kontrola techniczna', 20, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      checks.forEach(item => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${item.label}:`, 20, y);
        const splitText = doc.splitTextToSize(item.value, 170);
        doc.text(splitText, 25, y + 4);
        y += 4 + (splitText.length * 4);
      });
      y += 5;
    }

    // Interview
    const interview = [
      { label: 'Roczny koszt', value: report.interview_annual_cost },
      { label: 'Mieszkańcy', value: report.interview_residents },
      { label: 'Wyjście do pracy/szkoły', value: report.interview_work_schedule },
      { label: 'Powrót do domu', value: report.interview_return_time },
      { label: 'Obecność w domu (10-15)', value: report.interview_home_during_day },
      { label: 'Szczyt zużycia', value: report.interview_peak_usage },
      { label: 'Używanie urządzeń', value: report.interview_appliance_usage },
      { label: 'Ogrzewanie wody', value: report.interview_water_heating },
      { label: 'Sprzęt', value: report.interview_equipment },
      { label: 'Plany', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Wywiad z klientem', 20, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      interview.forEach(item => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${item.label}:`, 20, y);
        const splitText = doc.splitTextToSize(item.value, 170);
        doc.text(splitText, 25, y + 4);
        y += 4 + (splitText.length * 4);
      });
    }

    // Signature
    if (report.client_signature) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      y += 10;
      doc.setFontSize(10);
      doc.text('Podpis klienta:', 20, y);
      y += 5;
      doc.setFont(undefined, 'italic');
      doc.text(report.client_signature, 20, y);
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