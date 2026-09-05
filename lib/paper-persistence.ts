import type { PaperConfig } from "./paper";

export const PAPER_CONFIG_KEY = "tqqq-paper-v1";
const DB_NAME = "tqqq-signal-lab-local-state-v1";
const STORE_NAME = "state";
const BACKUP_KEY = "paper-config-v1";
const CHANNEL_NAME = "tqqq-paper-persistence-v1";
const SCHEMA_VERSION = 1 as const;

type PaperBackup = {
  schema: typeof SCHEMA_VERSION;
  updatedAt: number;
  config: PaperConfig;
  checksum: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePaperConfig(value: unknown): PaperConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PaperConfig>;
  const initialJpy = Number(candidate.initialJpy);
  const fxRate = Number(candidate.fxRate);
  const startDate = typeof candidate.startDate === "string" ? candidate.startDate : "";
  if (!Number.isFinite(initialJpy) || initialJpy <= 0) return null;
  if (!Number.isFinite(fxRate) || fxRate <= 0) return null;
  if (!datePattern.test(startDate)) return null;
  const parsed = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== startDate) return null;
  return { initialJpy, startDate, fxRate };
}

function canonical(config: PaperConfig): string {
  return JSON.stringify({
    initialJpy: config.initialJpy,
    startDate: config.startDate,
    fxRate: config.fxRate,
  });
}

function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function makePaperBackup(config: PaperConfig, updatedAt = Date.now()): PaperBackup {
  const normalized = normalizePaperConfig(config);
  if (!normalized) throw new Error("Invalid Paper Trading configuration");
  return {
    schema: SCHEMA_VERSION,
    updatedAt,
    config: normalized,
    checksum: checksum(canonical(normalized)),
  };
}

export function validatePaperBackup(value: unknown): PaperBackup | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PaperBackup>;
  const config = normalizePaperConfig(candidate.config);
  const updatedAt = Number(candidate.updatedAt);
  if (candidate.schema !== SCHEMA_VERSION || !config || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  if (candidate.checksum !== checksum(canonical(config))) return null;
  return { schema: SCHEMA_VERSION, updatedAt, config, checksum: candidate.checksum };
}

function readLocalConfig(): PaperConfig | null {
  try {
    const raw = localStorage.getItem(PAPER_CONFIG_KEY);
    return raw ? normalizePaperConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function hasLocalConfigValue(): boolean {
  try {
    return localStorage.getItem(PAPER_CONFIG_KEY) !== null;
  } catch {
    return false;
  }
}

function writeLocalConfig(config: PaperConfig): boolean {
  try {
    localStorage.setItem(PAPER_CONFIG_KEY, canonical(config));
    return true;
  } catch {
    return false;
  }
}

function removeLocalConfig(): void {
  try { localStorage.removeItem(PAPER_CONFIG_KEY); } catch {}
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readBackup(): Promise<PaperBackup | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(BACKUP_KEY);
      request.onsuccess = () => resolve(validatePaperBackup(request.result));
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeBackup(config: PaperConfig): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(makePaperBackup(config), BACKUP_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function deleteBackup(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(BACKUP_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    } catch {
      db.close();
      resolve();
    }
  });
}

/**
 * Restore the device-local Paper Trading config before React mounts.
 * localStorage remains the application's synchronous primary store; IndexedDB is an
 * independent local backup used only when that primary copy is missing/corrupt.
 */
export async function restorePaperConfig(): Promise<PaperConfig | null> {
  const local = readLocalConfig();
  if (local) {
    void writeBackup(local);
    return local;
  }
  const hadInvalidPrimary = hasLocalConfigValue();
  const backup = await readBackup();
  if (!backup) {
    if (hadInvalidPrimary) removeLocalConfig();
    return null;
  }
  if (!writeLocalConfig(backup.config)) return null;
  return backup.config;
}

/**
 * Mirror future Paper Trading changes to IndexedDB and recover a missing primary copy.
 * No account values leave the browser. An intentional reset deletes both copies.
 */
export function installPaperPersistenceGuard(): void {
  if (typeof window === "undefined") return;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

  const mirrorCurrent = async () => {
    const current = readLocalConfig();
    if (current) {
      await writeBackup(current);
      channel?.postMessage({ type: "update", config: current });
    } else {
      await deleteBackup();
      channel?.postMessage({ type: "reset" });
    }
  };

  const repairIfNeeded = () => { void restorePaperConfig(); };

  window.addEventListener("paper-config-changed", () => { void mirrorCurrent(); });
  window.addEventListener("pageshow", repairIfNeeded);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") repairIfNeeded();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== PAPER_CONFIG_KEY) return;
    if (event.newValue) {
      try {
        const config = normalizePaperConfig(JSON.parse(event.newValue));
        if (config) void writeBackup(config);
        else repairIfNeeded();
      } catch {
        repairIfNeeded();
      }
    } else {
      repairIfNeeded();
    }
  });

  channel?.addEventListener("message", (event: MessageEvent<{ type?: string; config?: unknown }>) => {
    if (event.data?.type === "update") {
      const config = normalizePaperConfig(event.data.config);
      if (config) writeLocalConfig(config);
    } else if (event.data?.type === "reset") {
      removeLocalConfig();
      void deleteBackup();
    }
  });

  if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
}
