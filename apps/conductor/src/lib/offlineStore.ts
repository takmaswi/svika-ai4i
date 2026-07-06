// IndexedDB persistence for the offline boarding state: the hashed code
// cache, the event queue, the failed attempt log and sync metadata. A tiny
// hand rolled wrapper; four stores do not justify a dependency.
//
// What lives on the phone and why it is safe to lose or steal:
//   codes     salted hashes only, scoped to one route + direction + window
//   queue     events already cleared on this device; replaying them at the
//             server is idempotent and can only answer already_redeemed
//   attempts  failed keypad entries waiting to join the server audit log
//   meta      clock skew and last sync time
import type { CachedCode, LocalAttempt } from "./offlineRedeem";
import type { QueuedEvent } from "./offlineQueue";

const DB_NAME = "svika-hwindi";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("codes")) {
        db.createObjectStore("codes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "clientEventId" });
      }
      if (!db.objectStoreNames.contains("attempts")) {
        db.createObjectStore("attempts", { keyPath: "clientAttemptId" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb open failed"));
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb request failed"));
  });
}

async function store(
  name: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

/** row id inside the codes store */
function codeId(row: Pick<CachedCode, "ticketId" | "purpose">): string {
  return `${row.ticketId}:${row.purpose}`;
}

type StoredCode = CachedCode & { id: string };

/**
 * Replace the cache with a fresh pull, carrying over the consumed markers of
 * rows this device already cleared (their sync may still be queued; without
 * the marker the same code could clear twice on this device).
 */
export async function replaceCache(rows: readonly CachedCode[]): Promise<void> {
  const existing = (await request(
    (await store("codes", "readonly")).getAll(),
  )) as StoredCode[];
  const consumed = new Map(
    existing.filter((r) => r.consumedAt !== undefined).map((r) => [r.id, r.consumedAt]),
  );
  const s = await store("codes", "readwrite");
  await request(s.clear());
  for (const row of rows) {
    const id = codeId(row);
    const consumedAt = consumed.get(id);
    await request(s.put({ ...row, id, ...(consumedAt !== undefined ? { consumedAt } : {}) }));
  }
}

export async function getCache(): Promise<CachedCode[]> {
  return (await request((await store("codes", "readonly")).getAll())) as StoredCode[];
}

export async function markConsumed(
  row: Pick<CachedCode, "ticketId" | "purpose">,
  atMs: number,
): Promise<void> {
  const s = await store("codes", "readwrite");
  const current = (await request(s.get(codeId(row)))) as StoredCode | undefined;
  if (!current) return;
  await request(s.put({ ...current, consumedAt: atMs }));
}

export async function putEvent(ev: QueuedEvent): Promise<void> {
  await request((await store("queue", "readwrite")).put(ev));
}

export async function listQueue(): Promise<QueuedEvent[]> {
  return (await request((await store("queue", "readonly")).getAll())) as QueuedEvent[];
}

export async function removeEvent(clientEventId: string): Promise<void> {
  await request((await store("queue", "readwrite")).delete(clientEventId));
}

export async function addAttempt(a: LocalAttempt): Promise<void> {
  await request((await store("attempts", "readwrite")).put(a));
}

export async function listAttempts(): Promise<LocalAttempt[]> {
  return (await request((await store("attempts", "readonly")).getAll())) as LocalAttempt[];
}

export async function removeAttempts(ids: readonly string[]): Promise<void> {
  const s = await store("attempts", "readwrite");
  for (const id of ids) {
    await request(s.delete(id));
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = (await request((await store("meta", "readonly")).get(key))) as
    | { key: string; value: T }
    | undefined;
  return row?.value;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await request((await store("meta", "readwrite")).put({ key, value }));
}

/** Monotonic sequence for queue ordering. */
export async function nextSeq(): Promise<number> {
  const current = (await getMeta<number>("seq")) ?? 0;
  const next = current + 1;
  await setMeta("seq", next);
  return next;
}
