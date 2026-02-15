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

    const reportResponse = await base44.entities.VisitReport.get(reportId);
    const report = reportResponse.data || reportResponse;
    
    console.log('Generating PDF for report:', report.client_name);

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

    const doc = new jsPDF();
    
    // CRITICAL: Set text color to black at the very start
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let y = 20;
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(c('RAPORT WIZYTY'), 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`4-ECO Green Energy | ${new Date().toLocaleDateString('pl-PL')}`, 105, y, { align: 'center' });
    y += 15;
    
    // Client section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(c('DANE KLIENTA'), 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (report.client_name) {
      doc.text(c('Klient:'), 20, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(c(report.client_name), 20, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    }
    
    if (report.client_address) {
      doc.text(c('Adres:'), 20, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(c(report.client_address), 20, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    }
    
    if (report.client_phone) {
      doc.text(c('Telefon:'), 20, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(c(report.client_phone), 20, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    }
    
    if (report.visit_date) {
      doc.text(c('Data wizyty:'), 20, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(new Date(report.visit_date).toLocaleDateString('pl-PL'), 20, y);
      doc.setFont('helvetica', 'normal');
      y += 12;
    }
    
    // Installation section
    if (report.installation_types?.length || report.contractor || report.launch_date) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c('INSTALACJA'), 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (report.installation_types?.length) {
        doc.text(c('Typ instalacji:'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(c(report.installation_types.join(', ')), 20, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      }
      
      if (report.contractor) {
        doc.text(c('Wykonawca:'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(c(report.contractor), 20, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      }
      
      if (report.launch_date) {
        doc.text(c('Data uruchomienia:'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(c(report.launch_date), 20, y);
        doc.setFont('helvetica', 'normal');
        y += 12;
      }
    }
    
    // Energy section
    if (report.annual_production_kwh || report.energy_imported_kwh || report.energy_exported_kwh) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c('DANE ENERGETYCZNE'), 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (report.annual_production_kwh) {
        doc.text(c('Roczna produkcja:'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`${report.annual_production_kwh} kWh`, 20, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      }
      
      if (report.energy_imported_kwh) {
        doc.text(c('Energia pobrana z sieci (1.8.0):'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`${report.energy_imported_kwh} kWh`, 20, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      }
      
      if (report.energy_exported_kwh) {
        doc.text(c('Energia oddana do sieci (2.8.0):'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`${report.energy_exported_kwh} kWh`, 20, y);
        doc.setFont('helvetica', 'normal');
        y += 12;
      }
    }
    
    // Autoconsumption
    if (report.autoconsumption_rating) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c('OCENA AUTOKONSUMPCJI'), 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(c(report.autoconsumption_rating), 170);
      doc.text(lines, 20, y);
      y += (lines.length * 6) + 12;
    }
    
    // Technical inspection
    const checks = [
      ['Wizualna kontrola paneli/modulow (pekniecia, zabrudzenia):', report.panels_condition],
      ['Kontrola mocowan i konstrukcji nosnej:', report.mounting_condition],
      ['Wizualne sprawdzenie przewodow DC/AC, polaczen MC4:', report.cables_condition],
      ['Wizualny stan zabezpieczen: SPD, RCD, wylaczniki:', report.protection_condition],
      ['Odczyt falownika: bledy, produkcja, komunikacja:', report.inverter_reading],
      ['Wizualna kontrola uziemienia i ciaglosci przewodow ochronnych:', report.grounding_condition],
      ['Ocena mozliwosci rozbudowy: miejsce, przylacze, ograniczenia:', report.expansion_possibilities]
    ].filter(([_, v]) => v);
    
    if (checks.length > 0) {
      if (y > 240) {
        doc.addPage();
        doc.setTextColor(0, 0, 0);
        y = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c('KONTROLA TECHNICZNA'), 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      checks.forEach(([question, answer]) => {
        if (y > 260) {
          doc.addPage();
          doc.setTextColor(0, 0, 0);
          y = 20;
        }
        
        const qLines = doc.splitTextToSize(c(question), 170);
        doc.text(qLines, 20, y);
        y += qLines.length * 6;
        
        doc.setFont('helvetica', 'bold');
        const aLines = doc.splitTextToSize(c(answer), 170);
        doc.text(aLines, 20, y);
        doc.setFont('helvetica', 'normal');
        y += aLines.length * 6 + 6;
      });
      y += 6;
    }
    
    // Recommendations
    if (report.recommendations) {
      if (y > 240) {
        doc.addPage();
        doc.setTextColor(0, 0, 0);
        y = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(c('Rekomendacje (serwis, czyszczenie, wymiana elementow):'), 20, y);
      y += 6;
      
      doc.setFont('helvetica', 'bold');
      const recLines = doc.splitTextToSize(c(report.recommendations), 170);
      doc.text(recLines, 20, y);
      doc.setFont('helvetica', 'normal');
      y += recLines.length * 6 + 6;
    }
    
    // Interview section
    const interviewQuestions = [
      ['Jaki jest roczny koszt za energie elektryczna?', report.interview_annual_cost],
      ['Ile osob zamieszkuje dom/mieszkanie?', report.interview_residents],
      ['O ktorej godzinie domownicy wychodza do pracy/szkoly?', report.interview_work_schedule],
      ['O ktorej godzinie zwykle wszyscy wracaja do domu?', report.interview_return_time],
      ['Czy ktos jest w domu w godzinach 10:00-15:00?', report.interview_home_during_day],
      ['O jakiej porze dnia zuzycie pradu jest najwieksze?', report.interview_peak_usage],
      ['Kiedy najczesciej wlaczacie pralke, zmywarke i inne urzadzenia?', report.interview_appliance_usage],
      ['Czym ogrzewana jest ciepla woda i kiedy z niej korzystacie?', report.interview_water_heating],
      ['Jaki sprzet elektryczny jest w domu?', report.interview_equipment],
      ['Jakie plany zakupowe dotyczace urzadzen energochlonnych?', report.interview_purchase_plans]
    ].filter(([_, v]) => v);
    
    if (interviewQuestions.length > 0) {
      doc.addPage();
      doc.setTextColor(0, 0, 0);
      y = 20;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c('WYWIAD Z KLIENTEM'), 20, y);
      y += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      interviewQuestions.forEach(([question, answer]) => {
        if (y > 260) {
          doc.addPage();
          doc.setTextColor(0, 0, 0);
          y = 20;
        }
        
        const qLines = doc.splitTextToSize(c(question), 170);
        doc.text(qLines, 20, y);
        y += qLines.length * 6;
        
        doc.setFont('helvetica', 'bold');
        const aLines = doc.splitTextToSize(c(answer), 170);
        doc.text(aLines, 20, y);
        doc.setFont('helvetica', 'normal');
        y += aLines.length * 6 + 6;
      });
      
      if (report.client_signature) {
        if (y > 260) {
          doc.addPage();
          doc.setTextColor(0, 0, 0);
          y = 20;
        }
        
        y += 6;
        doc.text(c('Podpis klienta:'), 20, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(c(report.client_signature), 20, y);
        doc.setFont('helvetica', 'normal');
      }
    }
    
    // Footer on first page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(c(`Doradca: ${user.full_name || user.email}`), 20, 285);
      doc.text(`Strona ${i} z ${pageCount}`, 190, 285, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');
    console.log('PDF generated successfully, size:', pdfBytes.byteLength);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="raport_${c(report.client_name)?.replace(/\s+/g, '_') || 'wizyta'}.pdf"`,
        'Content-Length': pdfBytes.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});