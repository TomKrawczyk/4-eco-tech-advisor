import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function firstPhoneLast9(phone) {
  const firstPart = String(phone || '').split(',')[0] || '';
  return firstPart.replace(/\D/g, '').slice(-9);
}

function dedupeKey(record) {
  const meetingKey = String(record.meeting_key || '').trim();
  if (meetingKey) return meetingKey;
  const phoneLast9 = firstPhoneLast9(record.client_phone);
  const datePart = record.meeting_calendar || record.meeting_date || '';
  return `${phoneLast9}__${datePart}`;
}

function richnessScore(record) {
  let score = 0;
  if (String(record.assigned_user_email || '').trim()) score += 1;
  if (String(record.assigned_group_name || '').trim()) score += 1;
  return score;
}

function createdAtMs(record) {
  const value = record.created_date ? new Date(record.created_date).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function pickKeepRecord(records) {
  const sorted = [...records].sort((a, b) => {
    const scoreDiff = richnessScore(b) - richnessScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return createdAtMs(a) - createdAtMs(b);
  });
  return sorted[0];
}

async function fetchAll(entity) {
  const items = [];
  const limit = 500;
  let skip = 0;

  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
  }

  return items;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_) {}

    const apply = body?.apply === true;
    const entity = base44.asServiceRole.entities.MeetingAssignment;
    const records = await fetchAll(entity);

    const groupsMap = new Map();
    for (const record of records) {
      const key = dedupeKey(record);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(record);
    }

    const duplicateGroups = [];
    const deleteQueue = [];

    for (const [key, group] of groupsMap.entries()) {
      if (group.length <= 1) continue;
      const keep = pickKeepRecord(group);
      const toDelete = group.filter((record) => record.id !== keep.id);
      duplicateGroups.push({ key, keep, toDelete });
      deleteQueue.push(...toDelete.map((record) => ({ key, record, keep })));
    }

    if (!apply) {
      return Response.json({
        apply: false,
        total_records: records.length,
        duplicate_groups: duplicateGroups.length,
        records_to_delete: deleteQueue.length,
        samples: duplicateGroups.slice(0, 15).map((group) => ({
          key: group.key,
          keep: {
            id: group.keep.id,
            client_name: group.keep.client_name || '',
            client_phone: group.keep.client_phone || '',
            advisor: group.keep.assigned_user_email || '',
            group: group.keep.assigned_group_name || '',
          },
          delete: group.toDelete.map((record) => ({
            id: record.id,
            client_name: record.client_name || '',
            advisor: record.assigned_user_email || '',
            group: record.assigned_group_name || '',
          })),
        })),
      });
    }

    let deleted = 0;
    let failed = 0;

    for (const item of deleteQueue) {
      try {
        await entity.delete(item.record.id);
        deleted += 1;
      } catch (_) {
        failed += 1;
      }
    }

    return Response.json({
      apply: true,
      deleted,
      failed,
      duplicate_groups: duplicateGroups.length,
      remaining_estimate: records.length - deleted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});