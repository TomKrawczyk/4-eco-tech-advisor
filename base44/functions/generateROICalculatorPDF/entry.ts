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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { kosztInstalacji, rocznaProdukcja, cenaPradu, kosztUtrzymania, inflacjaEnergii, degradacjaPaneli, result } = await req.json();

    const doc = new jsPDF();
    const PAGE_W = 210;
    const MARGIN = 20;
    const TEXT_W = PAGE_W - MARGIN * 2;

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, PAGE_W, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4-ECO Green Energy', MARGIN, 18);
    doc.setFontSize(16);
    doc.text('ANALIZA OPLACALNOSCI (ROI)', PAGE_W - MARGIN, 16, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Instalacja fotowoltaiczna', PAGE_W - MARGIN, 25, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, PAGE_W - MARGIN, 33, { align: 'right' });

    let y = 55;

    // Key metrics boxes
    const boxes = [
      { label: 'ZWROT', value: `${result.rokZwrotu || '25+'} lat` },
      { label: 'ROI', value: `${result.roiProcent}%` },
      { label: 'ZYSK', value: `${(result.zyskCalkowity / 1000).toFixed(0)}k zl` }
    ];
    const boxW = 52;
    const gap = (TEXT_W - boxW * 3) / 2;
    boxes.forEach((box, i) => {
      const bx = MARGIN + i * (boxW + gap);
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(bx, y, boxW, 24, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(box.label, bx + boxW / 2, y + 8, { align: 'center' });
      doc.setFontSize(16);
      doc.text(box.value, bx + boxW / 2, y + 20, { align: 'center' });
    });
    y += 32;

    // Section helper
    const addSection = (title) => {
      if (y > 255) { doc.addPage(); y = 20; }
      y += 3;
      doc.setFillColor(243, 244, 246);
      doc.rect(MARGIN, y - 3, TEXT_W, 8, 'F');
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(c(title), MARGIN + 2, y + 2);
      y += 12;
    };

    const addRow = (label, value) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const labelLines = doc.splitTextToSize(c(label), 120);
      doc.text(labelLines, MARGIN + 5, y);
      doc.text(c(String(value)), PAGE_W - MARGIN, y, { align: 'right' });
      const lineH = labelLines.length * 5 + 3;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + lineH - 1, PAGE_W - MARGIN, y + lineH - 1);
      y += lineH;
    };

    // Parameters
    addSection('Parametry analizy');
    addRow('Koszt instalacji', `${parseFloat(kosztInstalacji).toLocaleString()} zl`);
    addRow('Roczna produkcja', `${rocznaProdukcja} kWh`);
    addRow('Cena pradu (brutto)', `${cenaPradu} zl/kWh`);
    addRow('Koszt utrzymania', `${kosztUtrzymania} zl/rok`);
    addRow('Inflacja cen energii', `${inflacjaEnergii}%/rok`);
    addRow('Degradacja paneli', `${degradacjaPaneli}%/rok`);

    // Yearly table
    addSection('Szczegolowa analiza (pierwsze 10 lat)');

    // Table header
    doc.setFillColor(34, 197, 94);
    doc.rect(MARGIN, y, TEXT_W, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const cols = [
      { label: 'Rok', x: MARGIN + 3 },
      { label: 'Produkcja', x: MARGIN + 33 },
      { label: 'Cena', x: MARGIN + 78 },
      { label: 'Oszczednosci', x: MARGIN + 108 },
      { label: 'Zysk', x: PAGE_W - MARGIN - 3, align: 'right' }
    ];
    cols.forEach(col => doc.text(col.label, col.x, y + 5, { align: col.align || 'left' }));
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    result.dataRoczna.slice(0, 10).forEach((row, idx) => {
      if (y > 268) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN, y, TEXT_W, 6, 'F');
      }
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(row.rok, MARGIN + 3, y + 4);
      doc.text(`${row.produkcja} kWh`, MARGIN + 33, y + 4);
      doc.text(`${row.cenaPradu} zl`, MARGIN + 78, y + 4);
      doc.text(`${row.oszczednosci.toLocaleString()} zl`, MARGIN + 108, y + 4);
      doc.setTextColor(row.zysk > 0 ? 34 : 239, row.zysk > 0 ? 197 : 68, row.zysk > 0 ? 94 : 68);
      doc.text(`${row.zysk.toLocaleString()} zl`, PAGE_W - MARGIN - 3, y + 4, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 6;
    });

    // Summary box
    y += 8;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, TEXT_W, 28, 2, 2, 'DF');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PODSUMOWANIE INWESTYCJI', PAGE_W / 2, y + 8, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Calkowite oszczednosci (25 lat): ${result.skumulowaneOszczednosci.toLocaleString()} zl`, PAGE_W / 2, y + 16, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(`ZYSK NETTO: ${result.zyskCalkowity.toLocaleString()} zl`, PAGE_W / 2, y + 24, { align: 'center' });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | Analiza oplacalnosci instalacji PV', PAGE_W / 2, 285, { align: 'center' });

    const pdfBase64 = doc.output('datauristring');
    return Response.json({ pdf_base64: pdfBase64, filename: 'analiza-roi.pdf' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});