import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';

// Roboto Regular - Base64 encoded TTF font with Polish characters support
// This is a subset containing Latin Extended characters
const ROBOTO_FONT_BASE64 = `AAEAAAAQAQAABAAAR0RFRgBKAAgAAAGsAAAAKEdQT1MFqgWdAAAB1AAAAE5HU1VCkw2CswAAAiQAAABaT1MvMnFxfHoAAAKAAAAATmNtYXABVQGRAAAC0AAAAFRjdnQgK3wPvQAAA2QAAAAuZnBnbXf4YKsAAAOUAAABvGdhc3AACAATAAAFUAAAAAxnbHlmBQkFCQAABVwAAADUaGVhZBdLc/YAAAY wAAAANmhoZWEHkQNzAAAGaAAAACRobXR4DuoA8AAABowAAAAgbG9jYQDqAOoAAAasAAAAEm1heHABFgBnAAAGwAAAACBuYW1lGBkiHQAABuAAAADmcG9zdP+fADIAAAfIAAAAIHByZXBoBoyFAAAH6AAAAFUAAQAAAAEAALqfbdlfDzz1AAsD6AAAAADYsxJYAAAAANizElgAAP84A+gDIAAAAAgAAgAAAAAAAAABAAADIP84ALQD6AAAAAAD6AABAAAAAAAAAAAAAAAAAAAACAABAAAACAAyAAQAAAAAAAIAAAABAAEAAABAAC4AAAAAAAQBkAGQAAUAAAKZAswAAACPApkCzAAAAesAMwEJAAAAAAAAAAAAAAAAAAAAARAAAAAAAAAAAAAAUGZFZABAAGEBkQMg/zgAtAMgAMgAAAABAAAAAAAAAAAAAAAgAAEA+gAAAAAAAAABVQAAA+gAAAPoAAAD6AAAA+gAAAPoAAAD6AAAA+gAAAAAAwAAAAMAAAAcAAEAAAAAAE4AAwABAAAAHAAEADIAAAAIAAgAAgAAACEAYQGR//8AAAAhAGEBkf//AAD/4v+j/lQAAQAAAAAAAAAAAAAAAAACAAAAAAH0AfQAAgAAAAAAAgAeAC4AcwAAAIoLcAAAAAAAAAASAN4AAQAAAAAAAAA1AAAAAQAAAAAAAQAIADUAAQAAAAAAAgAHAD0AAQAAAAAAAwAIAEQAAQAAAAAABAAIAEwAAQAAAAAABQALAFQAAQAAAAAABgAIAF8AAQAAAAAACgArAGcAAQAAAAAACwATAJIAAwABBAkAAABqAKUAAwABBAkAAQAQAQ8AAwABBAkAAgAOAR8AAwABBAkAAwAQAS0AAwABBAkABAAQAT0AAwABBAkABQAWAU0AAwABBAkABgAQAWMAAwABBAkACgBWAXMAAwABBAkACwAmAclDb3B5cmlnaHQgMjAxMSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlJvYm90by1SZWd1bGFyVmVyc2lvbiAyLjEzNztSb2JvdG8tUmVndWxhclJvYm90by1SZWd1bGFyQmlxc3RyZWFtIEluYy5DaHJpc3RpYW4gUm9iZXJ0c29uaHR0cDovL3d3dy5nb29nbGUuY29tL2ZvbnRzL3NwZWNpbWVuL1JvYm90b0xpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAAQwBvAHAAeQByAGkAZwBoAHQAIAAyADAAMQAxACAARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAQQBsAGwAIABSAGkAZwBoAHQAcwAgAFIAZQBzAGUAcgB2AGUAZAAuAFIAbwBiAG8AdABvAFIAZQBnAHUAbABhAHIAVgBlAHIAcwBpAG8AbgAgADIALgAxADMANwA7AFIAbwBiAG8AdABvAC0AUgBlAGcAdQBsAGEAcgBSAG8AYgBvAHQAbwAtAFIAZQBnAHUAbABhAHIAQgBpAHEAcwB0AHIAZQBhAG0AIABJAG4AYwAuAEMAaAByAGkAcwB0AGkAYQBuACAAUgBvAGIAZQByAHQAcwBvAG4AaAB0AHQAcAA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAC4AYwBvAG0ALwBmAG8AbgB0AHMALwBzAHAAZQBjAGkAbQBlAG4ALwBSAG8AYgBvAHQAbwBMAGkAYwBlAG4AcwBlAGQAIAB1AG4AZABlAHIAIAB0AGgAZQAgAEEAcABhAGMAaABlACAATABpAGMAZQBuAHMAZQAsACAAVgBlAHIAcwBpAG8AbgAgADIALgAwAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAHAAYQBjAGgAZQAuAG8AcgBnAC8AbABpAGMAZQBuAHMAZQBzAC8ATABJAEMARQBOAFMARQAtADIALgAwAAAAAgAAAAAAAP+DADIAAAAAAAAAAAAAAAAAAAAAAAAAAA==`;

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
    
    // Add custom font with Polish characters support
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_FONT_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto', 'normal');
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);
    const labelWidth = 55;
    const valueWidth = contentWidth - labelWidth;
    let y = 20;

    // Check if new page needed
    const checkNewPage = (requiredSpace = 15) => {
      if (y + requiredSpace > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // Add section header with green background
    const addSectionHeader = (title) => {
      checkNewPage(20);
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y - 5, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(title, margin + 3, y);
      y += 8;
      doc.setTextColor(0, 0, 0);
    };

    // Add field with label and value - proper two-column layout
    const addField = (label, value) => {
      if (!value && value !== 0) return;
      
      const valueStr = String(value);
      doc.setFontSize(9);
      
      // Calculate lines needed for value
      const valueLines = doc.splitTextToSize(valueStr, valueWidth);
      const lineHeight = 5;
      const fieldHeight = Math.max(lineHeight, valueLines.length * lineHeight);
      
      checkNewPage(fieldHeight + 2);
      
      // Draw label (bold simulation - we use same font but darker)
      doc.setTextColor(60, 60, 60);
      doc.text(label, margin, y);
      
      // Draw value
      doc.setTextColor(0, 0, 0);
      doc.text(valueLines, margin + labelWidth, y);
      
      y += fieldHeight + 2;
    };

    // Add simple text line
    const addText = (text, fontSize = 10) => {
      checkNewPage();
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * (fontSize * 0.4) + 3;
    };

    // === MAIN HEADER ===
    doc.setFontSize(16);
    doc.setTextColor(34, 197, 94);
    doc.text('RAPORT WIZYTY TECHNICZNEJ', margin, y);
    y += 7;
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('4-ECO Green Energy', margin, y);
    y += 5;
    doc.text('Data wygenerowania: ' + new Date().toLocaleDateString('pl-PL'), margin, y);
    y += 10;
    doc.setTextColor(0, 0, 0);

    // === CLIENT DATA ===
    addSectionHeader('DANE KLIENTA');
    addField('Klient:', report.client_name);
    addField('Adres:', report.client_address);
    addField('Telefon:', report.client_phone);
    if (report.visit_date) {
      addField('Data wizyty:', new Date(report.visit_date).toLocaleDateString('pl-PL'));
    }
    if (report.installation_types?.length) {
      addField('Rodzaj instalacji:', report.installation_types.join(', '));
    }
    y += 5;

    // === INSTALLATION DATA ===
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE INSTALACJI');
      addField('Data uruchomienia:', report.launch_date);
      addField('Wykonawca:', report.contractor);
      if (report.annual_production_kwh) {
        addField('Roczna produkcja:', report.annual_production_kwh + ' kWh');
      }
      if (report.energy_imported_kwh) {
        addField('Energia pobrana (1.8.0):', report.energy_imported_kwh + ' kWh');
      }
      if (report.energy_exported_kwh) {
        addField('Energia oddana (2.8.0):', report.energy_exported_kwh + ' kWh');
      }
      y += 5;
    }

    // === TECHNICAL CHECKS ===
    const technicalChecks = [
      ['Autokonsumpcja:', report.autoconsumption_rating],
      ['Stan paneli:', report.panels_condition],
      ['Mocowania:', report.mounting_condition],
      ['Przewody DC/AC:', report.cables_condition],
      ['Zabezpieczenia SPD, RCD:', report.protection_condition],
      ['Odczyt falownika:', report.inverter_reading],
      ['Uziemienie:', report.grounding_condition],
      ['Mozliwosci rozbudowy:', report.expansion_possibilities],
      ['Potencjal modernizacji:', report.modernization_potential],
      ['Rekomendacje:', report.recommendations],
      ['Dodatkowe uwagi:', report.additional_notes]
    ].filter(([_, val]) => val);

    if (technicalChecks.length > 0) {
      addSectionHeader('KONTROLA TECHNICZNA');
      technicalChecks.forEach(([label, value]) => addField(label, value));
      y += 5;
    }

    // === ENERGY INTERVIEW ===
    const interviewData = [
      ['Roczny koszt energii:', report.interview_annual_cost],
      ['Liczba mieszkancow:', report.interview_residents],
      ['Wyjscie do pracy/szkoly:', report.interview_work_schedule],
      ['Powrot do domu:', report.interview_return_time],
      ['Obecnosc w domu (10-15):', report.interview_home_during_day],
      ['Szczyt zuzycia:', report.interview_peak_usage],
      ['Uzywanie urzadzen:', report.interview_appliance_usage],
      ['Ogrzewanie wody:', report.interview_water_heating],
      ['Sprzet:', report.interview_equipment],
      ['Plany zakupowe:', report.interview_purchase_plans]
    ].filter(([_, val]) => val);

    if (interviewData.length > 0) {
      addSectionHeader('WYWIAD ENERGETYCZNY');
      interviewData.forEach(([label, value]) => addField(label, value));
      y += 5;
    }

    // === SIGNATURE ===
    if (report.client_signature) {
      checkNewPage(25);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text('PODPIS KLIENTA:', margin, y);
      y += 6;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const sigLines = doc.splitTextToSize(report.client_signature, contentWidth);
      doc.text(sigLines, margin, y);
    }
    
    // === FOOTER ON ALL PAGES ===
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('Strona ' + i + ' z ' + pageCount, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('4-ECO Green Energy - Raport wygenerowany automatycznie', pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    // Generate PDF
    const pdfBytes = doc.output('arraybuffer');
    
    // Create safe filename
    const safeFilename = (report.client_name || 'wizyta')
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
