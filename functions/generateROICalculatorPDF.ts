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

    const { kosztInstalacji, rocznaProdukcja, cenaPradu, kosztUtrzymania, inflacjaEnergii, degradacjaPaneli, result } = await req.json();

    const doc = new jsPDF();

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, 210, 48, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PROFITABILITY ANALYSIS', 105, 18, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('Photovoltaic installation', 105, 28, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('pl-PL')}`, 105, 38, { align: 'center' });

    // Key metrics
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY INDICATORS', 20, 63);

    // ROI boxes
    const boxes = [
      { label: 'PAYBACK', value: `${result.rokZwrotu || '25+'} YEARS`, x: 20 },
      { label: 'ROI', value: `${result.roiProcent}%`, x: 75 },
      { label: 'PROFIT', value: `${(result.zyskCalkowity / 1000).toFixed(0)}k PLN`, x: 130 }
    ];

    boxes.forEach(box => {
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(box.x, 70, 45, 25, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(box.label, box.x + 22.5, 77, { align: 'center' });
      doc.setFontSize(16);
      doc.text(box.value, box.x + 22.5, 90, { align: 'center' });
    });

    // Parameters
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis parameters', 20, 110);

    const params = [
      ['Installation cost:', `${parseFloat(kosztInstalacji).toLocaleString()} PLN`],
      ['Annual production:', `${rocznaProdukcja} kWh`],
      ['Electricity price (initial):', `${cenaPradu} PLN/kWh`],
      ['Maintenance cost:', `${kosztUtrzymania} PLN/year`],
      ['Energy inflation:', `${inflacjaEnergii}%/year`],
      ['Panel degradation:', `${degradacjaPaneli}%/year`]
    ];

    let y = 118;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    params.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 6;
    });

    // Yearly breakdown table
    y = 155;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed analysis (first 10 years)', 20, y);
    y += 8;

    // Table header
    doc.setFillColor(34, 197, 94);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Year', 25, y + 5);
    doc.text('Production', 55, y + 5);
    doc.text('Price', 95, y + 5);
    doc.text('Savings', 120, y + 5);
    doc.text('Profit', 165, y + 5, { align: 'right' });
    y += 8;

    // Table rows
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    result.dataRoczna.slice(0, 10).forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(243, 244, 246);
        doc.rect(20, y, 170, 6, 'F');
      }
      doc.text(row.rok, 25, y + 4);
      doc.text(`${row.produkcja} kWh`, 55, y + 4);
      doc.text(`${row.cenaPradu} PLN`, 95, y + 4);
      doc.text(`${row.oszczednosci.toLocaleString()} PLN`, 120, y + 4);
      doc.setTextColor(row.zysk > 0 ? 34 : 239, row.zysk > 0 ? 197 : 68, row.zysk > 0 ? 94 : 68);
      doc.text(`${row.zysk.toLocaleString()} PLN`, 185, y + 4, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 6;
    });

    // Summary box
    y = 250;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(20, y, 170, 25, 2, 2, 'F');
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, y, 170, 25, 2, 2, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INVESTMENT SUMMARY', 105, y + 8, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total savings (25 years): ${result.skumulowaneOszczednosci.toLocaleString()} PLN`, 105, y + 15, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(`NET PROFIT: ${result.zyskCalkowity.toLocaleString()} PLN`, 105, y + 22, { align: 'center' });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | PV Installation Profitability Analysis', 105, 285, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=analiza-roi.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});