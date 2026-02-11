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
      return Response.json({ error: 'reportId is required' }, { status: 400 });
    }

    const report = await base44.entities.VisitReport.get(reportId);
    
    // Funkcja normalizująca polskie znaki
    const normalize = (text) => {
      if (!text) return text;
      const map = {
        'ą': 'a', 'Ą': 'A',
        'ć': 'c', 'Ć': 'C',
        'ę': 'e', 'Ę': 'E',
        'ł': 'l', 'Ł': 'L',
        'ń': 'n', 'Ń': 'N',
        'ó': 'o', 'Ó': 'O',
        'ś': 's', 'Ś': 'S',
        'ź': 'z', 'Ź': 'Z',
        'ż': 'z', 'Ż': 'Z'
      };
      return String(text).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => map[char] || char);
    };
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 20;
    const margin = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - (2 * margin);

    const checkNewPage = () => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    };

    const addSectionHeader = (title) => {
      checkNewPage();
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(normalize(title), margin + 2, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    };

    const addField = (label, value) => {
      if (!value) return;
      checkNewPage();
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(normalize(label), margin, y);
      
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(normalize(String(value)), contentWidth - 50);
      doc.text(lines, margin + 50, y);
      
      y += Math.max(6, lines.length * 5);
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(normalize('RAPORT WIZYTY TECHNICZNEJ'), margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('4-ECO Green Energy', margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.text(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Client section
    addSectionHeader('DANE KLIENTA');
    addField('Klient:', report.client_name);
    addField('Adres:', report.client_address);
    addField('Telefon:', report.client_phone);
    addField('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : '');
    addField('Rodzaj instalacji:', report.installation_types?.join(', '));
    y += 5;

    // Installation section
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE INSTALACJI');
      addField('Data uruchomienia:', report.launch_date);
      addField('Wykonawca:', report.contractor);
      addField('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : '');
      addField('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : '');
      addField('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : '');
      y += 5;
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
      { label: 'Mozliwosci rozbudowy:', value: report.expansion_possibilities },
      { label: 'Potencjal modernizacji:', value: report.modernization_potential },
      { label: 'Rekomendacje:', value: report.recommendations },
      { label: 'Dodatkowe uwagi:', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      addSectionHeader('KONTROLA TECHNICZNA');
      checks.forEach(item => addField(item.label, item.value));
      y += 5;
    }

    // Interview
    const interview = [
      { label: 'Roczny koszt energii:', value: report.interview_annual_cost },
      { label: 'Liczba mieszkancow:', value: report.interview_residents },
      { label: 'Wyjscie do pracy/szkoly:', value: report.interview_work_schedule },
      { label: 'Powrot do domu:', value: report.interview_return_time },
      { label: 'Obecnosc w domu (10-15):', value: report.interview_home_during_day },
      { label: 'Szczyt zuzycia:', value: report.interview_peak_usage },
      { label: 'Uzywanie urzadzen:', value: report.interview_appliance_usage },
      { label: 'Ogrzewanie wody:', value: report.interview_water_heating },
      { label: 'Sprzet:', value: report.interview_equipment },
      { label: 'Plany zakupowe:', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      addSectionHeader('WYWIAD ENERGETYCZNY');
      interview.forEach(item => addField(item.label, item.value));
      y += 5;
    }

    // Signature
    if (report.client_signature) {
      checkNewPage();
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(normalize('PODPIS KLIENTA:'), margin, y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.text(normalize(report.client_signature), margin, y);
    }

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(`Strona ${i} z ${pageCount}`, pageWidth / 2, 287, { align: 'center' });
      doc.text('4-ECO Green Energy', pageWidth / 2, 292, { align: 'center' });
    }

    const pdfBuffer = doc.output('arraybuffer');

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