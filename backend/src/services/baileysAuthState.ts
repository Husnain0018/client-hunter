import fs from 'node:fs';
import path from 'node:path';
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalKeyStore,
} from '@whiskeysockets/baileys';
import { env } from '../config/env.js';
import type { Database } from '../db/database.js';

export interface PersistentAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => void;
  hasSavedAuth: () => boolean;
}

export function getSessionDirPath(): string {
  const custom = env.BAILEYS_SESSION_DIR;
  let sessionDir: string;
  if (custom && path.isAbsolute(custom)) {
    sessionDir = custom;
  } else {
    const dbDir = path.dirname(path.resolve(process.cwd(), env.databasePath));
    sessionDir = path.resolve(dbDir, 'baileys_auth');
  }
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  } else {
    try {
      fs.chmodSync(sessionDir, 0o700);
    } catch {
      // ignore
    }
  }
  return sessionDir;
}

/**
 * Checks whether an AuthenticationCreds object represents a paired/registered WhatsApp device.
 * Note: In Baileys v7 QR pairing (`configureSuccessfulPairing`), `creds.me` and `creds.account`
 * are populated upon QR scan while `creds.registered` may remain false until pre-key upload or code pairing.
 * Meanwhile Baileys `validateConnection()` checks `Boolean(creds.me)` to decide between login vs registration.
 */
export function isCredsRegistered(creds?: AuthenticationCreds | null): boolean {
  if (!creds) return false;
  return Boolean(creds.me?.id && (creds.account || creds.registered));
}

/**
 * Checks if a valid, registered WhatsApp session exists either in SQLite or on disk.
 * Returns true ONLY if credentials have been paired/registered with WhatsApp.
 */
export function hasSavedSession(db?: Database): boolean {
  if (db) {
    try {
      const credsJson = db.getBaileysAuth('creds');
      if (credsJson) {
        const parsed = JSON.parse(credsJson, BufferJSON.reviver) as AuthenticationCreds;
        if (isCredsRegistered(parsed)) return true;
      }
    } catch {
      // ignore
    }
  }

  try {
    const sessionDir = getSessionDirPath();
    const credsFile = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsFile)) {
      const content = fs.readFileSync(credsFile, 'utf8');
      const parsed = JSON.parse(content, BufferJSON.reviver) as AuthenticationCreds;
      return isCredsRegistered(parsed);
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Clears all stored Baileys authentication credentials and signal keys from SQLite and disk.
 */
export function clearStoredAuthState(db?: Database): void {
  if (db) {
    try {
      db.clearBaileysAuth();
    } catch (err) {
      console.error('[baileysAuthState] Failed to clear SQLite auth:', err);
    }
  }

  try {
    const sessionDir = getSessionDirPath();
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    }
  } catch (err) {
    console.error('[baileysAuthState] Failed to clear Baileys session directory:', err);
  }
}

const fixFileName = (file: string) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

