import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kosztInstalacji, rocznaProdukcja, cenaPradu, kosztUtrzymania, inflacjaEnergii, degradacjaPaneli, result } = await req.json();

    const doc = new jsPDF();

    // Load logo
    let logoDataUrl = null;
    try {
      const logoRes = await fetch('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6985025012ef2a10cfdedf68/dcc00b19d_4-eco-logo.png');
      const logoBuffer = await logoRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(logoBuffer)));
      logoDataUrl = `data:image/png;base64,${base64}`;
    } catch (e) {
      console.warn('Could not load logo:', e.message);
    }

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, 210, 48, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 12, 5, 40, 21);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('ANALIZA OPLACALNOSCI', 190, 18, { align: 'right' });
    doc.setFontSize(13);
    doc.text('Instalacja fotowoltaiczna', 190, 28, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 190, 38, { align: 'right' });

    // Key metrics
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('KLUCZOWE WSKAŹNIKI', 20, 58);

    // ROI boxes
    const boxes = [
      { label: 'ZWROT W', value: `${result.rokZwrotu || '25+'} LAT`, x: 20 },
      { label: 'ROI', value: `${result.roiProcent}%`, x: 75 },
      { label: 'ZYSK', value: `${(result.zyskCalkowity / 1000).toFixed(0)}k zł`, x: 130 }
    ];

    boxes.forEach(box => {
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(box.x, 65, 45, 25, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(box.label, box.x + 22.5, 72, { align: 'center' });
      doc.setFontSize(16);
      doc.text(box.value, box.x + 22.5, 85, { align: 'center' });
    });

    // Parameters
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Parametry analizy', 20, 105);

    const params = [
      ['Koszt instalacji:', `${parseFloat(kosztInstalacji).toLocaleString()} zł`],
      ['Roczna produkcja:', `${rocznaProdukcja} kWh`],
      ['Cena prądu (start):', `${cenaPradu} zł/kWh`],
      ['Koszt utrzymania:', `${kosztUtrzymania} zł/rok`],
      ['Inflacja energii:', `${inflacjaEnergii}%/rok`],
      ['Degradacja paneli:', `${degradacjaPaneli}%/rok`]
    ];

    let y = 113;
    doc.setFontSize(9);
    params.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 6;
    });

    // Yearly breakdown table
    y = 155;
    doc.setFontSize(12);
    doc.text('Szczegółowa analiza (pierwsze 10 lat)', 20, y);
    y += 8;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Rok', 25, y + 5);
    doc.text('Produkcja', 55, y + 5);
    doc.text('Cena', 95, y + 5);
    doc.text('Oszczędności', 120, y + 5);
    doc.text('Zysk', 165, y + 5, { align: 'right' });
    y += 8;

    // Table rows
    result.dataRoczna.slice(0, 10).forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y, 170, 6, 'F');
      }
      doc.setFontSize(8);
      doc.text(row.rok, 25, y + 4);
      doc.text(`${row.produkcja} kWh`, 55, y + 4);
      doc.text(`${row.cenaPradu} zł`, 95, y + 4);
      doc.text(`${row.oszczednosci.toLocaleString()} zł`, 120, y + 4);
      doc.setTextColor(row.zysk > 0 ? 34 : 239, row.zysk > 0 ? 197 : 68, row.zysk > 0 ? 94 : 68);
      doc.text(`${row.zysk.toLocaleString()} zł`, 185, y + 4, { align: 'right' });
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
    doc.text('PODSUMOWANIE INWESTYCJI', 105, y + 8, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Całkowite oszczędności (25 lat): ${result.skumulowaneOszczednosci.toLocaleString()} zł`, 105, y + 15, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(34, 197, 94);
    doc.text(`ZYSK NETTO: ${result.zyskCalkowity.toLocaleString()} zł`, 105, y + 22, { align: 'center' });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('4-ECO Green Energy | Analiza opłacalności instalacji PV', 105, 285, { align: 'center' });

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