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
      dbPromise = null;
      return reject(new Error('IndexedDB not supported'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // ignore
          }
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        dbPromise = null;
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
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

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDb();
      return await new Promise((resolve, reject) => {
        try {
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
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        } catch (txErr) {
          dbPromise = null;
          reject(txErr);
        }
      });
    } catch (err: any) {
      dbPromise = null;
      const msg = err?.message || String(err);
      if (attempt === 0 && (msg.includes('closing') || msg.includes('InvalidStateError'))) {
        continue; // Retry once with fresh connection
      }
      // Silently finish if tab is hiding or closing
      return;
    }
  }
}

/**
 * Saves all files from an order into IndexedDB.
 */
export async function saveOrderFilesToStorage(
  orderId: string,
  files: any[],
  orderNumber?: string
): Promise<void> {
  if (!orderId || !Array.isArray(files)) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const dataUrl = f?.previewUrl || f?.dataUrl;
    if (f && dataUrl) {
      // Save under file.id
      if (f.id) {
        await saveFileToStorage(f.id, dataUrl, { name: f.name, type: f.type, orderId });
      }
      // Also save under composite orderId_index and orderId_filename
      await saveFileToStorage(`${orderId}_${i}`, dataUrl, { name: f.name, type: f.type, orderId });
      if (f.name) {
        await saveFileToStorage(`${orderId}_${f.name}`, dataUrl, { name: f.name, type: f.type, orderId });
      }
      if (orderNumber) {
        await saveFileToStorage(`${orderNumber}_${i}`, dataUrl, { name: f.name, type: f.type, orderId });
        if (f.name) {
          await saveFileToStorage(`${orderNumber}_${f.name}`, dataUrl, { name: f.name, type: f.type, orderId });
        }
      }
    }
  }
}

/**
 * Retrieves a file from IndexedDB by fileId or orderId + index/name.
 */
export async function getFileFromStorage(fileId: string): Promise<StoredFileRecord | null> {
  if (!fileId) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDb();
      return await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);

          const req = store.get(fileId);
          req.onsuccess = () => {
            resolve(req.result || null);
          };
          req.onerror = () => {
            resolve(null);
          };
          tx.onerror = () => {
            resolve(null);
          };
          tx.onabort = () => {
            resolve(null);
          };
        } catch {
          dbPromise = null;
          resolve(null);
        }
      });
    } catch {
      dbPromise = null;
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

/**
 * Attempts to retrieve a file from storage trying multiple identifier keys:
 * 1. file.id
 * 2. orderId_fileId
 * 3. orderId_index
 * 4. orderId_filename
 * 5. orderNumber_index
 * 6. orderNumber_filename
 */
export async function resolveFileFromStorage(
  orderId?: string,
  fileId?: string,
  index?: number,
  filename?: string,
  orderNumber?: string
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

  // 5. Try orderNumber + index
  if (orderNumber && index !== undefined) {
    const byOrderNumIdx = await getFileFromStorage(`${orderNumber}_${index}`);
    if (byOrderNumIdx?.dataUrl) return byOrderNumIdx.dataUrl;
  }

  // 6. Try orderNumber + filename
  if (orderNumber && filename) {
    const byOrderNumName = await getFileFromStorage(`${orderNumber}_${filename}`);
    if (byOrderNumName?.dataUrl) return byOrderNumName.dataUrl;
  }

  return null;
}
