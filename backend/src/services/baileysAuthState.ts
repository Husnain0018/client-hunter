import fs from 'node:fs';
import path from 'node:path';
import {
  useMultiFileAuthState,
  type AuthenticationState,
} from '@whiskeysockets/baileys';
import { env } from '../config/env.js';

export interface PersistentAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => void;
  hasSavedAuth: () => boolean;
}

export function getSessionDirPath(): string {
  const sessionDir = path.resolve(process.cwd(), env.BAILEYS_SESSION_DIR || './data/baileys_auth');
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

export function hasSavedSession(): boolean {
  const sessionDir = getSessionDirPath();
  return fs.existsSync(path.join(sessionDir, 'creds.json'));
}

export async function initPersistentAuthState(): Promise<PersistentAuthStateResult> {
  const sessionDir = getSessionDirPath();
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  return {
    state,
    saveCreds,
    clearAuthState: () => {
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
        }
      } catch (err) {
        console.error('Failed to clear Baileys session directory:', err);
      }
    },
    hasSavedAuth: () => fs.existsSync(path.join(sessionDir, 'creds.json')),
  };
}
