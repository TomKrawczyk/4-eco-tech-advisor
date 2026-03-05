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

    const { zuzycie, orientacja, cenaPradu, result, weatherData } = await req.json();

    const doc = new jsPDF();
    const PAGE_W = 210;
    const MARGIN = 20;
    const TEXT_W = PAGE_W - MARGIN * 2;

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
    doc.text('KALKULATOR INSTALACJI PV', PAGE_W - MARGIN, 18, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, PAGE_W - MARGIN, 27, { align: 'right' });

    let y = 55;

    // Key results boxes
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(MARGIN, y, 80, 25, 3, 3, 'F');
    doc.roundedRect(PAGE_W - MARGIN - 80, y, 80, 25, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${result.mocInstalacji} kWp`, MARGIN + 40, y + 14, { align: 'center' });
    doc.text(`${result.rocznaProdukcja} kWh`, PAGE_W - MARGIN - 40, y + 14, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Moc instalacji', MARGIN + 40, y + 21, { align: 'center' });
    doc.text('Roczna produkcja', PAGE_W - MARGIN - 40, y + 21, { align: 'center' });
    y += 33;

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
      const valueStr = c(String(value));
      doc.text(labelLines, MARGIN + 5, y);
      doc.text(valueStr, PAGE_W - MARGIN, y, { align: 'right' });
      const lineH = labelLines.length * 5 + 3;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + lineH - 1, PAGE_W - MARGIN, y + lineH - 1);
      y += lineH;
    };

    // Key parameters
    addSection('Kluczowe parametry');
    addRow('Liczba paneli', `${result.liczbaPaneli} szt. (${result.mocPanela}Wp)`);
    addRow('Moc instalacji', `${result.mocInstalacji} kWp`);
    addRow('Roczna produkcja', `${result.rocznaProdukcja} kWh`);
    addRow('Oszczednosci roczne', `${result.oszczednosciRoczne.toFixed(0)} zl`);
    if (result.kosztInstalacji) addRow('Koszt instalacji', `${result.kosztInstalacji.toLocaleString()} zl`);
    if (result.rokZwrotu) addRow('Zwrot inwestycji', `${result.rokZwrotu} lat`);

    // Calculation parameters
    addSection('Parametry kalkulacji');
    const orientacjaMap = {
      "1.0": "Poludnie (100%)",
      "0.9": "Pld-Wsch / Pld-Zach (90%)",
      "0.8": "Wschod / Zachod (80%)"
    };
    addRow('Roczne zuzycie energii', `${zuzycie} kWh`);
    addRow('Orientacja dachu', orientacjaMap[orientacja] || orientacja);
    addRow('Cena pradu (brutto)', `${cenaPradu} zl/kWh`);

    // Weather info
    if (weatherData) {
      addSection('Prognoza pogody (7 dni)');
      addRow('Sr. godziny sloneczne', `${weatherData.summary.avg_sun_hours}h/dzien`);
      addRow('Potencjal produkcji', `${weatherData.summary.avg_production_factor}%`);
    }

    // Return on investment highlight
    if (result.rokZwrotu) {
      y += 8;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(MARGIN, y, TEXT_W, 28, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Zwrot inwestycji', PAGE_W / 2, y + 10, { align: 'center' });
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(`${result.rokZwrotu} lat`, PAGE_W / 2, y + 23, { align: 'center' });
    }

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | Kalkulator Instalacji PV', PAGE_W / 2, 285, { align: 'center' });

    const pdfBase64 = doc.output('datauristring');
    return Response.json({ pdf_base64: pdfBase64, filename: 'kalkulator-pv.pdf' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});