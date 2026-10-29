import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalKeyStore,
} from '@whiskeysockets/baileys';
import type { Database } from '../db/database.js';

export interface SqliteAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => void;
}

/**
 * Creates a Baileys AuthenticationState adapter backed by the existing SQLite database.
 * Uses Baileys BufferJSON replacer/reviver for lossless Buffer serialization.
 * Transactions in SQLite ensure atomic key storage without file-locking or corruption risks.
 */
export function useSqliteAuthState(db: Database): SqliteAuthStateResult {
  // 1. Initialize or load root credentials
  const rawCreds = db.getBaileysAuth('creds');
  let creds: AuthenticationCreds;

  if (rawCreds) {
    try {
      creds = JSON.parse(rawCreds, BufferJSON.reviver);
    } catch {
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // 2. Signal key store implementation
  const keys: SignalKeyStore = {
    get: async (type, ids) => {
      const data: Record<string, unknown> = {};
      const keyIds = ids.map((id) => `${type}-${id}`);
      const rows = db.getBaileysAuthMultiple(keyIds);

      for (const row of rows) {
        try {
          const id = row.key_id.slice(type.length + 1);
          data[id] = JSON.parse(row.value_json, BufferJSON.reviver);
        } catch {
          // ignore corrupted or unparseable keys
        }
      }

      return data as any;
    },

    set: async (dataset: any) => {
      const toUpsert: Array<{ keyId: string; valueJson: string }> = [];
      const toDelete: string[] = [];

      for (const type in dataset) {
        const typeData = dataset[type];
        if (!typeData) continue;
        for (const id in typeData) {
          const value = typeData[id];
          const keyId = `${type}-${id}`;
          if (value) {
            toUpsert.push({ keyId, valueJson: JSON.stringify(value, BufferJSON.replacer) });
          } else {
            toDelete.push(keyId);
          }
        }
      }

      if (toUpsert.length > 0) {
        db.setBaileysAuthBatch(toUpsert);
      }
      if (toDelete.length > 0) {
        db.deleteBaileysAuthBatch(toDelete);
      }
    },

    clear: async () => {
      db.clearBaileysAuth();
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds: async () => {
      db.setBaileysAuth('creds', JSON.stringify(creds, BufferJSON.replacer));
    },
    clearAuthState: () => {
      db.clearBaileysAuth();
    },
  };
}
