import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { reportId, email } = await req.json();
    
    if (!reportId || !email) {
      return Response.json({ error: 'Missing reportId or email' }, { status: 400 });
    }

    // Generuj PDF
    const pdfResponse = await base44.asServiceRole.functions.invoke('generateReportPDF', { reportId });
    const pdfBase64 = pdfResponse.data.pdf;
    
    // Konwertuj base64 na binary
    const pdfBinary = atob(pdfBase64);
    const pdfBytes = new Uint8Array(pdfBinary.length);
    for (let i = 0; i < pdfBinary.length; i++) {
      pdfBytes[i] = pdfBinary.charCodeAt(i);
    }
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Upload PDF
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
      file: pdfBlob
    });
    const pdfUrl = uploadResponse.file_url;

    // Pobierz dane raportu
    const report = await base44.asServiceRole.entities.VisitReport.get(reportId);

    // Wyślij email z linkiem
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `Raport wizyty - ${report.client_name || 'Klient'}`,
      body: `Dzień dobry,

W załączniku raport z wizyty technicznej.

Klient: ${report.client_name}
Data wizyty: ${report.visit_date ? new Date(report.visit_date).toLocaleDateString('pl-PL') : 'brak daty'}

Link do pobrania PDF:
${pdfUrl}

Pozdrawiam,
4-ECO Green Energy`
    });

    return Response.json({ success: true, pdfUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});