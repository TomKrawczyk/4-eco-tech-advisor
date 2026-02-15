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

    const clean = (text) => {
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

    const doc = new jsPDF({ compress: true });
    
    // Page 1
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('RAPORT WIZYTY', 20, 20);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text('4-ECO Green Energy', 20, 28);
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 20, 33);
    
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('KLIENT', 20, 45);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Klient: ${clean(report.client_name) || '-'}`, 20, 52);
    if (report.client_address) doc.text(`Adres: ${clean(report.client_address)}`, 20, 58);
    if (report.client_phone) doc.text(`Telefon: ${clean(report.client_phone)}`, 20, 64);
    if (report.visit_date) doc.text(`Data wizyty: ${new Date(report.visit_date).toLocaleDateString('pl-PL')}`, 20, 70);
    
    let y = 82;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('INSTALACJA', 20, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (report.installation_types?.length) {
      doc.text(`Typ: ${clean(report.installation_types.join(', '))}`, 20, y);
      y += 6;
    }
    if (report.contractor) {
      doc.text(`Wykonawca: ${clean(report.contractor)}`, 20, y);
      y += 6;
    }
    if (report.launch_date) {
      doc.text(`Uruchomienie: ${clean(report.launch_date)}`, 20, y);
      y += 6;
    }
    
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('DANE ENERGETYCZNE', 20, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (report.annual_production_kwh) {
      doc.text(`Produkcja: ${report.annual_production_kwh} kWh`, 20, y);
      y += 6;
    }
    if (report.energy_imported_kwh) {
      doc.text(`Pobrana (1.8.0): ${report.energy_imported_kwh} kWh`, 20, y);
      y += 6;
    }
    if (report.energy_exported_kwh) {
      doc.text(`Oddana (2.8.0): ${report.energy_exported_kwh} kWh`, 20, y);
      y += 6;
    }
    
    if (report.autoconsumption_rating) {
      y += 3;
      doc.setFont(undefined, 'bold');
      doc.text('AUTOKONSUMPCJA:', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(clean(report.autoconsumption_rating).substring(0, 80), 20, y);
      y += 6;
    }
    
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('KONTROLA TECHNICZNA', 20, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (report.panels_condition) {
      doc.text(`Panele: ${clean(report.panels_condition)}`, 20, y);
      y += 6;
    }
    if (report.mounting_condition) {
      doc.text(`Mocowania: ${clean(report.mounting_condition)}`, 20, y);
      y += 6;
    }
    if (report.cables_condition) {
      doc.text(`Przewody: ${clean(report.cables_condition)}`, 20, y);
      y += 6;
    }
    if (report.protection_condition) {
      doc.text(`Zabezpieczenia: ${clean(report.protection_condition)}`, 20, y);
      y += 6;
    }
    if (report.inverter_reading) {
      doc.text(`Falownik: ${clean(report.inverter_reading)}`, 20, y);
      y += 6;
    }
    if (report.grounding_condition) {
      doc.text(`Uziemienie: ${clean(report.grounding_condition)}`, 20, y);
      y += 6;
    }
    
    if (report.expansion_possibilities) {
      y += 3;
      doc.setFont(undefined, 'bold');
      doc.text('Rozbudowa:', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(clean(report.expansion_possibilities).substring(0, 80), 20, y);
      y += 6;
    }
    
    if (report.recommendations) {
      y += 3;
      doc.setFont(undefined, 'bold');
      doc.text('Rekomendacje:', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(clean(report.recommendations).substring(0, 100), 20, y);
    }
    
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Doradca: ${clean(user.full_name || user.email)}`, 20, 285);
    doc.text('Strona 1', 180, 285);
    
    // Page 2 - Interview if exists
    if (report.interview_residents || report.interview_annual_cost) {
      doc.addPage();
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('WYWIAD ENERGETYCZNY', 20, 20);
      
      let y2 = 28;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      
      if (report.interview_annual_cost) {
        doc.text(`Roczny koszt: ${clean(report.interview_annual_cost)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_residents) {
        doc.text(`Liczba osob: ${clean(report.interview_residents)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_work_schedule) {
        doc.text(`Wyjscie do pracy: ${clean(report.interview_work_schedule)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_return_time) {
        doc.text(`Powrot: ${clean(report.interview_return_time)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_home_during_day) {
        doc.text(`W domu (10-15): ${clean(report.interview_home_during_day)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_peak_usage) {
        doc.text(`Szczyt zuzycia: ${clean(report.interview_peak_usage)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_appliance_usage) {
        doc.text(`Urzadzenia: ${clean(report.interview_appliance_usage)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_water_heating) {
        doc.text(`Ogrzewanie wody: ${clean(report.interview_water_heating)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_equipment) {
        doc.text(`Sprzet: ${clean(report.interview_equipment).substring(0, 80)}`, 20, y2);
        y2 += 6;
      }
      if (report.interview_purchase_plans) {
        doc.text(`Plany: ${clean(report.interview_purchase_plans).substring(0, 80)}`, 20, y2);
        y2 += 6;
      }
      
      if (report.client_signature) {
        y2 += 10;
        doc.setFont(undefined, 'bold');
        doc.text('PODPIS:', 20, y2);
        y2 += 6;
        doc.setFont(undefined, 'normal');
        doc.text(clean(report.client_signature), 20, y2);
      }
      
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('Strona 2', 180, 285);
    }

    const pdfBytes = doc.output('arraybuffer');
    const filename = `raport_${clean(report.client_name)?.replace(/\s+/g, '_') || 'wizyta'}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('PDF error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});