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

    const { produkcja, eksport, zuzycie, result } = await req.json();

    const doc = new jsPDF();
    const PAGE_W = 210;
    const MARGIN = 20;
    const TEXT_W = PAGE_W - MARGIN * 2; // 170

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
    doc.rect(0, 0, PAGE_W, 45, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, 7, 35, 17);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('KALKULATOR AUTOKONSUMPCJI', PAGE_W - MARGIN, 18, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, PAGE_W - MARGIN, 27, { align: 'right' });

    let y = 58;

    // Result box
    const resultColor = result.color === 'green' ? [34, 197, 94] :
                        result.color === 'yellow' ? [245, 158, 11] : [239, 68, 68];
    doc.setFillColor(...resultColor);
    doc.roundedRect(MARGIN, y, TEXT_W, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(c(result.level), PAGE_W / 2, y + 11, { align: 'center' });
    doc.setFontSize(26);
    doc.text(`${result.pctAuto}%`, PAGE_W / 2, y + 25, { align: 'center' });
    y += 38;

    // Section helper
    const addSection = (title) => {
      y += 5;
      doc.setFillColor(243, 244, 246);
      doc.rect(MARGIN, y - 3, TEXT_W, 8, 'F');
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(c(title), MARGIN + 2, y + 2);
      y += 12;
    };

    // Row helper
    const addRow = (label, value) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const labelLines = doc.splitTextToSize(c(label), 110);
      const valueLines = doc.splitTextToSize(c(value), 50);
      doc.text(labelLines, MARGIN + 5, y);
      doc.text(valueLines, PAGE_W - MARGIN, y, { align: 'right' });
      const lineH = Math.max(labelLines.length, valueLines.length) * 5 + 3;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + lineH - 1, PAGE_W - MARGIN, y + lineH - 1);
      y += lineH;
    };

    // Energy details section
    addSection('Szczegoly energetyczne');
    addRow('Produkcja pradu', `${parseFloat(produkcja).toFixed(1)} kWh`);
    addRow('Autokonsumpcja', `${result.auto.toFixed(1)} kWh`);
    addRow('Eksport do sieci', `${parseFloat(eksport).toFixed(1)} kWh (${result.pctExport}%)`);

    // Consumption analysis
    if (result.pctOwn) {
      addSection('Analiza zuzycia');
      addRow('Calkowite zuzycie domu', `${parseFloat(zuzycie).toFixed(1)} kWh`);
      addRow('Import z sieci', `${result.importFromGrid.toFixed(1)} kWh (${result.pctGrid}%)`);
      addRow('Pokrycie wlasna energia', `${result.pctOwn}%`);
    }

    // Recommendation box
    y += 10;
    if (y > 240) { doc.addPage(); y = 20; }

    const msgLines = doc.splitTextToSize(c(result.message), TEXT_W - 10);
    const recLines = doc.splitTextToSize(c(result.recommendation), TEXT_W - 10);
    const boxH = 14 + msgLines.length * 5 + recLines.length * 5 + 4;

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, TEXT_W, boxH, 2, 2, 'DF');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Rekomendacja:', MARGIN + 5, y + 8);
    y += 13;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(msgLines, MARGIN + 5, y);
    y += msgLines.length * 5 + 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...resultColor);
    doc.text(recLines, MARGIN + 5, y);

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | Raport autokonsumpcji', PAGE_W / 2, 285, { align: 'center' });

    const pdfBase64 = doc.output('datauristring');
    return Response.json({ pdf_base64: pdfBase64, filename: 'autokonsumpcja.pdf' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});