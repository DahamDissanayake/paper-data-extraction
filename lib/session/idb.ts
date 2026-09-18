import { openDB, type IDBPDatabase } from 'idb';
import type { Session } from '@/lib/types';

const DB_NAME = 'paper-extraction';
const STORE = 'sessions';
export const SESSION_KEY = 'paper-session-id';

interface Row { id: string; session: Session; blob: Blob; }

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); },
  });
  return dbPromise;
}

/**
 * sessionStorage is per-tab and cleared on tab close, which gives us the
 * required lifetime for free: a refresh keeps the id, a new tab does not.
 */
export function resolveSessionId(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): { id: string; isNew: boolean } {
  try {
    const existing = storage.getItem(SESSION_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = crypto.randomUUID();
    storage.setItem(SESSION_KEY, id);
    return { id, isNew: true };
  } catch {
    // Private windows and blocked site data land here. Run in-memory.
    return { id: crypto.randomUUID(), isNew: true };
  }
}

export async function putSession(session: Session, blob: Blob): Promise<void> {
  try { await (await db()).put(STORE, { id: session.id, session, blob } satisfies Row); } catch {}
}

export async function getSession(id: string): Promise<{ session: Session; blob: Blob } | undefined> {
  try {
    const row = (await (await db()).get(STORE, id)) as Row | undefined;
    return row ? { session: row.session, blob: row.blob } : undefined;
  } catch { return undefined; }
}

/** Called on every cold start so an abandoned session never outlives its tab. */
export async function deleteAllExcept(id: string): Promise<void> {
  try {
    const d = await db();
    const keys = await d.getAllKeys(STORE);
    await Promise.all(keys.filter((k) => k !== id).map((k) => d.delete(STORE, k)));
  } catch {}
}