export async function initPersistentAuthState(
  db?: Database,
  options?: { forceFresh?: boolean },
): Promise<PersistentAuthStateResult> {
  const sessionDir = getSessionDirPath();

  if (options?.forceFresh) {
    clearStoredAuthState(db);
  }

  // 1. Load or initialize credentials
  let creds: AuthenticationCreds | null = null;

  if (!options?.forceFresh) {
    // Try SQLite first
    if (db) {
      try {
        const dbCreds = db.getBaileysAuth('creds');
        if (dbCreds) {
          creds = JSON.parse(dbCreds, BufferJSON.reviver) as AuthenticationCreds;
        }
      } catch {
        // ignore
      }
    }

    // Fallback to disk
    if (!creds) {
      try {
        const credsFile = path.join(sessionDir, 'creds.json');
        if (fs.existsSync(credsFile)) {
          const content = fs.readFileSync(credsFile, 'utf8');
          creds = JSON.parse(content, BufferJSON.reviver) as AuthenticationCreds;
          // Sync to SQLite if found on disk
          if (db && creds) {
            db.setBaileysAuth('creds', content);
          }
        }
      } catch {
        // ignore
      }
    }

    // If stored credentials are from an incomplete/unregistered pairing attempt (no me.id),
    // discard them so a fresh registration keypair is generated cleanly for QR pairing.
    if (creds && !isCredsRegistered(creds)) {
      clearStoredAuthState(db);
      creds = null;
    }
  }

  // Fresh credentials template if none found
  if (!creds) {
    creds = initAuthCreds();
  } else if (isCredsRegistered(creds)) {
    creds.registered = true;
  }

  const saveCreds = async (): Promise<void> => {
    if (!creds) return;
    if (isCredsRegistered(creds)) {
      creds.registered = true;
    }
    const jsonStr = JSON.stringify(creds, BufferJSON.replacer);

    // Save to SQLite
    if (db) {
      try {
        db.setBaileysAuth('creds', jsonStr);
      } catch (err) {
        console.error('[baileysAuthState] Failed to save creds in SQLite:', err);
      }
    }

    // Save to disk
    try {
      const credsFile = path.join(sessionDir, 'creds.json');
      fs.writeFileSync(credsFile, jsonStr, 'utf8');
    } catch (err) {
      console.error('[baileysAuthState] Failed to save creds on disk:', err);
    }
  };

  const keys: SignalKeyStore = {
    get: async (type, ids) => {
      const data: Record<string, any> = {};
      const keyIds = ids.map((id) => `${type}-${id}`);

      // Try SQLite
      const foundInDb = new Map<string, string>();
      if (db) {
        try {
          const rows = db.getBaileysAuthMultiple(keyIds);
          for (const r of rows) {
            foundInDb.set(r.key_id, r.value_json);
          }
        } catch {
          // ignore
        }
      }

      for (const id of ids) {
        const keyId = `${type}-${id}`;
        let valueJson = foundInDb.get(keyId);

        // Fallback to disk if not in SQLite
        if (!valueJson) {
          try {
            const diskFile = path.join(sessionDir, `${fixFileName(keyId)}.json`);
            if (fs.existsSync(diskFile)) {
              valueJson = fs.readFileSync(diskFile, 'utf8');
              // Sync to SQLite
              if (db && valueJson) {
                db.setBaileysAuth(keyId, valueJson);
              }
            }
          } catch {
            // ignore
          }
        }

        if (valueJson) {
          try {
            let parsed = JSON.parse(valueJson, BufferJSON.reviver);
            if (type === 'app-state-sync-key' && parsed) {
              parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
            }
            data[id] = parsed;
          } catch {
            data[id] = null;
          }
        } else {
          data[id] = null;
        }
      }

      return data;
    },

    set: async (dataset: SignalDataSet) => {
      const toInsert: Array<{ keyId: string; valueJson: string }> = [];
      const toDelete: string[] = [];

      for (const category in dataset) {
        const categoryData = dataset[category as keyof SignalDataSet];
        if (!categoryData) continue;

        for (const id in categoryData) {
          const value = categoryData[id];
          const keyId = `${category}-${id}`;
          const diskFile = path.join(sessionDir, `${fixFileName(keyId)}.json`);

          if (value) {
            const jsonStr = JSON.stringify(value, BufferJSON.replacer);
            toInsert.push({ keyId, valueJson: jsonStr });
            try {
              fs.writeFileSync(diskFile, jsonStr, 'utf8');
            } catch {
              // ignore
            }
          } else {
            toDelete.push(keyId);
            try {
              if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
            } catch {
              // ignore
            }
          }
        }
      }

      if (db) {
        try {
          if (toInsert.length > 0) db.setBaileysAuthBatch(toInsert);
          if (toDelete.length > 0) db.deleteBaileysAuthBatch(toDelete);
        } catch (err) {
          console.error('[baileysAuthState] Failed to batch update keys in SQLite:', err);
        }
      }
    },
  };

  const clearAuthState = (): void => {
    // Clear SQLite
    if (db) {
      try {
        db.clearBaileysAuth();
      } catch (err) {
        console.error('[baileysAuthState] Failed to clear SQLite auth:', err);
      }
    }

    // Clear disk
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      console.error('[baileysAuthState] Failed to clear Baileys session directory:', err);
    }
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds,
    clearAuthState,
    hasSavedAuth: () => hasSavedSession(db),
  };
}
