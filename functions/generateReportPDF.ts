import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';

// Funkcja do pobrania czcionki z Google Fonts i konwersji na Base64
async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'reportId is required' }, { status: 400 });
    }

    const report = await base44.entities.VisitReport.get(reportId);
    
    const doc = new jsPDF();
    
    // Pobierz czcionkę Roboto z obsługą polskich znaków
    // Używamy wersji Latin Extended która zawiera polskie znaki
    try {
      const fontUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-ext-400-normal.ttf';
      const fontBase64 = await fetchFontAsBase64(fontUrl);
      
      doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto', 'normal');
    } catch (fontError) {
      console.error('Font loading failed, using fallback:', fontError);
      // Fallback - użyj helvetica ale z normalizacją polskich znaków
    }
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);
    let y = 20;

    // Sprawdź czy potrzebna nowa strona
    const checkNewPage = (requiredSpace = 15) => {
      if (y + requiredSpace > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // Dodaj nagłówek sekcji
    const addSectionHeader = (title: string) => {
      checkNewPage(20);
      y += 5;
      doc.setFontSize(14);
      doc.setTextColor(34, 197, 94);
      doc.text(title, margin, y);
      y += 2;
      // Linia pod nagłówkiem
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentWidth, y);
      y += 8;
      doc.setTextColor(0, 0, 0);
    };

    // Dodaj pole z etykietą i wartością w jednej linii
    const addField = (label: string, value: any) => {
      if (!value && value !== 0) return;
      
      const valueStr = String(value);
      doc.setFontSize(10);
      
      // Oblicz potrzebną wysokość
      const valueLines = doc.splitTextToSize(valueStr, contentWidth - 5);
      const lineHeight = 5;
      const fieldHeight = Math.max(lineHeight, valueLines.length * lineHeight);
      
      checkNewPage(fieldHeight + 3);
      
      // Etykieta (pogrubiona)
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin, y);
      
      // Wartość - pod etykietą z wcięciem
      doc.setTextColor(0, 0, 0);
      y += lineHeight;
      doc.text(valueLines, margin + 5, y);
      
      y += (valueLines.length - 1) * lineHeight + 5;
    };

    // Dodaj pole inline (etykieta: wartość w jednej linii)
    const addFieldInline = (label: string, value: any) => {
      if (!value && value !== 0) return;
      
      checkNewPage(8);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(label + ' ' + String(value), margin, y);
      y += 6;
    };

    // === NAGŁÓWEK GŁÓWNY ===
    doc.setFontSize(20);
    doc.setTextColor(34, 197, 94);
    doc.text('Raport wizyty technicznej', margin, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('4-ECO Green Energy', margin, y);
    y += 12;

    // === DANE KLIENTA ===
    addSectionHeader('Dane klienta');
    addFieldInline('Klient:', report.client_name);
    if (report.client_address) addFieldInline('Adres:', report.client_address);
    if (report.client_phone) addFieldInline('Telefon:', report.client_phone);
    if (report.visit_date) {
      addFieldInline('Data wizyty:', new Date(report.visit_date).toLocaleDateString('pl-PL'));
    }
    if (report.installation_types?.length) {
      addFieldInline('Rodzaj instalacji:', report.installation_types.join(', '));
    }

    // === DANE INSTALACJI ===
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('Dane instalacji');
      if (report.launch_date) addFieldInline('Data uruchomienia:', report.launch_date);
      if (report.contractor) addFieldInline('Wykonawca:', report.contractor);
      if (report.annual_production_kwh) addFieldInline('Roczna produkcja:', report.annual_production_kwh + ' kWh');
      if (report.energy_imported_kwh) addFieldInline('Energia pobrana (1.8.0):', report.energy_imported_kwh + ' kWh');
      if (report.energy_exported_kwh) addFieldInline('Energia oddana (2.8.0):', report.energy_exported_kwh + ' kWh');
    }

    // === KONTROLA TECHNICZNA ===
    const technicalFields = [
      ['Autokonsumpcja:', report.autoconsumption_rating],
      ['Stan paneli:', report.panels_condition],
      ['Mocowania:', report.mounting_condition],
      ['Przewody:', report.cables_condition],
      ['Zabezpieczenia:', report.protection_condition],
      ['Falownik:', report.inverter_reading],
      ['Uziemienie:', report.grounding_condition],
      ['Rozbudowa:', report.expansion_possibilities],
      ['Modernizacja:', report.modernization_potential],
      ['Rekomendacje:', report.recommendations],
      ['Uwagi:', report.additional_notes]
    ].filter(([_, val]) => val);

    if (technicalFields.length > 0) {
      addSectionHeader('Kontrola techniczna');
      technicalFields.forEach(([label, value]) => addField(label as string, value));
    }

    // === WYWIAD Z KLIENTEM ===
    const interviewFields = [
      ['Roczny koszt:', report.interview_annual_cost],
      ['Mieszkańcy:', report.interview_residents],
      ['Wyjście do pracy/szkoły:', report.interview_work_schedule],
      ['Powrót do domu:', report.interview_return_time],
      ['Obecność w domu (10-15):', report.interview_home_during_day],
      ['Szczyt zużycia:', report.interview_peak_usage],
      ['Używanie urządzeń:', report.interview_appliance_usage],
      ['Ogrzewanie wody:', report.interview_water_heating],
      ['Sprzęt:', report.interview_equipment],
      ['Plany:', report.interview_purchase_plans]
    ].filter(([_, val]) => val);

    if (interviewFields.length > 0) {
      addSectionHeader('Wywiad z klientem');
      interviewFields.forEach(([label, value]) => addField(label as string, value));
    }

    // === PODPIS KLIENTA ===
    if (report.client_signature) {
      checkNewPage(30);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('Podpis klienta:', margin, y);
      y += 8;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('Roboto', 'normal');
      const sigLines = doc.splitTextToSize(report.client_signature, contentWidth);
      doc.text(sigLines, margin, y);
    }
    
    // === STOPKA NA WSZYSTKICH STRONACH ===
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        'Strona ' + i + ' z ' + pageCount + ' | 4-ECO Green Energy | Wygenerowano: ' + new Date().toLocaleDateString('pl-PL'),
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generuj PDF
    const pdfBytes = doc.output('arraybuffer');
    
    // Bezpieczna nazwa pliku (bez polskich znaków w nazwie pliku)
    const safeFilename = (report.client_name || 'wizyta')
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
      .replace(/Ą/g, 'A').replace(/Ć/g, 'C').replace(/Ę/g, 'E')
      .replace(/Ł/g, 'L').replace(/Ń/g, 'N').replace(/Ó/g, 'O')
      .replace(/Ś/g, 'S').replace(/Ź/g, 'Z').replace(/Ż/g, 'Z')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=raport_' + safeFilename + '.pdf'
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
