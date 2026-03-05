import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@4.0.0';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produkcja, eksport, zuzycie, result } = await req.json();

    const doc = new jsPDF();

    // Load logo
    let logoDataUrl = null;
    try {
      const logoRes = await fetch('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6985025012ef2a10cfdedf68/dcc00b19d_4-eco-logo.png');
      const logoBuffer = await logoRes.arrayBuffer();
      const bytes = new Uint8Array(logoBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      logoDataUrl = `data:image/png;base64,${btoa(binary)}`;
    } catch (e) {
      console.warn('Could not load logo:', e.message);
    }

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, 210, 45, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 12, 5, 40, 21);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('AUTOCONSUMPTION CALCULATOR', 190, 18, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('pl-PL')}`, 190, 27, { align: 'right' });

    // Main result
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('ANALYSIS RESULT', 20, 60);

    const resultColor = result.color === 'green' ? [34, 197, 94] : 
                       result.color === 'yellow' ? [245, 158, 11] : [239, 68, 68];
    doc.setFillColor(...resultColor);
    doc.roundedRect(20, 65, 170, 35, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(result.level, 105, 77, { align: 'center' });
    doc.setFontSize(32);
    doc.text(`${result.pctAuto}%`, 105, 93, { align: 'center' });

    // Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Energy details', 20, 115);

    const details = [
      ['Energy production:', `${parseFloat(produkcja).toFixed(1)} kWh`],
      ['Autoconsumption:', `${result.auto.toFixed(1)} kWh`],
      ['Export to grid:', `${parseFloat(eksport).toFixed(1)} kWh (${result.pctExport}%)`]
    ];

    let y = 125;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    details.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    if (result.pctOwn) {
      y += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Consumption analysis', 20, y);
      y += 10;

      const usage = [
        ['Total home consumption:', `${parseFloat(zuzycie).toFixed(1)} kWh`],
        ['Import from grid:', `${result.importFromGrid.toFixed(1)} kWh (${result.pctGrid}%)`],
        ['Self-sufficiency:', `${result.pctOwn}%`]
      ];

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      usage.forEach(([label, value]) => {
        doc.text(label, 25, y);
        doc.text(value, 180, y, { align: 'right' });
        y += 8;
      });
    }

    // Recommendations
    y += 15;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, y, 170, 30, 2, 2, 'S');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommendation:', 25, y + 8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(result.message, 25, y + 16, { maxWidth: 160 });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...resultColor);
    doc.text(result.recommendation, 25, y + 24);

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | Autoconsumption Report', 105, 285, { align: 'center' });

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