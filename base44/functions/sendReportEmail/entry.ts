import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const row = (label, value) => value
  ? `<tr>
      <td style="padding: 8px 12px; color: #6b7280; font-size: 14px; white-space: nowrap; width: 45%; vertical-align: top;">${label}</td>
      <td style="padding: 8px 12px; color: #1f2937; font-size: 14px; vertical-align: top;">${value}</td>
    </tr>`
  : '';

const section = (title, rows) => {
  const content = rows.filter(Boolean).join('');
  if (!content) return '';
  return `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #166534; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 2px solid #22c55e;">
        ${title}
      </h3>
      <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;">
        <tbody>${content}</tbody>
      </table>
    </div>
  `;
};

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
    const visitDate = report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'Nie podano';
    const authorName = report.author_name || user.full_name || user.email;
    const authorEmail = report.author_email || user.email;
    const subject = `Raport wizyty technicznej – ${report.client_name || 'Klient'} (${visitDate})`;

    const clientSection = section('Dane klienta', [
      row('Klient', report.client_name),
      row('Adres', report.client_address),
      row('Telefon', report.client_phone),
      row('Rodzaj instalacji', report.installation_types?.join(', ')),
    ]);

    const installationSection = section('Dane instalacji', [
      row('Data uruchomienia', report.launch_date),
      row('Wykonawca', report.contractor),
      row('Roczna produkcja', report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : null),
      row('Energia pobrana (1.8.0)', report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : null),
      row('Energia oddana (2.8.0)', report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : null),
    ]);

    const technicalSection = section('Kontrola techniczna', [
      row('Autokonsumpcja', report.autoconsumption_rating),
      row('Stan paneli', report.panels_condition),
      row('Mocowania', report.mounting_condition),
      row('Przewody DC/AC', report.cables_condition),
      row('Zabezpieczenia', report.protection_condition),
      row('Falownik', report.inverter_reading),
      row('Uziemienie', report.grounding_condition),
      row('Możliwości rozbudowy', report.expansion_possibilities),
      row('Potencjał modernizacji', report.modernization_potential),
      row('Rekomendacje', report.recommendations),
      row('Dodatkowe uwagi', report.additional_notes),
    ]);

    const interviewSection = section('Wywiad z klientem', [
      row('Roczny koszt energii', report.interview_annual_cost),
      row('Liczba mieszkańców', report.interview_residents),
      row('Wyjście do pracy/szkoły', report.interview_work_schedule),
      row('Powrót do domu', report.interview_return_time),
      row('Obecność w domu (10–15)', report.interview_home_during_day),
      row('Szczyt zużycia', report.interview_peak_usage),
      row('Używanie urządzeń', report.interview_appliance_usage),
      row('Ogrzewanie wody', report.interview_water_heating),
      row('Sprzęt elektryczny', report.interview_equipment),
      row('Plany zakupowe', report.interview_purchase_plans),
    ]);

    const greeting = recipientType === 'client' ? 'Szanowny Kliencie' : 'Szanowny Menadżerze';

    const body = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">4-ECO Green Energy</h1>
    <p style="color: #dcfce7; margin: 6px 0 0 0; font-size: 14px;">Raport wizyty technicznej</p>
  </div>

  <div style="padding: 32px 30px; background: #f9fafb;">
    <p style="color: #1f2937; font-size: 15px; margin: 0 0 6px 0;">${greeting},</p>
    <p style="color: #4b5563; line-height: 1.7; margin: 0 0 24px 0;">
      Przesyłam raport z wizyty technicznej przeprowadzonej <strong>${visitDate}</strong>.
    </p>

    ${clientSection}
    ${installationSection}
    ${technicalSection}
    ${interviewSection}

    ${report.client_signature ? `
    <div style="margin-top: 20px; padding: 14px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
      <p style="margin: 0; color: #14532d; font-size: 14px;"><strong>Podpis klienta:</strong> ${report.client_signature}</p>
    </div>` : ''}
  </div>

  <div style="padding: 20px 30px; background: #1f2937; color: #d1d5db; font-size: 13px; line-height: 1.6;">
    <p style="margin: 0 0 4px 0; font-weight: bold; color: #ffffff;">Doradca techniczny</p>
    <p style="margin: 0 0 2px 0;">${authorName}</p>
    <p style="margin: 0 0 10px 0; color: #9ca3af;">${authorEmail}</p>
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      Raport wygenerowany ${new Date().toLocaleDateString('pl-PL')} przez aplikację 4-ECO Green Energy
    </p>
  </div>
</div>
    `;

    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body,
    });

    return Response.json({
      success: true,
      message: `Raport został wysłany na adres ${recipientEmail}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});