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
    doc.text('PV INSTALLATION CALCULATOR', 190, 18, { align: 'right' });
    
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('pl-PL')}`, 190, 27, { align: 'right' });

    // Main result
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('RECOMMENDED INSTALLATION', 20, 60);

    doc.setFillColor(34, 197, 94);
    doc.roundedRect(20, 65, 80, 25, 3, 3, 'F');
    doc.roundedRect(110, 65, 80, 25, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(`${result.mocInstalacji} kWp`, 60, 80, { align: 'center' });
    doc.text(`${result.rocznaProdukcja} kWh`, 150, 80, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text('Installation power', 60, 87, { align: 'center' });
    doc.text('Annual production', 150, 87, { align: 'center' });

    // Key stats
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key parameters', 20, 105);

    const stats = [
      ['Number of panels:', `${result.liczbaPaneli} pcs. (${result.mocPanela}Wp)`],
      ['Installation power:', `${result.mocInstalacji} kWp`],
      ['Annual production:', `${result.rocznaProdukcja} kWh`],
      ['Annual savings:', `${result.oszczednosciRoczne.toFixed(0)} PLN`]
    ];

    if (result.kosztInstalacji) {
      stats.push(['Installation cost:', `${result.kosztInstalacji.toLocaleString()} PLN`]);
    }
    if (result.rokZwrotu) {
      stats.push(['Return on investment:', `${result.rokZwrotu} years`]);
    }

    let y = 115;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    stats.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    // Parameters
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Calculation parameters', 20, y);
    y += 10;

    const orientacjaMap = {
      "1.0": "South (100%)",
      "0.9": "South-East / South-West (90%)",
      "0.8": "East / West (80%)"
    };

    const params = [
      ['Annual energy consumption:', `${zuzycie} kWh`],
      ['Roof orientation:', orientacjaMap[orientacja] || orientacja],
      ['Electricity price (gross):', `${cenaPradu} PLN/kWh`]
    ];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    params.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, 180, y, { align: 'right' });
      y += 8;
    });

    // Weather info
    if (weatherData) {
      y += 10;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.roundedRect(20, y, 170, 20, 2, 2, 'S');
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Weather forecast included (7 days):', 25, y + 8);
      doc.text(`Avg sun hours: ${weatherData.summary.avg_sun_hours}h/day`, 25, y + 15);
      doc.text(`Production potential: ${weatherData.summary.avg_production_factor}%`, 105, y + 15);
      y += 25;
    }

    // Savings projection
    if (result.rokZwrotu) {
      y += 10;
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(20, y, 170, 30, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Return on investment', 105, y + 12, { align: 'center' });
      doc.setFontSize(24);
      doc.text(`${result.rokZwrotu} years`, 105, y + 25, { align: 'center' });
    }

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('4-ECO Green Energy | PV Installation Calculator', 105, 285, { align: 'center' });

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