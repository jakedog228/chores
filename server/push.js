import webpush from 'web-push';
import { getDb } from './db/client.js';
import {
  getVapidKeys,
  saveVapidKeys,
  getPushSubscriptionsForUser,
  deletePushSubscription
} from './storage.js';

let initialized = false;
let vapidPublicKey = null;

async function ensureSchema() {
  const db = getDb();
  try { await db.execute('ALTER TABLE auth_config ADD COLUMN vapid_public_key TEXT'); } catch (e) { /* exists */ }
  try { await db.execute('ALTER TABLE auth_config ADD COLUMN vapid_private_key TEXT'); } catch (e) { /* exists */ }
  await db.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_name TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
}

export async function initPush() {
  if (initialized) return;

  await ensureSchema();
  let keys = await getVapidKeys();

  if (!keys.publicKey || !keys.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    await saveVapidKeys(generated.publicKey, generated.privateKey);
    keys = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  }

  webpush.setVapidDetails(
    'mailto:chores@example.com',
    keys.publicKey,
    keys.privateKey
  );

  vapidPublicKey = keys.publicKey;
  initialized = true;
}

export async function getVapidPublicKey() {
  await initPush();
  return vapidPublicKey;
}

export async function sendNotificationToUser(userName, payload) {
  await initPush();

  const subscriptions = await getPushSubscriptionsForUser(userName);
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, body);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    })
  );
}
