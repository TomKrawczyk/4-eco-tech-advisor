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

    // Helper to clean and truncate text
    const cleanText = (text, maxLength = 100) => {
      if (!text) return '';
      const cleaned = String(text)
        .replace(/ą/g, 'a').replace(/Ą/g, 'A')
        .replace(/ć/g, 'c').replace(/Ć/g, 'C')
        .replace(/ę/g, 'e').replace(/Ę/g, 'E')
        .replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/ń/g, 'n').replace(/Ń/g, 'N')
        .replace(/ó/g, 'o').replace(/Ó/g, 'O')
        .replace(/ś/g, 's').replace(/Ś/g, 'S')
        .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
        .replace(/ż/g, 'z').replace(/Ż/g, 'Z');
      return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
    };

    const doc = new jsPDF({ compress: true });
    let y = 30;
    
    // Header - simplified
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('RAPORT WIZYTY', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont(undefined, 'normal');
    doc.text('4-ECO Green Energy', 20, y);
    y += 15;

    // Client data
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('KLIENT', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Klient: ${cleanText(report.client_name, 50)}`, 20, y);
    y += 6;
    if (report.client_address) {
      doc.text(`Adres: ${cleanText(report.client_address, 50)}`, 20, y);
      y += 6;
    }
    if (report.client_phone) {
      doc.text(`Telefon: ${cleanText(report.client_phone, 30)}`, 20, y);
      y += 6;
    }
    if (report.visit_date) {
      doc.text(`Data: ${new Date(report.visit_date).toLocaleDateString('pl-PL')}`, 20, y);
      y += 10;
    } else {
      y += 10;
    }

    // Installation
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('INSTALACJA', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (report.installation_types?.length) {
      doc.text(`Typ: ${cleanText(report.installation_types.join(', '), 50)}`, 20, y);
      y += 6;
    }
    if (report.contractor) {
      doc.text(`Wykonawca: ${cleanText(report.contractor, 40)}`, 20, y);
      y += 6;
    }
    if (report.launch_date) {
      doc.text(`Uruchomienie: ${cleanText(report.launch_date, 30)}`, 20, y);
      y += 10;
    } else {
      y += 10;
    }

    // Energy data
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('DANE ENERGETYCZNE', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (report.annual_production_kwh) {
      doc.text(`Produkcja roczna: ${report.annual_production_kwh} kWh`, 20, y);
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
      doc.setFont(undefined, 'bold');
      doc.text(`Autokonsumpcja: ${cleanText(report.autoconsumption_rating, 50)}`, 20, y);
      doc.setFont(undefined, 'normal');
      y += 10;
    } else {
      y += 10;
    }

    // Technical inspection - simplified
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('INSPEKCJA', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    
    const checks = [
      ['Panele', report.panels_condition],
      ['Mocowania', report.mounting_condition],
      ['Przewody', report.cables_condition],
      ['Zabezpieczenia', report.protection_condition],
      ['Falownik', report.inverter_reading],
      ['Uziemienie', report.grounding_condition]
    ];
    
    checks.forEach(([label, value]) => {
      if (value) {
        doc.text(`${label}: ${cleanText(value, 40)}`, 20, y);
        y += 6;
      }
    });
    
    y += 5;
    
    // Recommendations - truncated
    if (report.recommendations) {
      doc.setFont(undefined, 'bold');
      doc.text('Rekomendacje:', 20, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(cleanText(report.recommendations, 200), 20, y, { maxWidth: 170 });
    }

    // Footer
    y = 280;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Doradca: ${cleanText(user.full_name || user.email, 40)}`, 20, y);

    const pdfBytes = doc.output('arraybuffer');
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const filename = `raport_${cleanText(report.client_name, 30)?.replace(/\s+/g, '_') || 'wizyta'}.pdf`;

    return Response.json({ pdf: base64, filename });

  } catch (error) {
    console.error('PDF error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});