const CACHE_PREFIX = "4eco_cache_";
const QUEUE_KEY = "4eco_offline_queue";
const CURRENT_USER_CACHE_KEY = "4eco_cached_current_user";
const QUEUE_EVENT_NAME = "4eco_offline_queue_changed";
const CACHE_TTL = 24 * 60 * 60 * 1000;

function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function emitQueueChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT_NAME, {
      detail: { count: getQueue().length },
    }));
  }
}

function setQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  emitQueueChange();
}

function getCachedPayload(storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  return safeParse(raw, null);
}

function setCachedPayload(storageKey, data) {
  localStorage.setItem(storageKey, JSON.stringify({ data, ts: Date.now() }));
}

function isFresh(ts) {
  return typeof ts === "number" && Date.now() - ts <= CACHE_TTL;
}

function getUserCachePrefix() {
  try {
    const sessionCached = sessionStorage.getItem("layout_user_cache");
    if (sessionCached) {
      const parsed = safeParse(sessionCached, null);
      const email = parsed?.data?.user?.email;
      if (email) return email;
    }
  } catch {}

  const cachedUser = getCachedCurrentUser();
  if (cachedUser?.email) return cachedUser.email;
  return "anon";
}

function buildReadCacheKey(entityName, methodName, args = []) {
  return `${getUserCachePrefix()}::${entityName}::${methodName}::${JSON.stringify(args)}`;
}

function eachEntityCache(entityName, callback) {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX) && key.includes(`::${entityName}::`))
    .forEach(callback);
}

function updateCachedRecords(entityName, updater) {
  eachEntityCache(entityName, (storageKey) => {
    const cached = getCachedPayload(storageKey);
    if (!cached || !isFresh(cached.ts)) return;

    if (Array.isArray(cached.data)) {
      setCachedPayload(storageKey, updater(cached.data));
      return;
    }

    if (cached.data && typeof cached.data === "object") {
      setCachedPayload(storageKey, updater(cached.data));
    }
  });
}

function invalidateCacheFor(entityName) {
  eachEntityCache(entityName, (storageKey) => localStorage.removeItem(storageKey));
}

function addToCacheList(entityName, record) {
  updateCachedRecords(entityName, (data) => {
    if (!Array.isArray(data)) return data;
    if (data.some((item) => item?.id === record.id)) {
      return data.map((item) => item?.id === record.id ? { ...item, ...record } : item);
    }
    return [record, ...data];
  });
}

function updateInCacheList(entityName, recordId, updates) {
  updateCachedRecords(entityName, (data) => {
    if (Array.isArray(data)) {
      return data.map((item) => item?.id === recordId ? { ...item, ...updates, id: recordId } : item);
    }
    if (data?.id === recordId) {
      return { ...data, ...updates, id: recordId };
    }
    return data;
  });
}

function removeFromCacheList(entityName, recordId) {
  updateCachedRecords(entityName, (data) => {
    if (Array.isArray(data)) {
      return data.filter((item) => item?.id !== recordId);
    }
    if (data?.id === recordId) {
      return null;
    }
    return data;
  });
}

function replaceTempInCacheList(entityName, tempId, record) {
  updateCachedRecords(entityName, (data) => {
    if (Array.isArray(data)) {
      return data.map((item) => item?.id === tempId ? { ...item, ...record, _offline: false } : item);
    }
    if (data?.id === tempId) {
      return { ...data, ...record, _offline: false };
    }
    return data;
  });
}

function getOriginalMethod(entity, methodName) {
  return entity?.__offlineOriginals?.[methodName] || entity?.[methodName];
}

async function smartRead(requestFn, entityName, methodName, args, fallbackValue) {
  const cacheKey = buildReadCacheKey(entityName, methodName, args);

  if (isOnline()) {
    try {
      const data = await requestFn();
      cacheSet(cacheKey, data);
      return data;
    } catch (error) {
      const cached = cacheGet(cacheKey);
      if (cached !== null) return cached;
      throw error;
    }
  }

  const cached = cacheGet(cacheKey);
  return cached !== null ? cached : fallbackValue;
}

function findQueuedCreate(tempId) {
  return getQueue().find((op) => op.type === "create" && op.tempId === tempId);
}

