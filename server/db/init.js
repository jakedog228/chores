import { getDb } from './client.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { argon2id } from 'hash-wasm';

const __dirname = dirname(fileURLToPath(import.meta.url));

const schema = `
CREATE TABLE IF NOT EXISTS auth_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT,
  secret TEXT
);

INSERT OR IGNORE INTO auth_config (id) VALUES (1);

CREATE TABLE IF NOT EXISTS people (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  chore_name TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  due_date TEXT NOT NULL,
  completed_at TEXT,
  completed_by TEXT,
  exception INTEGER NOT NULL DEFAULT 0,
  bear_marked INTEGER NOT NULL DEFAULT 0,
  bear_scare_shown INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trash_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_position INTEGER NOT NULL DEFAULT 1,
  is_full INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO trash_state (id, current_position, is_full) VALUES (1, 1, 0);

CREATE TABLE IF NOT EXISTS trash_votes (
  id TEXT PRIMARY KEY,
  voter TEXT NOT NULL,
  voted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trash_history (
  position INTEGER PRIMARY KEY,
  assigned_to TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  completed_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  blocked_until INTEGER
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

function weeklyDatesOnOrAfter(anchor, weekdays, endDate) {
  const out = [];
  for (const w of weekdays) {
    const anchorDay = (anchor.getDay() + 6) % 7; // Convert to Mon=0
    const delta = ((w - anchorDay) % 7 + 7) % 7;
    const first = new Date(anchor);
    first.setDate(first.getDate() + delta);
    const d = new Date(first);
    while (d <= endDate) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
  }
  return out.sort((a, b) => a - b);
}

function generateChores(config, endDate) {
  const anchor = new Date(config.anchor_date + 'T00:00:00');
  const chores = [];

  for (const [choreName, rule] of Object.entries(config.rules)) {
    const rotation = config.rotations[choreName];
    if (!rotation) continue;

    const startPerson = config.start_person?.[choreName] || rotation[0];
    const startIdx = rotation.indexOf(startPerson);

    let dates = [];

    if (rule.weekly_on) {
      dates = weeklyDatesOnOrAfter(anchor, rule.weekly_on, endDate);
    } else if (rule.every_n_days) {
      const n = rule.every_n_days;
      const d = new Date(anchor);
      while (d <= endDate) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + n);
      }
    }

    // Filter to only dates from anchor forward
    dates = dates.filter(d => d >= anchor);

    for (let i = 0; i < dates.length; i++) {
      const assignedTo = rotation[(startIdx + i) % rotation.length];
      const dueDate = dates[i].toISOString().split('T')[0];
      const id = crypto.randomUUID();
      chores.push({ id, chore_name: choreName, assigned_to: assignedTo, due_date: dueDate });
    }
  }

  return chores;
}

async function initializeDatabase() {
  const db = getDb();

  console.log('Initializing database schema...');

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  // Migrations for existing databases
  try {
    await db.execute('ALTER TABLE chores ADD COLUMN exception INTEGER NOT NULL DEFAULT 0');
    console.log('Added exception column to chores table.');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE chores ADD COLUMN bear_marked INTEGER NOT NULL DEFAULT 0');
    console.log('Added bear_marked column to chores table.');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE chores ADD COLUMN bear_scare_shown INTEGER NOT NULL DEFAULT 0');
    console.log('Added bear_scare_shown column to chores table.');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE auth_config ADD COLUMN vapid_public_key TEXT');
    console.log('Added vapid_public_key column to auth_config table.');
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute('ALTER TABLE auth_config ADD COLUMN vapid_private_key TEXT');
    console.log('Added vapid_private_key column to auth_config table.');
  } catch (e) {
    // Column already exists
  }

  // Load config
  const configPath = resolve(__dirname, '../../config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Populate people
  console.log('Populating people...');
  for (const person of config.people) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO people (name, color) VALUES (?, ?)',
      args: [person.name, person.color]
    });
  }

  // Check if chores already seeded
  const existingChores = await db.execute('SELECT COUNT(*) as count FROM chores');
  if (existingChores.rows[0].count === 0) {
    // Generate 6 months of chores from anchor date
    const anchor = new Date(config.anchor_date + 'T00:00:00');
    const endDate = new Date(anchor);
    endDate.setMonth(endDate.getMonth() + 6);

    console.log(`Generating chores from ${anchor.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);
    const chores = generateChores(config, endDate);

    for (const chore of chores) {
      await db.execute({
        sql: 'INSERT INTO chores (id, chore_name, assigned_to, due_date) VALUES (?, ?, ?, ?)',
        args: [chore.id, chore.chore_name, chore.assigned_to, chore.due_date]
      });
    }
    console.log(`Generated ${chores.length} chore assignments.`);
  } else {
    console.log('Chores already seeded, skipping.');
  }

  // Set up password if not configured
  const authConfig = await db.execute('SELECT password_hash FROM auth_config WHERE id = 1');
  if (!authConfig.rows[0]?.password_hash) {
    console.log('Setting up default password...');
    const salt = crypto.randomBytes(16);
    const passwordHash = await argon2id({
      password: 'ultratowels3',
      salt,
      parallelism: 4,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'encoded'
    });
    const secret = crypto.randomBytes(64).toString('base64');
    await db.execute({
      sql: 'UPDATE auth_config SET password_hash = ?, secret = ? WHERE id = 1',
      args: [passwordHash, secret]
    });
    console.log('Password configured.');
  }

  console.log('Database initialized successfully!');
}

initializeDatabase().catch(console.error);
