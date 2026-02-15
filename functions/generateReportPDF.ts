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
    
    const norm = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/ą/g, 'a').replace(/Ą/g, 'A')
        .replace(/ć/g, 'c').replace(/Ć/g, 'C')
        .replace(/ę/g, 'e').replace(/Ę/g, 'E')
        .replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/ń/g, 'n').replace(/Ń/g, 'N')
        .replace(/ó/g, 'o').replace(/Ó/g, 'O')
        .replace(/ś/g, 's').replace(/Ś/g, 'S')
        .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
        .replace(/ż/g, 'z').replace(/Ż/g, 'Z');
    };
    
    const doc = new jsPDF();
    let y = 20;
    const m = 15;
    const w = 180;

    const check = () => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    };

    const header = (txt) => {
      check();
      doc.setFillColor(34, 197, 94);
      doc.rect(m, y, w, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(norm(txt), m + 2, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    };

    const field = (label, value) => {
      if (!value) return;
      check();
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(norm(label), m, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(norm(String(value)), w - 50);
      doc.text(lines, m + 50, y);
      y += Math.max(6, lines.length * 5);
    };

    const highlight = (label, value) => {
      if (!value) return;
      check();
      doc.setFillColor(255, 252, 204);
      doc.rect(m - 2, y - 4, w + 4, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(norm(label), m, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text(norm(String(value)), m + 50, y);
      doc.setTextColor(0, 0, 0);
      y += 10;
    };

    // Naglowek
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPORT WIZYTY TECHNICZNEJ', m, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('4-ECO Green Energy', m, y);
    y += 5;
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, m, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Klient
    header('DANE KLIENTA');
    field('Klient:', report.client_name);
    field('Adres:', report.client_address);
    field('Telefon:', report.client_phone);
    field('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : '');
    field('Instalacja:', report.installation_types?.join(', '));
    y += 5;

    // Instalacja
    if (report.launch_date || report.contractor || report.annual_production_kwh) {
      header('DANE INSTALACJI');
      field('Uruchomienie:', report.launch_date);
      field('Wykonawca:', report.contractor);
      field('Produkcja roczna:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : '');
      field('Pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : '');
      field('Oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : '');
      y += 5;
    }

    // Autokonsumpcja - WYROZNIENIE
    if (report.annual_production_kwh && report.energy_exported_kwh) {
      const prod = parseFloat(report.annual_production_kwh) || 0;
      const exp = parseFloat(report.energy_exported_kwh) || 0;
      const cons = prod - exp;
      const rate = prod > 0 ? ((cons / prod) * 100).toFixed(1) : 0;
      const imp = parseFloat(report.energy_imported_kwh) || 0;
      const total = cons + imp;
      const self = total > 0 ? ((cons / total) * 100).toFixed(1) : 0;

      header('AUTOKONSUMPCJA');
      field('Wyprodukowano:', `${prod.toFixed(0)} kWh`);
      field('Oddano do sieci:', `${exp.toFixed(0)} kWh`);
      field('Zuzyte z PV:', `${cons.toFixed(0)} kWh`);
      
      highlight('Wspolczynnik autokonsumpcji:', `${rate}%`);
      
      if (imp > 0) {
        field('Pobrano z sieci:', `${imp.toFixed(0)} kWh`);
        field('Calkowite zuzycie:', `${total.toFixed(0)} kWh`);
        highlight('Samowystarczalnosc:', `${self}%`);
      }
      y += 5;
    }

    // Kontrola
    const checks = [
      { label: 'Ocena autokonsumpcji:', value: report.autoconsumption_rating },
      { label: 'Stan paneli:', value: report.panels_condition },
      { label: 'Mocowania:', value: report.mounting_condition },
      { label: 'Przewody DC/AC:', value: report.cables_condition },
      { label: 'Zabezpieczenia:', value: report.protection_condition },
      { label: 'Falownik:', value: report.inverter_reading },
      { label: 'Uziemienie:', value: report.grounding_condition },
      { label: 'Rozbudowa:', value: report.expansion_possibilities },
      { label: 'Modernizacja:', value: report.modernization_potential },
      { label: 'Rekomendacje:', value: report.recommendations },
      { label: 'Uwagi:', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      header('KONTROLA TECHNICZNA');
      checks.forEach(item => field(item.label, item.value));
      y += 5;
    }

    // Wywiad
    const interview = [
      { label: 'Koszt roczny:', value: report.interview_annual_cost },
      { label: 'Mieszkancy:', value: report.interview_residents },
      { label: 'Wyjscie:', value: report.interview_work_schedule },
      { label: 'Powrot:', value: report.interview_return_time },
      { label: 'W domu 10-15:', value: report.interview_home_during_day },
      { label: 'Szczyt zuzycia:', value: report.interview_peak_usage },
      { label: 'Urzadzenia:', value: report.interview_appliance_usage },
      { label: 'Woda:', value: report.interview_water_heating },
      { label: 'Sprzet:', value: report.interview_equipment },
      { label: 'Plany zakupowe:', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      header('WYWIAD ENERGETYCZNY');
      interview.forEach(item => field(item.label, item.value));
      y += 5;
    }

    // Podpis
    if (report.client_signature) {
      check();
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('PODPIS:', m, y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.text(norm(report.client_signature), m, y);
    }

    // Stopki
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(`Strona ${i}/${pages}`, 105, 287, { align: 'center' });
      doc.text('4-ECO Green Energy', 105, 292, { align: 'center' });
    }

    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const safeName = norm(report.client_name || 'wizyta').replace(/[^a-zA-Z0-9]/g, '_');

    return Response.json({ 
      pdf: pdfBase64, 
      filename: `raport_${safeName}.pdf` 
    });
  } catch (error) {
    console.error('PDF Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});