export function cacheSet(key, data) {
  try {
    setCachedPayload(CACHE_PREFIX + key, data);
  } catch (error) {
    console.warn("Cache write failed:", error);
  }
}

export function cacheGet(key) {
  try {
    const cached = getCachedPayload(CACHE_PREFIX + key);
    if (!cached || !isFresh(cached.ts)) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function getQueue() {
  const queue = safeParse(localStorage.getItem(QUEUE_KEY) || "[]", []);
  return Array.isArray(queue) ? queue : [];
}

export function enqueue(operation) {
  const queueItem = {
    ...operation,
    queueId: operation.queueId || createId(),
    queuedAt: new Date().toISOString(),
  };
  setQueue([...getQueue(), queueItem]);
  return queueItem;
}

export function clearQueue() {
  setQueue([]);
}

export function removeFromQueue(queueId) {
  setQueue(getQueue().filter((item) => item.queueId !== queueId));
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function cacheCurrentUser(user) {
  if (!user) return;
  cacheSet(CURRENT_USER_CACHE_KEY, user);
}

export function getCachedCurrentUser() {
  return cacheGet(CURRENT_USER_CACHE_KEY);
}

export async function syncQueue(source) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const tempIdMap = {};
  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const op of queue) {
    const entity = source?.entities?.[op.entity] || source?.[op.entity];
    if (!entity) {
      remaining.push(op);
      continue;
    }

    try {
      const createMethod = getOriginalMethod(entity, "create");
      const updateMethod = getOriginalMethod(entity, "update");
      const deleteMethod = getOriginalMethod(entity, "delete");

      if (op.type === "create") {
        const created = await createMethod.call(entity, op.data);
        tempIdMap[op.tempId] = created.id;
        replaceTempInCacheList(op.entity, op.tempId, created);
        synced++;
        continue;
      }

      const resolvedId = tempIdMap[op.recordId] || op.recordId;
      if (!resolvedId) {
        remaining.push(op);
        continue;
      }

      if (op.type === "update") {
        await updateMethod.call(entity, resolvedId, op.data);
        updateInCacheList(op.entity, resolvedId, op.data);
      }

      if (op.type === "delete") {
        await deleteMethod.call(entity, resolvedId);
        removeFromCacheList(op.entity, resolvedId);
      }

      synced++;
    } catch (error) {
      console.error("Sync failed for op:", op, error);
      failed++;
      remaining.push(op);
    }
  }

  setQueue(remaining);
  return { synced, failed };
}

export async function smartList(entity, entityName, filterOrSort, limit = 200) {
  const methodName = filterOrSort && typeof filterOrSort === "object" && !Array.isArray(filterOrSort) ? "filter" : "list";
  const args = methodName === "filter"
    ? [filterOrSort, "-created_date", limit]
    : [filterOrSort || "-created_date", limit];

  return smartRead(async () => {
    const method = getOriginalMethod(entity, methodName);
    return method.call(entity, ...args);
  }, entityName, methodName, args, []);
}

export async function smartCreate(entity, entityName, data, currentUser) {
  const createMethod = getOriginalMethod(entity, "create");

  if (isOnline()) {
    const result = await createMethod.call(entity, data);
    invalidateCacheFor(entityName);
    return result;
  }

  const tempId = `offline_${createId()}`;
  const record = {
    ...data,
    id: tempId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    created_by_id: currentUser?.id || "",
    _offline: true,
  };

  enqueue({ type: "create", entity: entityName, tempId, data });
  addToCacheList(entityName, record);
  return record;
}

export async function smartUpdate(entity, entityName, recordId, data) {
  const updateMethod = getOriginalMethod(entity, "update");

  if (isOnline()) {
    const result = await updateMethod.call(entity, recordId, data);
    invalidateCacheFor(entityName);
    return result;
  }

  if (String(recordId).startsWith("offline_")) {
    const queue = getQueue();
    const createIndex = queue.findIndex((op) => op.type === "create" && op.tempId === recordId);

    if (createIndex !== -1) {
      queue[createIndex] = {
        ...queue[createIndex],
        data: { ...queue[createIndex].data, ...data },
      };
      setQueue(queue);
      updateInCacheList(entityName, recordId, data);
      return { id: recordId, ...data, _offline: true };
    }
  }

  enqueue({ type: "update", entity: entityName, recordId, data });
  updateInCacheList(entityName, recordId, data);
  return { id: recordId, ...data, _offline: true };
}

export async function smartDelete(entity, entityName, recordId) {
  const deleteMethod = getOriginalMethod(entity, "delete");

  if (isOnline()) {
    await deleteMethod.call(entity, recordId);
    invalidateCacheFor(entityName);
    return;
  }

  if (String(recordId).startsWith("offline_")) {
    const filteredQueue = getQueue().filter((op) => !(op.type === "create" && op.tempId === recordId));
    setQueue(filteredQueue);
    removeFromCacheList(entityName, recordId);
    return;
  }

  enqueue({ type: "delete", entity: entityName, recordId });
  removeFromCacheList(entityName, recordId);
}

function patchEntity(base44, entityName) {
  const entity = base44?.entities?.[entityName];
  if (!entity || entity.__offlinePatched) return;

  entity.__offlineOriginals = {
    list: entity.list,
    filter: entity.filter,
    get: entity.get,
    create: entity.create,
    update: entity.update,
    delete: entity.delete,
  };

  if (entity.__offlineOriginals.list) {
    entity.list = async (...args) => smartRead(
      () => entity.__offlineOriginals.list.call(entity, ...args),
      entityName,
      "list",
      args,
      []
    );
  }

  if (entity.__offlineOriginals.filter) {
    entity.filter = async (...args) => smartRead(
      () => entity.__offlineOriginals.filter.call(entity, ...args),
      entityName,
      "filter",
      args,
      []
    );
  }

  if (entity.__offlineOriginals.get) {
    entity.get = async (...args) => smartRead(
      () => entity.__offlineOriginals.get.call(entity, ...args),
      entityName,
      "get",
      args,
      null
    );
  }

  if (entity.__offlineOriginals.create) {
    entity.create = async (data) => smartCreate(entity, entityName, data, getCachedCurrentUser());
  }

  if (entity.__offlineOriginals.update) {
    entity.update = async (recordId, data) => smartUpdate(entity, entityName, recordId, data);
  }

  if (entity.__offlineOriginals.delete) {
    entity.delete = async (recordId) => smartDelete(entity, entityName, recordId);
  }

  entity.__offlinePatched = true;
}

function patchAuth(base44) {
  if (!base44?.auth || base44.auth.__offlinePatched) return;

  const originalMe = base44.auth.me?.bind(base44.auth);
  const originalIsAuthenticated = base44.auth.isAuthenticated?.bind(base44.auth);

  if (originalMe) {
    base44.auth.me = async (...args) => {
      if (isOnline()) {
        try {
          const user = await originalMe(...args);
          cacheCurrentUser(user);
          return user;
        } catch (error) {
          const cachedUser = getCachedCurrentUser();
          if (cachedUser) return cachedUser;
          throw error;
        }
      }

      const cachedUser = getCachedCurrentUser();
      if (cachedUser) return cachedUser;
      return originalMe(...args);
    };
  }

  if (originalIsAuthenticated) {
    base44.auth.isAuthenticated = async (...args) => {
      if (isOnline()) {
        try {
          return await originalIsAuthenticated(...args);
        } catch (error) {
          if (getCachedCurrentUser()) return true;
          throw error;
        }
      }
      return !!getCachedCurrentUser();
    };
  }

  base44.auth.__offlinePatched = true;
}

export function initializeOfflineSupport(base44) {
  if (!base44 || base44.__offlineSupportInitialized) return base44;

  patchAuth(base44);
  Object.keys(base44.entities || {}).forEach((entityName) => patchEntity(base44, entityName));

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      syncQueue(base44).catch(() => {});
    });
  }

  base44.__offlineSupportInitialized = true;
  return base44;
}

export function subscribeToQueueChanges(callback) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => callback(event.detail?.count ?? getQueue().length);
  window.addEventListener(QUEUE_EVENT_NAME, handler);
  return () => window.removeEventListener(QUEUE_EVENT_NAME, handler);
}