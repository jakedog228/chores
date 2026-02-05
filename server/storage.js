import crypto from 'crypto';
import { getDb } from './db/client.js';

// ============ Auth Storage ============

export async function getAuthConfig() {
  const db = getDb();
  const result = await db.execute('SELECT password_hash, secret FROM auth_config WHERE id = 1');
  const row = result.rows[0];
  return {
    passwordHash: row?.password_hash || null,
    secret: row?.secret || null
  };
}

export async function saveAuthConfig(config) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE auth_config SET password_hash = ?, secret = ? WHERE id = 1',
    args: [config.passwordHash, config.secret]
  });
}

// ============ People ============

export async function getPeople() {
  const db = getDb();
  const result = await db.execute('SELECT name, color FROM people ORDER BY rowid');
  return result.rows.map(row => ({ name: row.name, color: row.color }));
}

// ============ Chores ============

export async function getChoresByMonth(yearMonth) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, chore_name, assigned_to, due_date, completed_at, completed_by, exception, bear_marked
          FROM chores
          WHERE due_date LIKE ?
          ORDER BY due_date ASC, chore_name ASC`,
    args: [yearMonth + '%']
  });
  return result.rows.map(row => ({
    id: row.id,
    choreName: row.chore_name,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    exception: row.exception === 1,
    bearMarked: row.bear_marked === 1
  }));
}

export async function getChoresDueForUser(user, today) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, chore_name, assigned_to, due_date, completed_at, completed_by, bear_marked, bear_scare_shown
          FROM chores
          WHERE assigned_to = ? AND completed_at IS NULL AND due_date <= ?
          ORDER BY due_date ASC`,
    args: [user, today]
  });
  return result.rows.map(row => ({
    id: row.id,
    choreName: row.chore_name,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    bearMarked: row.bear_marked === 1,
    bearScareShown: row.bear_scare_shown === 1
  }));
}

export async function getChoresUpcomingForUser(user, today, daysAhead = 2) {
  const db = getDb();
  const future = new Date(today + 'T00:00:00');
  future.setDate(future.getDate() + daysAhead);
  const futureDate = future.toISOString().split('T')[0];
  const result = await db.execute({
    sql: `SELECT id, chore_name, assigned_to, due_date, completed_at, completed_by
          FROM chores
          WHERE assigned_to = ? AND completed_at IS NULL AND due_date > ? AND due_date <= ?
          ORDER BY due_date ASC`,
    args: [user, today, futureDate]
  });
  return result.rows.map(row => ({
    id: row.id,
    choreName: row.chore_name,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completedBy: row.completed_by
  }));
}

export async function completeChore(id, completedBy, today) {
  const db = getDb();
  const completedAt = new Date().toISOString();

  // Get the chore being completed
  const choreResult = await db.execute({
    sql: 'SELECT chore_name, due_date FROM chores WHERE id = ?',
    args: [id]
  });
  const chore = choreResult.rows[0];

  await db.execute({
    sql: 'UPDATE chores SET completed_at = ?, completed_by = ? WHERE id = ?',
    args: [completedAt, completedBy, id]
  });

  // Auto-skip all intermediate incomplete chores of the same name
  // (ones that were pardoned because this chore was overdue)
  // Don't skip chores marked as exceptions (manually overridden by user)
  if (chore) {
    await db.execute({
      sql: `UPDATE chores SET completed_at = ?, completed_by = 'skipped'
            WHERE chore_name = ? AND completed_at IS NULL AND exception = 0
            AND due_date > ? AND due_date <= ?`,
      args: [completedAt, chore.chore_name, chore.due_date, today]
    });
  }

  return { completedAt, completedBy };
}

export async function uncompleteChore(id) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE chores SET completed_at = NULL, completed_by = NULL WHERE id = ?',
    args: [id]
  });
}

export async function forceCompleteChore(id, completedBy) {
  const db = getDb();
  const completedAt = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE chores SET completed_at = ?, completed_by = ?, exception = 1 WHERE id = ?',
    args: [completedAt, completedBy, id]
  });
  return { completedAt, completedBy };
}

export async function forceUncompleteChore(id) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE chores SET completed_at = NULL, completed_by = NULL, exception = 1 WHERE id = ?',
    args: [id]
  });
}

export async function bearMarkChore(id) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE chores SET bear_marked = 1 WHERE id = ?',
    args: [id]
  });
}

export async function unBearMarkChore(id) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE chores SET bear_marked = 0, bear_scare_shown = 0 WHERE id = ?',
    args: [id]
  });
}

export async function ackBearScare(id) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE chores SET bear_scare_shown = 1 WHERE id = ?',
    args: [id]
  });
}

// ============ Trash ============

export async function getTrashState() {
  const db = getDb();
  const result = await db.execute('SELECT current_position, is_full FROM trash_state WHERE id = 1');
  const row = result.rows[0];
  return {
    currentPosition: row?.current_position || 1,
    isFull: row?.is_full === 1
  };
}

export async function getTrashVotes() {
  const db = getDb();
  const result = await db.execute('SELECT id, voter, voted_at FROM trash_votes ORDER BY voted_at ASC');
  return result.rows.map(row => ({
    id: row.id,
    voter: row.voter,
    votedAt: row.voted_at
  }));
}

export async function addTrashVote(voter) {
  const db = getDb();

  // Check if already voted
  const existing = await db.execute({
    sql: 'SELECT id FROM trash_votes WHERE voter = ?',
    args: [voter]
  });
  if (existing.rows.length > 0) {
    return { alreadyVoted: true };
  }

  const id = crypto.randomUUID();
  const votedAt = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO trash_votes (id, voter, voted_at) VALUES (?, ?, ?)',
    args: [id, voter, votedAt]
  });

  // Set is_full flag
  await db.execute('UPDATE trash_state SET is_full = 1 WHERE id = 1');

  return { id, voter, votedAt };
}

