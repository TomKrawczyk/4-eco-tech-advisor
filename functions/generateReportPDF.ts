import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

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
    
    // Funkcja normalizująca polskie znaki
    const normalize = (text) => {
      if (!text) return text;
      const map = {
        'ą': 'a', 'Ą': 'A',
        'ć': 'c', 'Ć': 'C',
        'ę': 'e', 'Ę': 'E',
        'ł': 'l', 'Ł': 'L',
        'ń': 'n', 'Ń': 'N',
        'ó': 'o', 'Ó': 'O',
        'ś': 's', 'Ś': 'S',
        'ź': 'z', 'Ź': 'Z',
        'ż': 'z', 'Ż': 'Z'
      };
      return String(text).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => map[char] || char);
    };
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 20;
    const margin = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - (2 * margin);

    const checkNewPage = () => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    };

    const addSectionHeader = (title) => {
      checkNewPage();
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(normalize(title), margin + 2, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 12;
    };

    const addField = (label, value) => {
      if (!value) return;
      checkNewPage();
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(normalize(label), margin, y);
      
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(normalize(String(value)), contentWidth - 50);
      doc.text(lines, margin + 50, y);
      
      y += Math.max(6, lines.length * 5);
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(normalize('RAPORT WIZYTY TECHNICZNEJ'), margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('4-ECO Green Energy', margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.text(`Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Client section
    addSectionHeader('DANE KLIENTA');
    addField('Klient:', report.client_name);
    addField('Adres:', report.client_address);
    addField('Telefon:', report.client_phone);
    addField('Data wizyty:', report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : '');
    addField('Rodzaj instalacji:', report.installation_types?.join(', '));
    y += 5;

    // Installation section
    if (report.launch_date || report.contractor || report.annual_production_kwh || 
        report.energy_imported_kwh || report.energy_exported_kwh) {
      addSectionHeader('DANE INSTALACJI');
      addField('Data uruchomienia:', report.launch_date);
      addField('Wykonawca:', report.contractor);
      addField('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : '');
      addField('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : '');
      addField('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : '');
      y += 5;
    }

    // Autokonsumpcja calculations
    if (report.annual_production_kwh && report.energy_exported_kwh) {
      const production = parseFloat(report.annual_production_kwh) || 0;
      const exported = parseFloat(report.energy_exported_kwh) || 0;
      const consumed = production - exported;
      const autoconsumptionRate = production > 0 ? ((consumed / production) * 100).toFixed(1) : 0;
      const energyFromGrid = parseFloat(report.energy_imported_kwh) || 0;
      const totalConsumption = consumed + energyFromGrid;
      const selfSufficiency = totalConsumption > 0 ? ((consumed / totalConsumption) * 100).toFixed(1) : 0;

      addSectionHeader('ANALIZA AUTOKONSUMPCJI');
      addField('Energia wyprodukowana:', `${production.toFixed(0)} kWh`);
      addField('Energia oddana do sieci:', `${exported.toFixed(0)} kWh`);
      addField('Energia zuzyta z instalacji PV:', `${consumed.toFixed(0)} kWh`);
      addField('Wspolczynnik autokonsumpcji:', `${autoconsumptionRate}%`);
      
      if (energyFromGrid > 0) {
        addField('Energia pobrana z sieci:', `${energyFromGrid.toFixed(0)} kWh`);
        addField('Calkowite zuzycie:', `${totalConsumption.toFixed(0)} kWh`);
        addField('Wspolczynnik samowystarczalnosci:', `${selfSufficiency}%`);
      }
      y += 5;

      // Wykres kolowy
      try {
        const chartConfig = {
          type: 'pie',
          data: {
            labels: ['Autokonsumpcja', 'Oddane do sieci'],
            datasets: [{
              data: [consumed.toFixed(0), exported.toFixed(0)],
              backgroundColor: ['rgb(34, 197, 94)', 'rgb(59, 130, 246)']
            }]
          },
          options: {
            plugins: {
              title: {
                display: true,
                text: 'Rozklad produkcji energii',
                font: { size: 16 }
              },
              legend: {
                position: 'bottom',
                labels: { font: { size: 12 } }
              }
            }
          }
        };
        const chartUrl = `https://quickchart.io/chart?width=400&height=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        const chartResponse = await fetch(chartUrl);
        if (chartResponse.ok) {
          const chartBuffer = await chartResponse.arrayBuffer();
          const bytes = new Uint8Array(chartBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const chartBase64 = btoa(binary);
          
          checkNewPage();
          const chartWidth = 120;
          const chartHeight = 90;
          doc.addImage(`data:image/png;base64,${chartBase64}`, 'PNG', margin, y, chartWidth, chartHeight);
          y += chartHeight + 10;
        }
      } catch (chartError) {
        console.error('Error adding chart:', chartError.message);
        // Kontynuuj generowanie PDF bez wykresu
      }
    }

    // Technical checks
    const checks = [
      { label: 'Ocena autokonsumpcji i bilansu z siecia:', value: report.autoconsumption_rating },
      { label: 'Wizualna kontrola paneli/modulow (pekniecia, zabrudzenia):', value: report.panels_condition },
      { label: 'Kontrola mocowan i konstrukcji nosnej:', value: report.mounting_condition },
      { label: 'Wizualne sprawdzenie przewodow DC/AC, polaczen MC4:', value: report.cables_condition },
      { label: 'Wizualny stan zabezpieczen: SPD, RCD, wylaczniki:', value: report.protection_condition },
      { label: 'Odczyt falownika: bledy, produkcja, komunikacja:', value: report.inverter_reading },
      { label: 'Wizualna kontrola uziemienia i ciaglosci przewodow ochronnych:', value: report.grounding_condition },
      { label: 'Ocena mozliwosci rozbudowy: miejsce, przylacze, ograniczenia:', value: report.expansion_possibilities },
      { label: 'Wstepna kalkulacja potencjalu modernizacji (kWh/rok):', value: report.modernization_potential },
      { label: 'Rekomendacje: serwis, czyszczenie, wymiana elementow krytycznych:', value: report.recommendations },
      { label: 'Dodatkowa rekomendacja:', value: report.additional_notes }
    ].filter(item => item.value);

    if (checks.length > 0) {
      addSectionHeader('KONTROLA TECHNICZNA');
      checks.forEach(item => addField(item.label, item.value));
      y += 5;
    }

    // Interview
    const interview = [
      { label: 'Jaki jest roczny koszt za energie elektryczna?', value: report.interview_annual_cost },
      { label: 'Ile osob zamieszkuje dom/mieszkanie?', value: report.interview_residents },
      { label: 'O ktorej godzinie domownicy wychodza do pracy/szkoly?', value: report.interview_work_schedule },
      { label: 'O ktorej godzinie zwykle wszyscy wracaja do domu?', value: report.interview_return_time },
      { label: 'Czy ktos jest w domu w godzinach 10:00-15:00?', value: report.interview_home_during_day },
      { label: 'O jakiej porze dnia zuzycie pradu jest najwieksze?', value: report.interview_peak_usage },
      { label: 'Kiedy najczesciej wlaczacie pralke, zmywarke i inne urzadzenia?', value: report.interview_appliance_usage },
      { label: 'Czym ogrzewana jest ciepla woda i kiedy najczesciej z niej korzystacie?', value: report.interview_water_heating },
      { label: 'Jaki sprzet elektryczny jest w domu?', value: report.interview_equipment },
      { label: 'Jakie plany zakupowe dotyczace urzadzen energochlonnych?', value: report.interview_purchase_plans }
    ].filter(item => item.value);

    if (interview.length > 0) {
      addSectionHeader('WYWIAD ENERGETYCZNY');
      interview.forEach(item => addField(item.label, item.value));
      y += 5;
    }

    // Signature
    if (report.client_signature) {
      checkNewPage();
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(normalize('PODPIS KLIENTA:'), margin, y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.text(normalize(report.client_signature), margin, y);
    }

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(`Strona ${i} z ${pageCount}`, pageWidth / 2, 287, { align: 'center' });
      doc.text('4-ECO Green Energy', pageWidth / 2, 292, { align: 'center' });
    }

    const pdfBuffer = doc.output('arraybuffer');

    const pdfBytes = new Uint8Array(pdfBuffer);
    let pdfBinary = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, i + chunkSize);
      pdfBinary += String.fromCharCode.apply(null, chunk);
    }
    const pdfBase64 = btoa(pdfBinary);
    const safeFilename = normalize(report.client_name || 'wizyta').replace(/[^a-zA-Z0-9_-]/g, '_');

    return Response.json({ 
      pdf: pdfBase64, 
      filename: `raport_${safeFilename}.pdf` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});