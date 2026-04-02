/**
 * IndexedDB-backed queue for stock adjustments made while offline.
 * Deltas are stored (never absolute values) so they can be replayed in order.
 */
import type { OfflineMutation } from '@beacon/types'

const DB_NAME = 'beacon-offline'
const DB_VERSION = 1
const STORE = 'mutations'
const QUEUE_EVENT = 'beacon:queue-changed'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => { resolve(req.result); }
    req.onerror = () => { reject(new Error(req.error?.message ?? 'IDBOpenDBRequest failed')); }
  })
}

export async function queueMutation(mutation: OfflineMutation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(mutation)
    tx.oncomplete = () => { resolve(); }
    tx.onerror = () => { reject(new Error(tx.error?.message ?? 'IDBTransaction failed')); }
  })
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => { resolve(req.result as OfflineMutation[]); }
    req.onerror = () => { reject(new Error(req.error?.message ?? 'IDBRequest failed')); }
  })
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { resolve(); }
    tx.onerror = () => { reject(new Error(tx.error?.message ?? 'IDBTransaction failed')); }
  })
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => { resolve(req.result); }
    req.onerror = () => { reject(new Error(req.error?.message ?? 'IDBRequest failed')); }
  })
}

/** Dispatch a custom event so any listener can refresh the queue count. */
export function notifyQueueChanged(): void {
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function onQueueChanged(fn: () => void): () => void {
  window.addEventListener(QUEUE_EVENT, fn)
  return () => { window.removeEventListener(QUEUE_EVENT, fn); }
}
