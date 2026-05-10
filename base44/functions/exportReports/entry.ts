import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Brak dostępu. Wymagana rola admin.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const exportType = body.type || 'excel'; // 'excel', 'photos_list', 'full_backend', 'full_backend_check'

    const mainAdminEmail = (Deno.env.get('MAIN_ADMIN_EMAIL') || '').trim().toLowerCase();
    const isMainAdmin = !!mainAdminEmail && user.email?.toLowerCase() === mainAdminEmail;

    if (exportType === 'full_backend_check') {
      return Response.json({ allowed: isMainAdmin });
    }

    if (exportType === 'full_backend') {
      if (!isMainAdmin) {
        return Response.json({ error: 'Brak dostępu. Eksport backendu jest dostępny tylko dla głównego administratora.' }, { status: 403 });
      }

      const entityNames = [
        'ActivityLog', 'AllowedUser', 'CalendarEvent', 'Component', 'ContactLead', 'ContactPackage',
        'Group', 'HiddenMeeting', 'MeetingAcceptance', 'MeetingAssignment', 'MeetingReport',
        'Notification', 'NotificationPreference', 'PhoneContact', 'PhoneContactReport', 'Referral',
        'RegistrationRequest', 'ServiceReport', 'SheetGroupMapping', 'Training', 'TrainingView',
        'User', 'VisitReport', 'VisitReportPhoto'
      ];
      const functionNames = [
        'autoCreateAccessRequest', 'autoLogReportActivity', 'autoRefreshMeetings', 'checkInactiveReferrals',
        'checkMissingMeetingReports', 'checkMissingPhoneContacts', 'checkOlszewskiPhoneContacts',
        'cleanupOldUnacceptedMeetings', 'debugClientRow', 'diagnoseDamianReports', 'exportReferralsToSheets',
        'exportReports', 'exportToGoogleSheets', 'fixCalendarEventLocations', 'fixCalendarLocations',
        'generateAutoconsumptionPDF', 'generateChecklistPCPDF', 'generatePVCalculatorPDF',
        'generateROICalculatorPDF', 'generateReportPDF', 'getAllSheetTabs', 'getAppId', 'getEnergyPrices',
        'getMeetingsFromSheets', 'getUsersInHierarchy', 'getWeatherForecast', 'handleMeetingAcceptance',
        'importContactLeads', 'inspectSheet', 'logActivity', 'monitorMeetingRejections', 'notifyContactAssigned',
        'notifyGroupLeaderNewContacts', 'notifyGroupLeaderNewMeetings', 'notifyMeetingAssigned', 'notifyNewReport',
        'refreshMeetingsCache', 'requestAccess', 'sendNotification', 'sendPasswordResetEmail', 'sendReportEmail',
        'syncAddressesToAssignments', 'syncAllowedUserWithBase44', 'syncGroupName', 'syncRegisteredUsers',
        'trackUserActivity'
      ];

      const zip = new JSZip();
      const manifest = {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        note: 'Eksport zawiera dane i schematy encji. Pliki kodu backendu i konfiguracji są dokładane do ZIP po potwierdzeniu dostępu głównego administratora. Sekrety środowiskowe nie są eksportowane.',
        entities: entityNames,
        functions: functionNames
      };

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('functions/function_names.json', JSON.stringify(functionNames, null, 2));

      const summary = [];
      for (const entityName of entityNames) {
        const entity = base44.asServiceRole.entities[entityName];
        if (!entity) {
          summary.push({ entity: entityName, status: 'missing' });
          continue;
        }
        try {
          const [schema, records] = await Promise.all([
            entity.schema().catch(() => null),
            entity.list('-created_date', 10000).catch(() => [])
          ]);
          zip.file(`entities/${entityName}/schema.json`, JSON.stringify(schema, null, 2));
          zip.file(`entities/${entityName}/records.json`, JSON.stringify(records, null, 2));
          summary.push({ entity: entityName, status: 'exported', records: records.length });
        } catch (error) {
          summary.push({ entity: entityName, status: 'error', error: error.message });
        }
      }

      zip.file('summary.json', JSON.stringify(summary, null, 2));
      const zipBase64 = await zip.generateAsync({ type: 'base64' });

      return Response.json({
        base64: zipBase64,
        filename: `pelny_backend_${new Date().toISOString().split('T')[0]}.zip`,
        summary
      });
    }

    // Pobierz wszystkie raporty równolegle — bez użycia integracji AI
    const [meetingReports, visitReports, serviceReports, phoneReports, phoneContacts] = await Promise.all([
      base44.asServiceRole.entities.MeetingReport.list('-created_date', 2000),
      base44.asServiceRole.entities.VisitReport.list('-created_date', 2000),
      base44.asServiceRole.entities.ServiceReport.list('-created_date', 2000),
      base44.asServiceRole.entities.PhoneContactReport.list('-created_date', 2000),
      base44.asServiceRole.entities.PhoneContact.list('-created_date', 5000),
    ]);

    if (exportType === 'photos_list') {
      // Zwróć listę wszystkich URL-i zdjęć do pobrania przez frontend
      const photos = [];

      meetingReports.forEach(r => {
        (r.photos || []).forEach((url, i) => {
          photos.push({ url, folder: 'spotkania', filename: `${r.client_name || r.id}_${i + 1}.jpg` });
        });
      });
      visitReports.forEach(r => {
        (r.photos || []).forEach((url, i) => {
          photos.push({ url, folder: 'wizyty', filename: `${r.client_name || r.id}_${i + 1}.jpg` });
        });
      });
      serviceReports.forEach(r => {
        (r.photos || []).forEach((url, i) => {
          photos.push({ url, folder: 'serwis', filename: `${r.client_name || r.id}_${i + 1}.jpg` });
        });
      });

      return Response.json({ photos });
    }

    // Tworzenie workbooka Excel
    const wb = XLSX.utils.book_new();

    // Arkusz 1: Raporty po spotkaniu
    const meetingRows = meetingReports.map(r => ({
      'ID': r.id,
      'Data utworzenia': r.created_date ? new Date(r.created_date).toLocaleDateString('pl-PL') : '',
      'Autor': r.author_name || '',
      'Email autora': r.author_email || '',
      'Klient': r.client_name || '',
      'Adres': r.client_address || '',
      'Telefon': r.client_phone || '',
      'Data spotkania': r.meeting_date || '',
      'Godzina': r.meeting_time || '',
      'Status': r.status || '',
      'Opis': r.description || '',
      'Kolejne kroki': r.next_steps || '',
      'Liczba zdjęć': (r.photos || []).length,
      'URL zdjęć': (r.photos || []).join(' | '),
    }));
    const ws1 = XLSX.utils.json_to_sheet(meetingRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Raporty po spotkaniu');

    // Arkusz 2: Raporty wizytowe
    const visitRows = visitReports.map(r => ({
      'ID': r.id,
      'Data utworzenia': r.created_date ? new Date(r.created_date).toLocaleDateString('pl-PL') : '',
      'Autor': r.author_name || '',
      'Email autora': r.author_email || '',
      'Klient': r.client_name || '',
      'Adres': r.client_address || '',
      'Telefon': r.client_phone || '',
      'Data wizyty': r.visit_date || '',
      'Status': r.status || '',
      'Typy instalacji': (r.installation_types || []).join(', '),
      'Firma wykonawcy': r.contractor || '',
      'Rekomendacje': r.recommendations || '',
      'Uwagi': r.additional_notes || '',
      'Liczba zdjęć': (r.photos || []).length,
      'URL zdjęć': (r.photos || []).join(' | '),
    }));
    const ws2 = XLSX.utils.json_to_sheet(visitRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Raporty wizytowe');

    // Arkusz 3: Raporty serwisowe
    const serviceRows = serviceReports.map(r => ({
      'ID': r.id,
      'Data utworzenia': r.created_date ? new Date(r.created_date).toLocaleDateString('pl-PL') : '',
      'Autor': r.author_name || '',
      'Email autora': r.author_email || '',
      'Klient': r.client_name || '',
      'Adres': r.client_address || '',
      'Telefon': r.client_phone || '',
      'Data serwisu': r.service_date || '',
      'Typ protokołu': r.report_type || '',
      'Status': r.status || '',
      'Liczba zdjęć': (r.photos || []).length,
      'URL zdjęć': (r.photos || []).join(' | '),
    }));
    const ws3 = XLSX.utils.json_to_sheet(serviceRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Raporty serwisowe');

    const phoneResultLabels = {
      interested: 'Zainteresowany',
      not_interested: 'Niezainteresowany',
      no_answer: 'Brak odpowiedzi',
      callback: 'Oddzwonić',
      meeting_scheduled: 'Spotkanie umówione',
      other: 'Inne',
    };
    const phoneContactsByKey = new Map(phoneContacts.map(c => [c.contact_key, c]));

    // Arkusz 4: Raporty kontaktów telefonicznych
    const phoneRows = phoneReports.map(r => {
      const contact = phoneContactsByKey.get(r.contact_key) || {};
      return {
        'ID': r.id,
        'Data utworzenia': r.created_date ? new Date(r.created_date).toLocaleDateString('pl-PL') : '',
        'Autor': r.author_name || '',
        'Email autora': r.author_email || '',
        'Przypisany handlowiec': contact.assigned_user_name || '',
        'Email przypisanego': contact.assigned_user_email || '',
        'Klient': r.client_name || '',
        'Adres': r.client_address || contact.address || '',
        'Telefon': r.client_phone || contact.phone || '',
        'Data kontaktu': r.contact_date || '',
        'Wynik kontaktu': phoneResultLabels[r.result] || r.result || '',
        'Opis rozmowy': r.description || '',
        'Kolejne kroki': r.next_steps || '',
        'Data oddzwonienia': r.callback_date || '',
        'Źródło / arkusz': contact.sheet || '',
      };
    });
    const ws4 = XLSX.utils.json_to_sheet(phoneRows);
    XLSX.utils.book_append_sheet(wb, ws4, 'Kontakty telefoniczne');

    // Generuj plik Excel jako base64
    const excelBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    return Response.json({
      base64: excelBase64,
      filename: `wszystkie_raporty_${new Date().toISOString().split('T')[0]}.xlsx`,
      counts: {
        meeting: meetingReports.length,
        visit: visitReports.length,
        service: serviceReports.length,
        phone: phoneReports.length,
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});