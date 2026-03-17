/**
 * Offline Sync Library
 * - Caches entity data in localStorage
 * - Queues write operations when offline
 * - Auto-syncs when back online
 */

const CACHE_PREFIX = "4eco_cache_";
const QUEUE_KEY = "4eco_offline_queue";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// ---- Cache helpers ----

export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// ---- Offline queue ----

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function enqueue(operation) {
  const queue = getQueue();
  queue.push({ ...operation, id: Date.now() + Math.random(), ts: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeFromQueue(opId) {
  const queue = getQueue().filter(op => op.id !== opId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ---- Online status ----

export function isOnline() {
  return navigator.onLine;
}

/**
 * Sync queued offline operations to the server.
 * Returns { synced, failed }
 */
export async function syncQueue(entityMap) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const op of queue) {
    const entity = entityMap[op.entity];
    if (!entity) { remaining.push(op); continue; }

    try {
      if (op.type === "create") {
        await entity.create(op.data);
      } else if (op.type === "update") {
        await entity.update(op.id, op.data);
      } else if (op.type === "delete") {
        await entity.delete(op.id);
      }
      synced++;
    } catch (e) {
      console.error("Sync failed for op:", op, e);
      failed++;
      remaining.push(op);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}

/**
 * Smart list: fetch from server (and cache), or return cache if offline.
 */
function getUserCachePrefix() {
  try {
    // Użyj email z sessionStorage (layout zapisuje user tam)
    const cached = sessionStorage.getItem('layout_user_cache');
    if (cached) {
      const { data } = JSON.parse(cached);
      return data?.user?.email || "anon";
    }
  } catch (_) {}
  return "anon";
}

export async function smartList(entity, entityName, filterOrSort, limit = 200) {
  const userPrefix = getUserCachePrefix();
  const cacheKey = userPrefix + "_" + entityName + "_" + JSON.stringify(filterOrSort);
  if (isOnline()) {
    try {
      let data;
      if (filterOrSort && typeof filterOrSort === "object" && !Array.isArray(filterOrSort)) {
        data = await entity.filter(filterOrSort, "-created_date", limit);
      } else {
        data = await entity.list(filterOrSort || "-created_date", limit);
      }
      cacheSet(cacheKey, data);
      return data;
    } catch (e) {
      // fall through to cache
    }
  }
  return cacheGet(cacheKey) || [];
}

/**
 * Smart create: create on server if online, else queue.
 */
export async function smartCreate(entity, entityName, data, currentUser) {
  if (isOnline()) {
    const result = await entity.create(data);
    // Invalidate cache
    invalidateCacheFor(entityName);
    return result;
  }

  const tempId = "offline_" + Date.now();
  const record = {
    ...data,
    id: tempId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    created_by: currentUser?.email || "",
    _offline: true,
  };
  enqueue({ type: "create", entity: entityName, data, tempId });
  // Optimistically add to cache
  addToCacheList(entityName, record);
  return record;
}

/**
 * Smart update: update on server if online, else queue.
 */
export async function smartUpdate(entity, entityName, id, data) {
  if (isOnline()) {
    const result = await entity.update(id, data);
    invalidateCacheFor(entityName);
    return result;
  }

  if (String(id).startsWith("offline_")) {
    // Merge into existing create op in queue
    const queue = getQueue();
    const idx = queue.findIndex(op => op.type === "create" && op.tempId === id);
    if (idx !== -1) {
      queue[idx].data = { ...queue[idx].data, ...data };
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
    return { id, ...data };
  }

  enqueue({ type: "update", entity: entityName, id, data });
  updateInCacheList(entityName, id, data);
  return { id, ...data };
}

/**
 * Smart delete: delete on server if online, else queue.
 */
export async function smartDelete(entity, entityName, id) {
  if (isOnline()) {
    await entity.delete(id);
    invalidateCacheFor(entityName);
    return;
  }

  if (String(id).startsWith("offline_")) {
    const queue = getQueue().filter(op => !(op.type === "create" && op.tempId === id));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    removeFromCacheList(entityName, id);
    return;
  }

  enqueue({ type: "delete", entity: entityName, id });
  removeFromCacheList(entityName, id);
}

// ---- Cache list helpers ----

function invalidateCacheFor(entityName) {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX + entityName))
    .forEach(k => localStorage.removeItem(k));
}

function addToCacheList(entityName, record) {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX + entityName))
    .forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const { data, ts } = JSON.parse(raw);
        if (Array.isArray(data)) {
          localStorage.setItem(k, JSON.stringify({ data: [record, ...data], ts }));
        }
      } catch {}
    });
}

function updateInCacheList(entityName, id, updates) {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX + entityName))
    .forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const { data, ts } = JSON.parse(raw);
        if (Array.isArray(data)) {
          const updated = data.map(r => r.id === id ? { ...r, ...updates } : r);
          localStorage.setItem(k, JSON.stringify({ data: updated, ts }));
        }
      } catch {}
    });
}

function removeFromCacheList(entityName, id) {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX + entityName))
    .forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const { data, ts } = JSON.parse(raw);
        if (Array.isArray(data)) {
          localStorage.setItem(k, JSON.stringify({ data: data.filter(r => r.id !== id), ts }));
        }
      } catch {}
    });
}