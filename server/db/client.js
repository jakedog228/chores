import { createClient } from '@libsql/client';

let db = null;

export function getDb() {
  if (!db) {
    if (process.env.NODE_ENV === 'test') {
      db = createClient({ url: ':memory:' });
    } else {
      const url = process.env.TURSO_DATABASE_URL;
      const authToken = process.env.TURSO_AUTH_TOKEN;

      if (!url) {
        throw new Error('TURSO_DATABASE_URL environment variable is required');
      }

      db = createClient({
        url,
        authToken
      });
    }
  }
  return db;
}

export function resetDb() {
  db = null;
}
