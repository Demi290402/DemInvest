// ==============================================================================
// DEMINVEST — NODE.JS LOCAL PLATFORM BRIDGE (FS + WEB-PUSH VAPID)
// ==============================================================================
// Questo modulo viene caricato solo in ambiente Node.js locale / test (Vite dev,
// Vite preview, Vitest). Non viene mai importato dalle Cloudflare Pages Functions,
// garantendo che il bundle Edge sia 100% Web Standard e privo di dipendenze Node.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import webPush from 'web-push';
import {
  NodePlatformBridge,
  PushSubscriptionItem,
  registerNodePlatformBridge,
} from './backendEngine';

const DATA_DIR = path.resolve(process.cwd(), 'server', '.data');

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export const localNodeBridge: NodePlatformBridge = {
  readJsonFile<T>(filename: string): T | null {
    if (!ensureDataDir()) return null;
    const fullPath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fullPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T;
    } catch {
      return null;
    }
  },
  writeJsonFile(filename: string, data: unknown): void {
    if (!ensureDataDir()) return;
    const fullPath = path.join(DATA_DIR, filename);
    try {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // ignore write errors
    }
  },
  generateVapidKeys(): { publicKey: string; privateKey: string } {
    const generated = webPush.generateVAPIDKeys();
    return {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    };
  },
  async sendWebPush(
    vapid: { subject: string; publicKey: string; privateKey: string },
    subscription: PushSubscriptionItem,
    payload: string
  ): Promise<void> {
    webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    await webPush.sendNotification(
      subscription as unknown as webPush.PushSubscription,
      payload
    );
  },
};

export function initNodePlatformBridge(): void {
  registerNodePlatformBridge(localNodeBridge);
}

// Auto-registrazione all'importazione in ambiente Node.js
initNodePlatformBridge();
