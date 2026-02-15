import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId, recipientEmail, recipientType } = await req.json();
    
    if (!reportId || !recipientEmail || !recipientType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const report = await base44.entities.VisitReport.get(reportId);
    
    const recipientName = recipientType === 'client' ? 'Szanowny Kliencie' : 'Szanowny Menadżerze';
    const subject = `Raport wizyty technicznej - ${report.client_name || 'Klient'}`;

    const addLine = (label, value) => {
      if (!value) return '';
      return `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#222;">${value}</td></tr>`;
    };

    const sectionHeader = (title) => {
      return `<tr><td colspan="2" style="padding:16px 0 8px 0;"><h3 style="margin:0;font-size:15px;color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:4px;">${title}</h3></td></tr>`;
    };

    // Dane klienta
    let clientSection = '';
    const clientLines = [
      addLine('Klient:', report.client_name),
      addLine('Adres:', report.client_address),
      addLine('Telefon:', report.client_phone),
      addLine('Rodzaj instalacji:', report.installation_types?.length ? report.installation_types.join(', ') : ''),
    ].filter(Boolean).join('\n');
    if (clientLines) {
      clientSection = sectionHeader('DANE KLIENTA') + clientLines;
    }

    // Dane instalacji
    let installSection = '';
    const installLines = [
      addLine('Data uruchomienia:', report.launch_date),
      addLine('Wykonawca:', report.contractor),
      addLine('Roczna produkcja:', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : ''),
      addLine('Energia pobrana (1.8.0):', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : ''),
      addLine('Energia oddana (2.8.0):', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : ''),
    ].filter(Boolean).join('\n');
    if (installLines) {
      installSection = sectionHeader('DANE INSTALACJI') + installLines;
    }

    // Autokonsumpcja
    let autoSection = '';
    if (report.annual_production_kwh && report.energy_exported_kwh) {
      const production = parseFloat(report.annual_production_kwh) || 0;
      const exported = parseFloat(report.energy_exported_kwh) || 0;
      const consumed = production - exported;
      const autoconsumptionRate = production > 0 ? ((consumed / production) * 100).toFixed(1) : 0;
      const energyFromGrid = parseFloat(report.energy_imported_kwh) || 0;
      const totalConsumption = consumed + energyFromGrid;
      const selfSufficiency = totalConsumption > 0 ? ((consumed / totalConsumption) * 100).toFixed(1) : 0;

      const autoLines = [
        addLine('Energia wyprodukowana:', `${production.toFixed(0)} kWh`),
        addLine('Energia oddana do sieci:', `${exported.toFixed(0)} kWh`),
        addLine('Energia zużyta z PV:', `${consumed.toFixed(0)} kWh`),
        addLine('Współczynnik autokonsumpcji:', `<strong>${autoconsumptionRate}%</strong>`),
        energyFromGrid > 0 ? addLine('Energia pobrana z sieci:', `${energyFromGrid.toFixed(0)} kWh`) : '',
        energyFromGrid > 0 ? addLine('Całkowite zużycie:', `${totalConsumption.toFixed(0)} kWh`) : '',
        energyFromGrid > 0 ? addLine('Współczynnik samowystarczalności:', `<strong>${selfSufficiency}%</strong>`) : '',
      ].filter(Boolean).join('\n');
      if (autoLines) {
        autoSection = sectionHeader('ANALIZA AUTOKONSUMPCJI') + autoLines;
      }
    }

    // Kontrola techniczna
    let techSection = '';
    const techLines = [
      addLine('Autokonsumpcja:', report.autoconsumption_rating),
      addLine('Stan paneli:', report.panels_condition),
      addLine('Mocowania:', report.mounting_condition),
      addLine('Przewody:', report.cables_condition),
      addLine('Zabezpieczenia:', report.protection_condition),
      addLine('Falownik:', report.inverter_reading),
      addLine('Uziemienie:', report.grounding_condition),
      addLine('Możliwości rozbudowy:', report.expansion_possibilities),
      addLine('Potencjał modernizacji:', report.modernization_potential),
      addLine('Rekomendacje:', report.recommendations),
      addLine('Dodatkowe uwagi:', report.additional_notes),
    ].filter(Boolean).join('\n');
    if (techLines) {
      techSection = sectionHeader('KONTROLA TECHNICZNA') + techLines;
    }

    // Wywiad
    let interviewSection = '';
    const interviewLines = [
      addLine('Roczny koszt energii:', report.interview_annual_cost),
      addLine('Liczba mieszkańców:', report.interview_residents),
      addLine('Wyjście do pracy/szkoły:', report.interview_work_schedule),
      addLine('Powrót do domu:', report.interview_return_time),
      addLine('Obecność w domu (10-15):', report.interview_home_during_day),
      addLine('Szczyt zużycia:', report.interview_peak_usage),
      addLine('Używanie urządzeń:', report.interview_appliance_usage),
      addLine('Ogrzewanie wody:', report.interview_water_heating),
      addLine('Sprzęt elektryczny:', report.interview_equipment),
      addLine('Plany zakupowe:', report.interview_purchase_plans),
    ].filter(Boolean).join('\n');
    if (interviewLines) {
      interviewSection = sectionHeader('WYWIAD Z KLIENTEM') + interviewLines;
    }

    const visitDateFormatted = report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'w dniu wizyty';

    const emailBody = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <div style="background:#16a34a;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:20px;">4-ECO Green Energy</h1>
    <p style="margin:4px 0 0;color:#bbf7d0;font-size:13px;">Raport wizyty technicznej</p>
  </div>
  
  <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">${recipientName},</p>
    <p style="margin:0 0 16px;">Przesyłam raport z wizyty technicznej przeprowadzonej <strong>${visitDateFormatted}</strong>.</p>
    
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${clientSection}
      ${installSection}
      ${autoSection}
      ${techSection}
      ${interviewSection}
    </table>

    ${report.client_signature ? `<p style="margin:16px 0 0;"><strong>Podpis klienta:</strong> <em>${report.client_signature}</em></p>` : ''}
    
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="margin:0;font-size:12px;color:#888;">
      Raport wygenerowany przez 4-ECO Green Energy<br/>
      Doradca techniczny: ${user.full_name || user.email}<br/>
      Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}
    </p>
  </div>
</div>`;

    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: subject,
      body: emailBody
    });

    return Response.json({ 
      success: true, 
      message: `Raport został wysłany na adres ${recipientEmail}` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});