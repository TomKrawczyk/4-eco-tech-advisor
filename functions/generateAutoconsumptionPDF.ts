import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produkcja, eksport, zuzycie, result } = await req.json();

    const doc = new jsPDF();

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('KALKULATOR AUTOKONSUMPCJI', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 105, 30, { align: 'center' });

    // Main result
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('WYNIK ANALIZY', 20, 55);

    const resultColor = result.color === 'green' ? [34, 197, 94] : 
                       result.color === 'yellow' ? [245, 158, 11] : [239, 68, 68];
    doc.setFillColor(...resultColor);
    doc.roundedRect(20, 60, 170, 35, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(result.level, 105, 72, { align: 'center' });
    doc.setFontSize(32);
    doc.text(`${result.pctAuto}%`, 105, 88, { align: 'center' });

    // Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Szczegóły energetyczne', 20, 110);

    const details = [
      ['Produkcja prądu:', `${parseFloat(produkcja).toFixed(1)} kWh`],
      ['Autokonsumpcja:', `${result.auto.toFixed(1)} kWh`],
      ['Eksport do sieci:', `${parseFloat(eksport).toFixed(1)} kWh (${result.pctExport}%)`]
    ];

    let y = 120;
    doc.setFontSize(11);
    details.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    if (result.pctOwn) {
      y += 10;
      doc.setFontSize(14);
      doc.text('Analiza zużycia', 20, y);
      y += 10;

      const usage = [
        ['Całkowite zużycie domu:', `${parseFloat(zuzycie).toFixed(1)} kWh`],
        ['Import z sieci:', `${result.importFromGrid.toFixed(1)} kWh (${result.pctGrid}%)`],
        ['Pokrycie własną energią:', `${result.pctOwn}%`]
      ];

      doc.setFontSize(11);
      usage.forEach(([label, value]) => {
        doc.text(label, 25, y);
        doc.text(value, 180, y, { align: 'right' });
        y += 8;
      });
    }

    // Recommendations
    y += 15;
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(20, y, 170, 30, 2, 2, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Rekomendacja:', 25, y + 8);
    doc.setFontSize(10);
    doc.text(result.message, 25, y + 16, { maxWidth: 160 });
    doc.setFontSize(11);
    doc.setTextColor(...resultColor);
    doc.text(result.recommendation, 25, y + 24);

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text('4-ECO Green Energy | Raport autokonsumpcji', 105, 285, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=autokonsumpcja.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});