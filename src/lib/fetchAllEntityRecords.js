export async function fetchAllEntityRecords(entity, sort = "-created_date", pageSize = 500) {
  const results = [];
  const seenIds = new Set();
  let skip = 0;

  while (true) {
    const batch = await entity.list(sort, pageSize, skip);
    if (!batch?.length) break;

    const freshBatch = batch.filter((record) => {
      if (!record?.id || seenIds.has(record.id)) return false;
      seenIds.add(record.id);
      return true;
    });

    results.push(...freshBatch);

    if (batch.length < pageSize || freshBatch.length === 0) break;
    skip += pageSize;
  }

  return results;
}