import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function pickFirstPhone(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const first = text.split(/[\n,;\/|]+/).map((part) => part.trim()).find(Boolean);
  return first || text;
}

function last9(value) {
  return pickFirstPhone(value).replace(/\D/g, '').slice(-9);
}

function localYMD(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const plMatch = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (plMatch) {
      const day = plMatch[1].padStart(2, '0');
      const month = plMatch[2].padStart(2, '0');
      return `${plMatch[3]}-${month}-${day}`;
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function getContactDate(record) {
  return record.contact_date || localYMD(record.contact_calendar) || localYMD(record.date) || '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function dateMatches(recordDate, reportDate) {
  if (!recordDate || !reportDate) return true;
  return reportDate === recordDate;
}

function clientMatches(record, indexedReport) {
  const recordPhone = last9(record.client_phone || record.phone);
  const reportPhone = indexedReport.client_phone;
  if (recordPhone && reportPhone) return recordPhone === reportPhone;

  const recordName = normalizeName(record.client_name);
  const reportName = indexedReport.client_name;
  if (!recordName || !reportName) return false;
  return recordName === reportName || recordName.startsWith(reportName) || reportName.startsWith(recordName);
}

function emailMatches(record, indexedReport) {
  const recordEmail = normalizeEmail(record.assigned_user_email || record.author_email || record.owner_email);
  return !recordEmail || !indexedReport.email || indexedReport.email === recordEmail;
}

function buildMeetingReportsIndex(reports) {
  return reports.map((report) => ({
    email: normalizeEmail(report.author_email || report.created_by || report.email),
    date: localYMD(report.meeting_date || report.visit_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
    status: normalizeKey(report.status).toLowerCase() || 'reported',
  }));
}

function buildPhoneReportsIndex(reports) {
  return reports.map((report) => ({
    email: normalizeEmail(report.author_email || report.created_by || report.email),
    date: localYMD(report.contact_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
    contact_key: normalizeKey(report.contact_key),
    status: normalizeKey(report.result).toLowerCase() || 'reported',
  }));
}

function findMeetingReport(record, reportsIndex) {
  const recordDate = record.meeting_date || localYMD(record.meeting_calendar) || '';
  return reportsIndex.find((report) => emailMatches(record, report) && clientMatches(record, report) && dateMatches(recordDate, report.date));
}

function findPhoneReport(record, reportsIndex) {
  const contactKey = normalizeKey(record.contact_key);
  const recordDate = getContactDate(record);
  return reportsIndex.find((report) => {
    const contactKeyMatch = contactKey && report.contact_key && contactKey === report.contact_key;
    return emailMatches(record, report) && (contactKeyMatch || clientMatches(record, report)) && dateMatches(recordDate, report.date);
  });
}

function prevWeek() {
  const now = new Date();
  const base = new Date(`${localYMD(now)}T12:00:00Z`);
  const dow = (base.getUTCDay() + 6) % 7;
  const thisMon = new Date(base);
  thisMon.setUTCDate(base.getUTCDate() - dow);
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  return { from: localYMD(lastMon), to: localYMD(lastSun) };
}

async function fetchAll(entity) {
  const out = [];
  let skip = 0;
  const limit = 500;

  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 50000) break;
  }

  return out;
}

function csvValue(value) {
  const safe = String(value ?? '').replace(/"/g, '""');
  return `"${safe}"`;
}

function getTimePart(value) {
  if (!value || typeof value !== 'string') return '';
  const parts = value.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_) {}

    const pw = prevWeek();
    const from = body?.from || pw.from;
    const to = body?.to || pw.to;
    const format = body?.format || 'csv';
    const upload = body?.upload === true;
    const filename = `klienci_do_obdzwonienia_${from}_${to}.csv`;
    const inRange = (date) => !!date && date >= from && date <= to;

    const svc = base44.asServiceRole.entities;
    const [groups, meetingAssignments, meetingReports, visitReports, phoneContacts, phoneReports] = await Promise.all([
      fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
      fetchAll(svc.VisitReport),
      fetchAll(svc.PhoneContact),
      fetchAll(svc.PhoneContactReport),
    ]);

    const groupNameById = {};
    for (const group of groups) {
      groupNameById[group.id] = group.name || 'Bez struktury';
    }

    const meetingReportsIndex = buildMeetingReportsIndex([...meetingReports, ...visitReports]);
    const phoneReportsIndex = buildPhoneReportsIndex(phoneReports);

    const rows = [];

    for (const assignment of meetingAssignments) {
      if (!inRange(assignment.meeting_date)) continue;
      const phoneLast9 = last9(assignment.client_phone);
      const matchedReport = findMeetingReport(assignment, meetingReportsIndex);
      const reportStatus = matchedReport?.status || '';
      const reported = !!matchedReport;
      const dateTime = assignment.meeting_calendar || assignment.meeting_date || '';

      rows.push({
        typ: 'SPOTKANIE',
        struktura: assignment.assigned_group_name || (assignment.assigned_group_id ? (groupNameById[assignment.assigned_group_id] || 'Bez struktury') : 'Bez struktury'),
        klient: assignment.client_name || '',
        telefon: assignment.client_phone || '',
        telefon_last9: phoneLast9,
        data: assignment.meeting_date || '',
        godzina: getTimePart(assignment.meeting_calendar || ''),
        data_godzina: dateTime,
        doradca: assignment.assigned_user_name || '',
        doradca_email: assignment.assigned_user_email || '',
        adres: assignment.client_address || '',
        status_raportu: reportStatus,
        czy_zaraportowano: reported ? 'TAK' : 'NIE',
        do_obdzwonienia: reported ? 'NIE' : 'TAK',
      });
    }

    for (const contact of phoneContacts) {
      const contactDate = getContactDate(contact);
      if (!inRange(contactDate) || contact.is_archived === true) continue;
      const phoneLast9 = last9(contact.phone);
      const matchedReport = findPhoneReport(contact, phoneReportsIndex);
      const reportStatus = matchedReport?.status || '';
      const reported = !!matchedReport;
      const dateTime = contact.contact_calendar || contactDate || '';

      rows.push({
        typ: 'TELEFON',
        struktura: contact.assigned_group_name || (contact.assigned_group_id ? (groupNameById[contact.assigned_group_id] || 'Bez struktury') : 'Bez struktury'),
        klient: contact.client_name || '',
        telefon: contact.phone || '',
        telefon_last9: phoneLast9,
        data: contactDate,
        godzina: getTimePart(contact.contact_calendar || ''),
        data_godzina: dateTime,
        doradca: contact.assigned_user_name || '',
        doradca_email: contact.assigned_user_email || '',
        adres: contact.address || '',
        status_raportu: reportStatus,
        czy_zaraportowano: reported ? 'TAK' : 'NIE',
        do_obdzwonienia: reported ? 'NIE' : 'TAK',
      });
    }

    rows.sort((a, b) => {
      if (a.do_obdzwonienia !== b.do_obdzwonienia) {
        return a.do_obdzwonienia === 'TAK' ? -1 : 1;
      }
      if (a.typ !== b.typ) {
        return String(a.typ).localeCompare(String(b.typ));
      }
      if (a.data !== b.data) {
        return String(a.data).localeCompare(String(b.data));
      }
      return String(a.data_godzina).localeCompare(String(b.data_godzina));
    });

    const header = 'typ;struktura;klient;telefon;telefon_last9;data;godzina;data_godzina;doradca;doradca_email;adres;status_raportu;czy_zaraportowano;do_obdzwonienia';
    const lines = rows.map((row) => ([
      row.typ,
      row.struktura,
      row.klient,
      row.telefon,
      row.telefon_last9,
      row.data,
      row.godzina,
      row.data_godzina,
      row.doradca,
      row.doradca_email,
      row.adres,
      row.status_raportu,
      row.czy_zaraportowano,
      row.do_obdzwonienia,
    ].map(csvValue).join(';')));

    const csv = `\uFEFF${header}\n${lines.join('\n')}`;

    if (format === 'json') {
      return Response.json(rows);
    }

    if (upload) {
      const file = new File([csv], filename, { type: 'text/csv; charset=utf-8' });
      const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      return Response.json({
        url: uploaded.file_url,
        rows: rows.length,
        to_call: rows.filter((row) => row.do_obdzwonienia === 'TAK').length,
      });
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500 });
  }
});