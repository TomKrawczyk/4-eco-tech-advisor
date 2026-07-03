export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickFirstPhone(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const first = text.split(/[\n,;\/|]+/).map((part) => part.trim()).find(Boolean);
  return first || text;
}

export function normalizePhoneLast9(value) {
  return pickFirstPhone(value).replace(/\D/g, '').slice(-9);
}

export function normalizeDate(value) {
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

export function hasMeaningfulInterviewData(interviewData) {
  return !!interviewData && typeof interviewData === 'object' && Object.values(interviewData).some(hasMeaningfulValue);
}

export function hasMeaningfulComments(comments) {
  return String(comments || '').trim().length > 2;
}

export function detectRecordType(record) {
  const marker = String(record?.meeting_note || record?.status || '').trim().toLowerCase();
  if (marker === 'spotkanie' || String(record?.meeting_calendar || '').trim()) return 'meeting';
  if (marker.includes('kontakt') || marker.includes('telefon') || marker.includes('doradc') || marker === 'dws') return 'phone_contact';
  if (record?.contact_key || record?.contact_date || record?.contact_calendar) return 'phone_contact';
  return 'meeting';
}

function getReportEmail(report) {
  return normalizeEmail(report.author_email || report.created_by || report.email);
}

function clientMatches(record, indexedReport) {
  const recordPhone = normalizePhoneLast9(record.client_phone || record.phone);
  const reportPhone = indexedReport.client_phone;
  if (recordPhone && reportPhone) return recordPhone === reportPhone;

  const recordName = normalizeName(record.client_name);
  const reportName = indexedReport.client_name;
  if (!recordName || !reportName) return false;
  return recordName === reportName || recordName.startsWith(reportName) || reportName.startsWith(recordName);
}

function dateMatches(recordDate, reportDate) {
  if (!recordDate || !reportDate) return true;
  return reportDate === recordDate || reportDate >= recordDate;
}

function emailMatches(record, indexedReport) {
  const recordEmail = normalizeEmail(record.assigned_user_email || record.author_email || record.owner_email);
  return !recordEmail || !indexedReport.email || indexedReport.email === recordEmail;
}

export function buildMeetingReportsIndex(reports = []) {
  return reports.map((report) => ({
    id: report.id,
    email: getReportEmail(report),
    date: normalizeDate(report.meeting_date || report.visit_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: normalizePhoneLast9(report.client_phone || report.phone),
  }));
}

export function buildPhoneReportsIndex(reports = []) {
  return reports.map((report) => ({
    id: report.id,
    email: getReportEmail(report),
    date: normalizeDate(report.contact_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: normalizePhoneLast9(report.client_phone || report.phone),
    contact_key: String(report.contact_key || '').trim(),
  }));
}

export function hasInlineMeetingReportEvidence(record) {
  return hasMeaningfulInterviewData(record?.interview_data) || hasMeaningfulComments(record?.comments);
}

export function hasInlinePhoneReportEvidence(record) {
  return hasMeaningfulInterviewData(record?.interview_data) || hasMeaningfulComments(record?.comments);
}

export function hasSeparateMeetingReport(record, reportsIndex = []) {
  const recordDate = normalizeDate(record.meeting_date || record.meeting_calendar);
  return reportsIndex.some((report) => emailMatches(record, report) && clientMatches(record, report) && dateMatches(recordDate, report.date));
}

export function hasSeparatePhoneReport(record, reportsIndex = []) {
  const contactKey = String(record.contact_key || '').trim();
  const recordDate = normalizeDate(record.contact_date || record.contact_calendar || record.date);
  return reportsIndex.some((report) => {
    const contactKeyMatch = contactKey && report.contact_key && contactKey === report.contact_key;
    const clientMatch = clientMatches(record, report);
    return emailMatches(record, report) && (contactKeyMatch || clientMatch) && dateMatches(recordDate, report.date);
  });
}

export function hasReportForMeeting(record, reportsIndex = []) {
  return hasInlineMeetingReportEvidence(record) || hasSeparateMeetingReport(record, reportsIndex);
}

export function hasReportForPhoneContact(record, reportsIndex = []) {
  return hasInlinePhoneReportEvidence(record) || hasSeparatePhoneReport(record, reportsIndex);
}