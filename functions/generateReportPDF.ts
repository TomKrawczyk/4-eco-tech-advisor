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

    const c = (t) => {
      if (!t) return '';
      return String(t)
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
    let y = 20;
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('RAPORT WIZYTY', 20, y);
    y += 10;
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`4-ECO | ${new Date().toLocaleDateString('pl-PL')}`, 20, y);
    y += 15;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('KLIENT', 20, y);
    y += 6;
    
    doc.setFont(undefined, 'normal');
    doc.text(c(report.client_name) || '-', 20, y);
    y += 5;
    if (report.client_address) {
      doc.text(c(report.client_address), 20, y);
      y += 5;
    }
    if (report.client_phone) {
      doc.text(c(report.client_phone), 20, y);
      y += 5;
    }
    if (report.visit_date) {
      doc.text(`Data: ${new Date(report.visit_date).toLocaleDateString('pl-PL')}`, 20, y);
      y += 10;
    }
    
    if (report.installation_types?.length || report.contractor || report.launch_date) {
      doc.setFont(undefined, 'bold');
      doc.text('INSTALACJA', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      
      if (report.installation_types?.length) {
        doc.text(`Typ: ${c(report.installation_types.join(', '))}`, 20, y);
        y += 5;
      }
      if (report.contractor) {
        doc.text(`Wykonawca: ${c(report.contractor)}`, 20, y);
        y += 5;
      }
      if (report.launch_date) {
        doc.text(`Start: ${c(report.launch_date)}`, 20, y);
        y += 10;
      }
    }
    
    if (report.annual_production_kwh || report.energy_imported_kwh || report.energy_exported_kwh) {
      doc.setFont(undefined, 'bold');
      doc.text('ENERGIA', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      
      if (report.annual_production_kwh) {
        doc.text(`Produkcja: ${report.annual_production_kwh} kWh`, 20, y);
        y += 5;
      }
      if (report.energy_imported_kwh) {
        doc.text(`Pobrana: ${report.energy_imported_kwh} kWh`, 20, y);
        y += 5;
      }
      if (report.energy_exported_kwh) {
        doc.text(`Oddana: ${report.energy_exported_kwh} kWh`, 20, y);
        y += 10;
      }
    }
    
    if (report.autoconsumption_rating) {
      doc.setFont(undefined, 'bold');
      doc.text('AUTOKONSUMPCJA', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(c(report.autoconsumption_rating), 170);
      doc.text(lines, 20, y);
      y += (lines.length * 5) + 10;
    }
    
    const checks = [
      ['Panele', report.panels_condition],
      ['Mocowania', report.mounting_condition],
      ['Przewody', report.cables_condition],
      ['Zabezpieczenia', report.protection_condition],
      ['Falownik', report.inverter_reading],
      ['Uziemienie', report.grounding_condition]
    ].filter(([_, v]) => v);
    
    if (checks.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('KONTROLA', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      
      checks.forEach(([label, value]) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${label}: ${c(value)}`, 20, y);
        y += 5;
      });
      y += 5;
    }
    
    if (report.recommendations) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont(undefined, 'bold');
      doc.text('REKOMENDACJE', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(c(report.recommendations), 170);
      doc.text(lines, 20, y);
    }
    
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Doradca: ${c(user.full_name || user.email)}`, 20, 285);
    
    if (report.interview_residents || report.interview_annual_cost) {
      doc.addPage();
      y = 20;
      doc.setTextColor(0);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('WYWIAD', 20, y);
      y += 8;
      
      const questions = [
        ['Jaki jest roczny koszt za energie elektryczna?', report.interview_annual_cost],
        ['Ile osob zamieszkuje dom/mieszkanie?', report.interview_residents],
        ['O ktorej godzinie domownicy wychodza do pracy/szkoly?', report.interview_work_schedule],
        ['O ktorej godzinie zwykle wszyscy wracaja do domu?', report.interview_return_time],
        ['Czy ktos jest w domu w godzinach 10:00-15:00?', report.interview_home_during_day],
        ['O jakiej porze dnia zuzycie pradu jest najwieksze?', report.interview_peak_usage],
        ['Kiedy najczesciej wlaczacie pralke, zmywarke i inne urzadzenia?', report.interview_appliance_usage],
        ['Czym ogrzewana jest ciepla woda i kiedy najczesciej z niej korzystacie?', report.interview_water_heating],
        ['Jaki sprzet elektryczny jest w domu?', report.interview_equipment],
        ['Jakie plany zakupowe dotyczace urzadzen energochlonnych?', report.interview_purchase_plans]
      ];
      
      questions.forEach(([question, answer]) => {
        if (answer) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFont(undefined, 'normal');
          doc.text(c(question), 20, y);
          y += 5;
          doc.setFont(undefined, 'bold');
          doc.text(c(answer), 20, y);
          y += 8;
        }
      });
      
      if (report.client_signature) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'normal');
        doc.text('PODPIS KLIENTA:', 20, y);
        y += 5;
        doc.setFont(undefined, 'bold');
        doc.text(c(report.client_signature), 20, y);
      }
    }

    const pdfBytes = doc.output('arraybuffer');
    const filename = `raport_${c(report.client_name)?.replace(/\s+/g, '_') || 'wizyta'}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});