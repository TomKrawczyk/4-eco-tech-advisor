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

    // Fetch logo
    let logoData = null;
    try {
      const logoResponse = await fetch('https://4-eco.pl/wp-content/uploads/2020/09/Zrzut-ekranu-2020-11-11-o-10.05.01.png');
      const logoBlob = await logoResponse.arrayBuffer();
      const base64Logo = btoa(String.fromCharCode(...new Uint8Array(logoBlob)));
      logoData = `data:image/png;base64,${base64Logo}`;
    } catch (error) {
      console.error('Failed to load logo:', error);
    }

    const doc = new jsPDF();
    let y = 20;
    
    // Color palette
    const greenPrimary = [149, 193, 31]; // #95C11F - brand color from website
    const greenLight = [220, 252, 231];
    const gray = [100, 100, 100];
    const black = [0, 0, 0];
    
    // Helper function for section headers
    const addSectionHeader = (title) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Background bar
      doc.setFillColor(...greenPrimary);
      doc.rect(15, y - 5, 180, 10, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(c(title), 20, y + 1);
      
      doc.setTextColor(...black);
      y += 12;
    };
    
    // Helper for field display
    const addField = (label, value) => {
      if (!value) return;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(c(label), 20, y);
      y += 5;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(String(value)), 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 3;
    };
    
    // HEADER - Logo area with brand color
    doc.setFillColor(...greenPrimary);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Add logo if loaded
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 15, 8, 40, 24);
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
        // Fallback to text
        doc.setFillColor(255, 255, 255);
        doc.rect(15, 10, 15, 15, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...greenPrimary);
        doc.text('4E', 22.5, 20, { align: 'center' });
      }
    } else {
      // Fallback
      doc.setFillColor(255, 255, 255);
      doc.rect(15, 10, 15, 15, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenPrimary);
      doc.text('4E', 22.5, 20, { align: 'center' });
    }
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(c('RAPORT WIZYTY'), 60, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy', 60, 28);
    
    // Date in corner
    doc.setFontSize(8);
    doc.text(new Date().toLocaleDateString('pl-PL'), 180, 22, { align: 'right' });
    
    y = 50;
    doc.setTextColor(...black);
    
    // CLIENT SECTION
    addSectionHeader('DANE KLIENTA');
    addField('Klient', report.client_name);
    addField('Adres', report.client_address);
    addField('Telefon', report.client_phone);
    addField('Data wizyty', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : null);
    
    y += 5;
    
    // INSTALLATION SECTION
    if (report.installation_types?.length || report.contractor || report.launch_date) {
      addSectionHeader('INSTALACJA');
      addField('Typ instalacji', report.installation_types?.join(', '));
      addField('Wykonawca', report.contractor);
      addField('Data uruchomienia', report.launch_date);
      y += 5;
    }
    
    // ENERGY SECTION
    if (report.annual_production_kwh || report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE ENERGETYCZNE');
      addField('Roczna produkcja', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : null);
      addField('Energia pobrana z sieci (1.8.0)', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : null);
      addField('Energia oddana do sieci (2.8.0)', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : null);
      y += 5;
    }
    
    // AUTOCONSUMPTION
    if (report.autoconsumption_rating) {
      addSectionHeader('OCENA AUTOKONSUMPCJI');
      doc.setFillColor(...greenLight);
      doc.rect(15, y, 180, 2, 'F');
      y += 5;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(report.autoconsumption_rating), 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 8;
    }
    
    // TECHNICAL CHECKS
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
      addSectionHeader('KONTROLA TECHNICZNA');
      
      checks.forEach(([question, answer], idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // Bullet point
        doc.setFillColor(...greenPrimary);
        doc.circle(17, y - 1, 1.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        const qLines = doc.splitTextToSize(c(question), 165);
        doc.text(qLines, 22, y);
        y += qLines.length * 4;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        const aLines = doc.splitTextToSize(c(answer), 165);
        doc.text(aLines, 22, y);
        y += aLines.length * 5 + 4;
      });
      y += 5;
    }
    
    // RECOMMENDATIONS
    if (report.recommendations) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      addSectionHeader('REKOMENDACJE');
      
      doc.setFillColor(...greenLight);
      doc.roundedRect(15, y, 180, 4, 2, 2, 'F');
      y += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const recLines = doc.splitTextToSize(c(report.recommendations), 170);
      doc.text(recLines, 20, y);
      y += recLines.length * 5 + 5;
    }
    
    // INTERVIEW SECTION
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
      y = 20;
      
      addSectionHeader('WYWIAD Z KLIENTEM');
      
      interviewQuestions.forEach(([question, answer]) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // Bullet point
        doc.setFillColor(...greenPrimary);
        doc.circle(17, y - 1, 1.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        const qLines = doc.splitTextToSize(c(question), 165);
        doc.text(qLines, 22, y);
        y += qLines.length * 4;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        const aLines = doc.splitTextToSize(c(answer), 165);
        doc.text(aLines, 22, y);
        y += aLines.length * 5 + 4;
      });
      
      if (report.client_signature) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        y += 10;
        doc.setFillColor(...greenLight);
        doc.rect(15, y - 3, 180, 15, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text(c('Podpis klienta:'), 20, y + 2);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...black);
        doc.text(c(report.client_signature), 20, y + 8);
      }
    }
    
    // FOOTER on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(...greenPrimary);
      doc.setLineWidth(0.5);
      doc.line(15, 280, 195, 280);
      
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
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