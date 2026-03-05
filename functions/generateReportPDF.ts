import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
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
    let y = 20;
    
    // Color palette
    const greenPrimary = [34, 197, 94];
    const greenDark = [22, 163, 74];
    const grayLight = [243, 244, 246];
    const grayDark = [75, 85, 99];
    const black = [0, 0, 0];

    // Helper function for section headers
    const addSectionHeader = (title) => {
      if (y > 250) {
        doc.addPage();
        y = 15;
      }
      
      // Background box
      doc.setFillColor(...grayLight);
      doc.rect(15, y - 3, 180, 8, 'F');
      
      // Title
      doc.setTextColor(...greenPrimary);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(c(title), 17, y + 2);
      
      y += 12;
    };
    
    // Helper for field display
    const addField = (label, value) => {
      if (!value) return;
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayDark);
      doc.text(c(label), 20, y);
      y += 4;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(String(value)), 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 4;
    };
    
    // HEADER
    doc.setFillColor(...greenPrimary);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4-ECO Green Energy', 15, 18);
    doc.setFontSize(18);
    doc.text(c('RAPORT WIZYTY'), 190, 15, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(new Date().toLocaleDateString('pl-PL'), 190, 23, { align: 'right' });

    doc.setDrawColor(...grayLight);
    doc.setLineWidth(0.3);
    doc.line(15, 36, 195, 36);
    
    y = 48;
    doc.setTextColor(...black);
    
    // CLIENT SECTION
    addSectionHeader('CLIENT DATA');
    addField('Client', report.client_name);
    addField('Address', report.client_address);
    addField('Phone', report.client_phone);
    addField('Visit date', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : null);
    
    y += 3;
    
    // INSTALLATION SECTION
    if (report.installation_types?.length || report.contractor || report.launch_date) {
      addSectionHeader('INSTALLATION');
      addField('Installation type', report.installation_types?.join(', '));
      addField('Contractor', report.contractor);
      addField('Launch date', report.launch_date);
      y += 3;
    }
    
    // ENERGY SECTION
    if (report.annual_production_kwh || report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('ENERGY DATA');
      addField('Annual production', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : null);
      addField('Energy from grid (1.8.0)', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : null);
      addField('Energy to grid (2.8.0)', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : null);
      y += 3;
    }
    
    // AUTOCONSUMPTION
    if (report.autoconsumption_rating) {
      addSectionHeader('AUTOCONSUMPTION RATING');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(report.autoconsumption_rating), 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 8;
    }
    
    // TECHNICAL CHECKS
    const checks = [
      ['Visual inspection of panels/modules (cracks, dirt):', report.panels_condition],
      ['Inspection of mounts and support structure:', report.mounting_condition],
      ['Visual inspection of DC/AC wires, MC4 connections:', report.cables_condition],
      ['Visual state of protection: SPD, RCD, switches:', report.protection_condition],
      ['Inverter reading: errors, production, communication:', report.inverter_reading],
      ['Visual inspection of grounding and protective wires:', report.grounding_condition],
      ['Assessment of expansion possibilities: space, connection, limitations:', report.expansion_possibilities]
    ].filter(([_, v]) => v);
    
    if (checks.length > 0) {
      addSectionHeader('TECHNICAL INSPECTION');
      
      checks.forEach(([question, answer], idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // Dash instead of bullet
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayDark);
        const qLines = doc.splitTextToSize(c(question), 165);
        doc.text('-', 17, y);
        doc.text(qLines, 22, y);
        y += qLines.length * 4;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
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
        y = 15;
      }
      
      addSectionHeader('RECOMMENDATIONS');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const recLines = doc.splitTextToSize(c(report.recommendations), 170);
      doc.text(recLines, 20, y);
      y += recLines.length * 5 + 8;
    }
    
    // INTERVIEW SECTION
    const interviewQuestions = [
      ['What is the annual cost of electricity?', report.interview_annual_cost],
      ['How many people live in the house/flat?', report.interview_residents],
      ['What time do residents leave for work/school?', report.interview_work_schedule],
      ['What time do residents usually return home?', report.interview_return_time],
      ['Is anyone home between 10:00-15:00?', report.interview_home_during_day],
      ['When is electricity consumption highest?', report.interview_peak_usage],
      ['When do you use washer, dishwasher and other appliances?', report.interview_appliance_usage],
      ['How is hot water heated and when is it used?', report.interview_water_heating],
      ['What electrical equipment is in the house?', report.interview_equipment],
      ['What are your plans to purchase energy-consuming devices?', report.interview_purchase_plans]
    ].filter(([_, v]) => v);
    
    if (interviewQuestions.length > 0) {
      doc.addPage();
      y = 15;
      
      addSectionHeader('CLIENT INTERVIEW');
      
      interviewQuestions.forEach(([question, answer]) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        // Dash instead of bullet
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayDark);
        const qLines = doc.splitTextToSize(c(question), 165);
        doc.text('-', 17, y);
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
         y = 15;
        }

        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayDark);
        doc.text('Client signature:', 20, y);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...black);
        doc.text(c(report.client_signature), 20, y + 6);

        // Line under signature
        doc.setDrawColor(...grayLight);
        doc.setLineWidth(0.5);
        doc.line(20, y + 10, 100, y + 10);
        }
    }
    
    // FOOTER on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(...grayLight);
      doc.setLineWidth(0.5);
      doc.line(15, 277, 195, 277);
      
      doc.setFontSize(7);
      doc.setTextColor(...grayDark);
      doc.setFont('helvetica', 'normal');
      doc.text(`Advisor: ${user.full_name || user.email}`, 20, 283);
      doc.text(`Page ${i}`, 190, 283, { align: 'right' });
      doc.text('(c) 2026 4-ECO Green Energy', 105, 283, { align: 'center' });
    }

    const pdfBase64 = doc.output('datauristring');
    // datauristring = "data:application/pdf;filename=generated.pdf;base64,XXXXXX"
    // Extract only the raw base64 part after "base64,"
    const base64Data = pdfBase64.split('base64,')[1];
    const filename = `raport_${c(report.client_name)?.replace(/\s+/g, '_') || 'wizyta'}.pdf`;
    console.log('PDF generated successfully');

    return Response.json({ pdf_base64: base64Data, filename });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});