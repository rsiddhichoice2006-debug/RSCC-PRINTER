/**
 * IndexedDB Persistent File Storage
 * Allows storing large customer files (PDFs, high-res photos, documents up to hundreds of MBs)
 * without hitting browser localStorage 5MB quota limits.
 */

const DB_NAME = 'rscc_file_storage_v1';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface StoredFileRecord {
  id: string; // file.id or orderId_fileId or orderId_index
  orderId?: string;
  name: string;
  type: string;
  dataUrl: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('orderId', 'orderId', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Saves a file's full data URL into IndexedDB.
 */
export async function saveFileToStorage(
  fileId: string,
  dataUrl: string,
  metadata?: { name?: string; type?: string; orderId?: string }
): Promise<void> {
  if (!fileId || !dataUrl) return;

  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredFileRecord = {
        id: fileId,
        orderId: metadata?.orderId,
        name: metadata?.name || 'document',
        type: metadata?.type || 'application/octet-stream',
        dataUrl,
        updatedAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save file to IndexedDB:', err);
  }
}

/**
 * Saves all files from an order into IndexedDB.
 */
export async function saveOrderFilesToStorage(orderId: string, files: any[]): Promise<void> {
  if (!orderId || !Array.isArray(files)) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f && f.previewUrl) {
      // Save under file.id
      if (f.id) {
        await saveFileToStorage(f.id, f.previewUrl, { name: f.name, type: f.type, orderId });
      }
      // Also save under composite orderId_index and orderId_filename
      await saveFileToStorage(`${orderId}_${i}`, f.previewUrl, { name: f.name, type: f.type, orderId });
      if (f.name) {
        await saveFileToStorage(`${orderId}_${f.name}`, f.previewUrl, { name: f.name, type: f.type, orderId });
      }
    }
  }
}

/**
 * Retrieves a file from IndexedDB by fileId or orderId + index/name.
 */
export async function getFileFromStorage(fileId: string): Promise<StoredFileRecord | null> {
  if (!fileId) return null;

  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const req = store.get(fileId);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Attempts to retrieve a file from storage trying multiple identifier keys:
 * 1. file.id
 * 2. orderId_fileId
 * 3. orderId_index
 * 4. orderId_filename
 */
export async function resolveFileFromStorage(
  orderId?: string,
  fileId?: string,
  index?: number,
  filename?: string
): Promise<string | null> {
  // 1. Try fileId directly
  if (fileId) {
    const direct = await getFileFromStorage(fileId);
    if (direct?.dataUrl) return direct.dataUrl;
  }

  // 2. Try orderId + fileId
  if (orderId && fileId) {
    const composite = await getFileFromStorage(`${orderId}_${fileId}`);
    if (composite?.dataUrl) return composite.dataUrl;
  }

  // 3. Try orderId + index
  if (orderId && index !== undefined) {
    const byIndex = await getFileFromStorage(`${orderId}_${index}`);
    if (byIndex?.dataUrl) return byIndex.dataUrl;
  }

  // 4. Try orderId + filename
  if (orderId && filename) {
    const byName = await getFileFromStorage(`${orderId}_${filename}`);
    if (byName?.dataUrl) return byName.dataUrl;
  }

  return null;
}