export async function removeTrashVote(voter) {
  const db = getDb();

  await db.execute({
    sql: 'DELETE FROM trash_votes WHERE voter = ?',
    args: [voter]
  });

  // Check if any votes remain
  const remaining = await db.execute('SELECT COUNT(*) as count FROM trash_votes');
  if (remaining.rows[0].count === 0) {
    await db.execute('UPDATE trash_state SET is_full = 0 WHERE id = 1');
  }

  return { success: true };
}

export async function completeTrash(completedBy, assignedTo, position) {
  const db = getDb();
  const completedAt = new Date().toISOString();

  // Record in history (position can be completed out of order)
  await db.execute({
    sql: 'INSERT OR REPLACE INTO trash_history (position, assigned_to, completed_at, completed_by) VALUES (?, ?, ?, ?)',
    args: [position, assignedTo, completedAt, completedBy]
  });

  // Clear full flag and votes (but don't advance position - completion is non-linear now)
  await db.execute('UPDATE trash_state SET is_full = 0 WHERE id = 1');
  await db.execute('DELETE FROM trash_votes');

  return { completedAt, completedBy, position };
}

export async function getCompletedPositions() {
  const db = getDb();
  const result = await db.execute('SELECT position, assigned_to, completed_at, completed_by FROM trash_history');
  const map = {};
  for (const row of result.rows) {
    map[row.position] = {
      assignedTo: row.assigned_to,
      completedAt: row.completed_at,
      completedBy: row.completed_by
    };
  }
  return map;
}

export async function getTrashHistory(limit = 10) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT position, assigned_to, completed_at, completed_by FROM trash_history ORDER BY position DESC LIMIT ?',
    args: [limit]
  });
  return result.rows.map(row => ({
    position: row.position,
    assignedTo: row.assigned_to,
    completedAt: row.completed_at,
    completedBy: row.completed_by
  }));
}

// ============ Skip Logic ============

// Returns the earliest incomplete chore for each chore_name
export async function getEarliestIncompletePerChore() {
  const db = getDb();
  const result = await db.execute(
    `SELECT chore_name, MIN(due_date) as earliest_due, assigned_to
     FROM chores
     WHERE completed_at IS NULL
     GROUP BY chore_name`
  );
  const map = {};
  for (const row of result.rows) {
    map[row.chore_name] = { dueDate: row.earliest_due, assignedTo: row.assigned_to };
  }
  return map;
}

// ============ Push Notifications ============

export async function getVapidKeys() {
  const db = getDb();
  const result = await db.execute('SELECT vapid_public_key, vapid_private_key FROM auth_config WHERE id = 1');
  const row = result.rows[0];
  return {
    publicKey: row?.vapid_public_key || null,
    privateKey: row?.vapid_private_key || null
  };
}

export async function saveVapidKeys(publicKey, privateKey) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE auth_config SET vapid_public_key = ?, vapid_private_key = ? WHERE id = 1',
    args: [publicKey, privateKey]
  });
}

export async function savePushSubscription(userName, endpoint, p256dh, auth) {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_name, endpoint, p256dh, auth, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_name = ?, p256dh = ?, auth = ?, created_at = ?`,
    args: [id, userName, endpoint, p256dh, auth, createdAt, userName, p256dh, auth, createdAt]
  });
}

export async function getPushSubscriptionsForUser(userName) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_name = ?',
    args: [userName]
  });
  return result.rows.map(row => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth }
  }));
}

export async function deletePushSubscription(endpoint) {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
    args: [endpoint]
  });
}

export async function getChoreById(id) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT id, chore_name, assigned_to, due_date FROM chores WHERE id = ?',
    args: [id]
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    choreName: row.chore_name,
    assignedTo: row.assigned_to,
    dueDate: row.due_date
  };
}

// ============ Rate Limiting ============

export async function getRateLimitAttempts(ip) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT attempts, blocked_until FROM rate_limits WHERE ip = ?',
    args: [ip]
  });

  const row = result.rows[0];
  if (!row) return { attempts: 0, blockedUntil: null };

  if (row.blocked_until && Date.now() > row.blocked_until) {
    await db.execute({
      sql: 'DELETE FROM rate_limits WHERE ip = ?',
      args: [ip]
    });
    return { attempts: 0, blockedUntil: null };
  }

  return {
    attempts: row.attempts,
    blockedUntil: row.blocked_until
  };
}

export async function recordLoginAttempt(ip, success) {
  const db = getDb();

  if (success) {
    await db.execute({
      sql: 'DELETE FROM rate_limits WHERE ip = ?',
      args: [ip]
    });
    return;
  }

  const current = await getRateLimitAttempts(ip);
  const attempts = current.attempts + 1;

  let blockedUntil = null;
  if (attempts >= 5) {
    const blockMinutes = Math.min(30, Math.pow(2, attempts - 5));
    blockedUntil = Date.now() + blockMinutes * 60 * 1000;
  }

  await db.execute({
    sql: `INSERT INTO rate_limits (ip, attempts, blocked_until) VALUES (?, ?, ?)
          ON CONFLICT(ip) DO UPDATE SET attempts = ?, blocked_until = ?`,
    args: [String(ip), attempts, blockedUntil ?? null, attempts, blockedUntil ?? null]
  });
}
