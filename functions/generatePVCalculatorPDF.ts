import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { zuzycie, orientacja, cenaPradu, result, weatherData } = await req.json();

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
    doc.rect(0, 0, 210, 45, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 12, 5, 40, 21);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('KALKULATOR INSTALACJI PV', 190, 18, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 190, 27, { align: 'right' });

    // Main result
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('REKOMENDOWANA INSTALACJA', 20, 55);

    doc.setFillColor(34, 197, 94);
    doc.roundedRect(20, 60, 80, 25, 3, 3, 'F');
    doc.roundedRect(110, 60, 80, 25, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(`${result.mocInstalacji} kWp`, 60, 75, { align: 'center' });
    doc.text(`${result.rocznaProdukcja} kWh`, 150, 75, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text('Moc instalacji', 60, 82, { align: 'center' });
    doc.text('Produkcja roczna', 150, 82, { align: 'center' });

    // Key stats
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Kluczowe parametry', 20, 100);

    const stats = [
      ['Liczba paneli:', `${result.liczbaPaneli} szt. (${result.mocPanela}Wp)`],
      ['Moc instalacji:', `${result.mocInstalacji} kWp`],
      ['Roczna produkcja:', `${result.rocznaProdukcja} kWh`],
      ['Oszczędności roczne:', `${result.oszczednosciRoczne.toFixed(0)} zł`]
    ];

    if (result.kosztInstalacji) {
      stats.push(['Koszt instalacji:', `${result.kosztInstalacji.toLocaleString()} zł`]);
    }
    if (result.rokZwrotu) {
      stats.push(['Zwrot inwestycji:', `${result.rokZwrotu} lat`]);
    }

    let y = 110;
    doc.setFontSize(11);
    stats.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    // Parameters
    y += 10;
    doc.setFontSize(14);
    doc.text('Parametry kalkulacji', 20, y);
    y += 10;

    const orientacjaMap = {
      "1.0": "Południe (100%)",
      "0.9": "Płd-Wsch / Płd-Zach (90%)",
      "0.8": "Wschód / Zachód (80%)"
    };

    const params = [
      ['Roczne zużycie energii:', `${zuzycie} kWh`],
      ['Orientacja dachu:', orientacjaMap[orientacja] || orientacja],
      ['Cena prądu brutto:', `${cenaPradu} zł/kWh`]
    ];

    doc.setFontSize(11);
    params.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    // Weather info
    if (weatherData) {
      y += 10;
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(20, y, 170, 20, 2, 2, 'F');
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('Uwzględniono prognozę pogody (7 dni):', 25, y + 8);
      doc.text(`Śr. godziny słoneczne: ${weatherData.summary.avg_sun_hours}h/dzień`, 25, y + 15);
      doc.text(`Potencjał produkcji: ${weatherData.summary.avg_production_factor}%`, 105, y + 15);
      y += 25;
    }

    // Savings projection
    if (result.rokZwrotu) {
      y += 10;
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(20, y, 170, 30, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('Zwrot inwestycji', 105, y + 12, { align: 'center' });
      doc.setFontSize(24);
      doc.text(`${result.rokZwrotu} lat`, 105, y + 25, { align: 'center' });
    }

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text('4-ECO Green Energy | Kalkulator instalacji PV', 105, 285, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=kalkulator-pv.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});