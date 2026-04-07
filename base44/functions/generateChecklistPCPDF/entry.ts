import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const c = (t) => {
  if (!t) return '';
  return String(t)
    .replace(/ą/g, 'a').replace(/Ą/g, 'A').replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N').replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S').replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { client_name, client_phone, client_address, worker_signature, client_signature, photos = [], fields = {} } = body;

    const doc = new jsPDF();
    let y = 20;

    const orange = [234, 88, 12];
    const orangeLight = [255, 237, 213];
    const grayLight = [243, 244, 246];
    const grayDark = [75, 85, 99];
    const black = [17, 17, 17];

    const checkPageBreak = (needed = 15) => {
      if (y + needed > 275) { doc.addPage(); y = 20; }
    };

    const addSectionHeader = (title) => {
      checkPageBreak(12);
      doc.setFillColor(...orangeLight);
      doc.rect(15, y - 3, 180, 8, 'F');
      doc.setTextColor(...orange);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(c(title), 17, y + 2);
      y += 13;
    };

    const addField = (label, value) => {
      if (!value) return;
      checkPageBreak(12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayDark);
      doc.text(c(label), 20, y);
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(String(value)), 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 4;
    };

    const addMultilineField = (label, value) => {
      if (!value) return;
      checkPageBreak(12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayDark);
      doc.text(c(label), 20, y);
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(c(String(value)), 170);
      lines.forEach(line => {
        checkPageBreak(6);
        doc.text(line, 20, y);
        y += 5;
      });
      y += 3;
    };

    // ── HEADER ────────────────────────────────────────────────────────
    doc.setFillColor(...orange);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('4-ECO Green Energy', 15, 17);
    doc.setFontSize(16);
    doc.text(c('PROTOKOL PRZEGLADU / AUDYTU PC'), 195, 15, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('pl-PL'), 195, 24, { align: 'right' });
    doc.text(c(`Wykonał: ${user.full_name || user.email}`), 15, 28);
    y = 52;
    doc.setTextColor(...black);

    // ── DANE KLIENTA ──────────────────────────────────────────────────
    addSectionHeader('DANE KLIENTA');
    addField('Imie i nazwisko:', client_name);
    addField('Telefon:', client_phone);
    addField('Adres obiektu:', client_address);
    y += 2;

    // ── POLA PROTOKOŁU ────────────────────────────────────────────────
    const pcAuditFields = [
      { key: "pc_data_przegladu", label: "Data realizowanego przegladu", section: "Dane klienta / instalacji" },
      { key: "pc_data_ostatniego", label: "Data ostatniego przegladu", section: "Dane klienta / instalacji" },
      { key: "pc_nazwa_adres", label: "Nazwa i adres firmy wykonujacej", section: "Dane osoby wykonujacej przeglad" },
      { key: "pc_imie_nazwisko", label: "Imie i nazwisko wykonawcy", section: "Dane osoby wykonujacej przeglad" },
      { key: "pc_opis_czynnosci", label: "Opis czynnosci do wykonania / opis przegladu", section: "Lista wykonanych czynnosci", multiline: true },
      { key: "pc_uwagi_serwisowe", label: "Uwagi serwisowe / stwierdzone usterki", section: "Lista wykonanych czynnosci", multiline: true },
      { key: "pc_stan_pompy", label: "Stan ogolny pompy ciepla / kotla", section: "Stan techniczny urzadzenia" },
      { key: "pc_filtr_magnetyczny", label: "Stan filtra magnetycznego", section: "Stan techniczny urzadzenia" },
      { key: "pc_oslona_przewodow", label: "Oslona przewodow przed promieniowaniem UV", section: "Stan techniczny urzadzenia" },
      { key: "pc_cisnienie_czynnika", label: "Cisnienie czynnika chlodniczego", section: "Stan techniczny urzadzenia" },
      { key: "pc_temperatura_pracy", label: "Temperatura pracy / odczyt sterownika", section: "Stan techniczny urzadzenia" },
      { key: "pc_gwarancja", label: "Status gwarancji", section: "Stan techniczny urzadzenia" },
      { key: "pc_opis_wykonanych", label: "Opis wykonanych czynnosci (podsumowanie)", section: "Odbior prac", multiline: true },
      { key: "pc_godz_przyjazdu", label: "Godzina przyjazdu", section: "Czas wykonania" },
      { key: "pc_godz_wyjazdu", label: "Godzina wyjazdu", section: "Czas wykonania" },
      { key: "pc_rekomendacje", label: "Rekomendacje i zalecenia serwisowe", section: "Rekomendacje", multiline: true },
      { key: "pc_dodatkowe_uwagi", label: "Dodatkowe uwagi", section: "Rekomendacje", multiline: true },
    ];

    const sections = [...new Set(pcAuditFields.map(f => f.section))];
    sections.forEach(section => {
      const sectionFields = pcAuditFields.filter(f => f.section === section);
      const hasData = sectionFields.some(f => fields[f.key]);
      if (!hasData) return;
      addSectionHeader(section);
      sectionFields.forEach(f => {
        if (!fields[f.key]) return;
        if (f.multiline) addMultilineField(f.label + ':', fields[f.key]);
        else addField(f.label + ':', fields[f.key]);
      });
      y += 2;
    });

    // ── ZDJĘCIA ───────────────────────────────────────────────────────
    if (photos && photos.length > 0) {
      doc.addPage();
      y = 20;
      addSectionHeader('DOKUMENTACJA FOTOGRAFICZNA');

      const imgW = 85;
      const imgH = 64;
      const margin = 15;
      const gap = 10;
      let col = 0;

      for (const url of photos) {
        try {
          const resp = await fetch(url);
          const arrayBuf = await resp.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          const b64 = btoa(binary);
          const ext = url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';

          const x = margin + col * (imgW + gap);
          checkPageBreak(imgH + 10);
          if (col === 0 && y !== 20) {}
          doc.addImage(b64, ext, x, y, imgW, imgH);
          col++;
          if (col >= 2) { col = 0; y += imgH + gap; }
        } catch (imgErr) {
          console.warn('Could not load image:', url, imgErr.message);
        }
      }
      if (col > 0) y += imgH + gap;
      y += 5;
    }

    // ── PODPISY ───────────────────────────────────────────────────────
    checkPageBreak(80);
    addSectionHeader('PODPISY');

    const addSignatureImage = async (label, dataUrl, xOffset) => {
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        doc.setFontSize(9);
        doc.setTextColor(...grayDark);
        doc.text(c(label), xOffset, y);
        doc.setDrawColor(...grayLight);
        doc.line(xOffset, y + 20, xOffset + 80, y + 20);
        return;
      }
      doc.setFontSize(9);
      doc.setTextColor(...grayDark);
      doc.text(c(label), xOffset, y);
      try {
        const base64Data = dataUrl.split(',')[1];
        doc.addImage(base64Data, 'PNG', xOffset, y + 3, 80, 25);
      } catch (_) {}
      doc.setDrawColor(...grayLight);
      doc.line(xOffset, y + 30, xOffset + 80, y + 30);
    };

    await addSignatureImage('Podpis pracownika:', worker_signature, 20);
    await addSignatureImage('Podpis klienta:', client_signature, 115);
    y += 35;

    // ── FOOTER ────────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(...grayLight);
      doc.setLineWidth(0.5);
      doc.line(15, 277, 195, 277);
      doc.setFontSize(7);
      doc.setTextColor(...grayDark);
      doc.setFont('helvetica', 'normal');
      doc.text(c(`Wykonal: ${user.full_name || user.email}`), 20, 283);
      doc.text(`Strona ${i} / ${pageCount}`, 190, 283, { align: 'right' });
      doc.text('(c) 2026 4-ECO Green Energy', 105, 283, { align: 'center' });
    }

    const pdfBase64 = doc.output('datauristring').split('base64,')[1];
    const safeClient = c(client_name)?.replace(/\s+/g, '_') || 'protokol';
    const filename = `protokol_pc_${safeClient}.pdf`;

    return Response.json({ pdf_base64: pdfBase64, filename });

  } catch (error) {
    console.error('PC PDF error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});