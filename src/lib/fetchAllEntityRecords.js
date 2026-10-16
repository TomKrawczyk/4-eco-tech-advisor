// Pobiera wszystkie rekordy encji przy użyciu paginacji kursorowej.
// Poprzednia wersja używała skip-based pagination, która w SDK Base44 nie jest
// obsługiwana — zwracała pierwszą stronę w pętli i urywała dane po ~pageSize.
export async function fetchAllEntityRecords(entity, sort = "-created_date", pageSize = 500) {
  const results = [];
  const seenIds = new Set();
  let cursor = undefined;

  while (true) {
    const page = await entity.filter({}, { sort, limit: pageSize, cursor });
    const items = Array.isArray(page) ? page : page.items || [];
    if (!items.length) break;

    for (const record of items) {
      if (record?.id && !seenIds.has(record.id)) {
        seenIds.add(record.id);
        results.push(record);
      }
    }

    if (Array.isArray(page)) break; // stara forma tablicowa — jedna strona
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }

  return results;
}