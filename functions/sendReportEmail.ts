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
    
    const emailBody = `
${recipientName},

Przesyłam raport z wizyty technicznej przeprowadzonej ${report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'w dniu wizyty'}.

=== DANE KLIENTA ===
${report.client_name ? `Klient: ${report.client_name}` : ''}
${report.client_address ? `Adres: ${report.client_address}` : ''}
${report.client_phone ? `Telefon: ${report.client_phone}` : ''}
${report.installation_types?.length ? `Rodzaj instalacji: ${report.installation_types.join(', ')}` : ''}

=== DANE INSTALACJI ===
${report.launch_date ? `Data uruchomienia: ${report.launch_date}` : ''}
${report.contractor ? `Wykonawca: ${report.contractor}` : ''}
${report.annual_production_kwh ? `Roczna produkcja: ${report.annual_production_kwh} kWh` : ''}
${report.energy_imported_kwh ? `Energia pobrana (1.8.0): ${report.energy_imported_kwh} kWh` : ''}
${report.energy_exported_kwh ? `Energia oddana (2.8.0): ${report.energy_exported_kwh} kWh` : ''}

=== KONTROLA TECHNICZNA ===
${report.autoconsumption_rating ? `Autokonsumpcja: ${report.autoconsumption_rating}` : ''}
${report.panels_condition ? `Stan paneli: ${report.panels_condition}` : ''}
${report.mounting_condition ? `Mocowania: ${report.mounting_condition}` : ''}
${report.cables_condition ? `Przewody: ${report.cables_condition}` : ''}
${report.protection_condition ? `Zabezpieczenia: ${report.protection_condition}` : ''}
${report.inverter_reading ? `Falownik: ${report.inverter_reading}` : ''}
${report.grounding_condition ? `Uziemienie: ${report.grounding_condition}` : ''}
${report.expansion_possibilities ? `Możliwości rozbudowy: ${report.expansion_possibilities}` : ''}
${report.modernization_potential ? `Potencjał modernizacji: ${report.modernization_potential}` : ''}
${report.recommendations ? `Rekomendacje: ${report.recommendations}` : ''}
${report.additional_notes ? `Dodatkowe uwagi: ${report.additional_notes}` : ''}

=== WYWIAD Z KLIENTEM ===
${report.interview_annual_cost ? `Roczny koszt energii: ${report.interview_annual_cost}` : ''}
${report.interview_residents ? `Liczba mieszkańców: ${report.interview_residents}` : ''}
${report.interview_work_schedule ? `Wyjście do pracy/szkoły: ${report.interview_work_schedule}` : ''}
${report.interview_return_time ? `Powrót do domu: ${report.interview_return_time}` : ''}
${report.interview_home_during_day ? `Obecność w domu (10-15): ${report.interview_home_during_day}` : ''}
${report.interview_peak_usage ? `Szczyt zużycia: ${report.interview_peak_usage}` : ''}
${report.interview_appliance_usage ? `Używanie urządzeń: ${report.interview_appliance_usage}` : ''}
${report.interview_water_heating ? `Ogrzewanie wody: ${report.interview_water_heating}` : ''}
${report.interview_equipment ? `Sprzęt elektryczny: ${report.interview_equipment}` : ''}
${report.interview_purchase_plans ? `Plany zakupowe: ${report.interview_purchase_plans}` : ''}

${report.client_signature ? `Podpis klienta: ${report.client_signature}` : ''}

---
Raport wygenerowany przez 4-ECO Green Energy
Doradca techniczny: ${user.full_name || user.email}
Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}
`;

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