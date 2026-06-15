import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function last9(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-9);
}

function localYMD(date) {
  if (!date) return '';
  const dt = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
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

function getMeetingTime(meetingCalendar) {
  if (!meetingCalendar || typeof meetingCalendar !== 'string') return '';
  const parts = meetingCalendar.split(' ');
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
    const upload = body?.upload === true;
    const filename = `klienci_do_obdzwonienia_${from}_${to}.csv`;
    const inRange = (date) => !!date && date >= from && date <= to;

    const svc = base44.asServiceRole.entities;
    const [groups, meetingAssignments, meetingReports] = await Promise.all([
      fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
    ]);

    const groupNameById = {};
    for (const group of groups) {
      groupNameById[group.id] = group.name || 'Bez struktury';
    }

    const reportByPhone = {};
    for (const report of meetingReports) {
      if (!inRange(report.meeting_date)) continue;
      const phone = last9(report.client_phone);
      if (phone) reportByPhone[phone] = report.status || '';
    }

    const rows = [];
    for (const assignment of meetingAssignments) {
      if (!inRange(assignment.meeting_date)) continue;

      const phoneLast9 = last9(assignment.client_phone);
      const reportStatus = phoneLast9 ? (reportByPhone[phoneLast9] || '') : '';
      const reported = !!reportStatus;
      const meetingDateTime = assignment.meeting_calendar || assignment.meeting_date || '';

      rows.push({
        struktura: assignment.assigned_group_name || (assignment.assigned_group_id ? (groupNameById[assignment.assigned_group_id] || 'Bez struktury') : 'Bez struktury'),
        klient: assignment.client_name || '',
        telefon: assignment.client_phone || '',
        telefon_last9: phoneLast9,
        data: assignment.meeting_date || '',
        godzina: getMeetingTime(assignment.meeting_calendar || ''),
        data_godzina: meetingDateTime,
        doradca: assignment.assigned_user_name || '',
        doradca_email: assignment.assigned_user_email || '',
        adres: assignment.client_address || '',
        status_raportu: reportStatus,
        czy_zaraportowano: reported ? 'TAK' : 'NIE',
        do_obdzwonienia: reported ? 'NIE' : 'TAK',
      });
    }

    rows.sort((a, b) => {
      if (a.do_obdzwonienia !== b.do_obdzwonienia) {
        return a.do_obdzwonienia === 'TAK' ? -1 : 1;
      }
      return String(a.data_godzina).localeCompare(String(b.data_godzina));
    });

    const header = 'struktura;klient;telefon;telefon_last9;data;godzina;data_godzina;doradca;doradca_email;adres;status_raportu;czy_zaraportowano;do_obdzwonienia';
    const lines = rows.map((row) => ([
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