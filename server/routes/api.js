import { Router } from 'express';
import {
  getPeople,
  getChoresByMonth,
  getChoresDueForUser,
  getChoresUpcomingForUser,
  completeChore,
  uncompleteChore,
  forceCompleteChore,
  forceUncompleteChore,
  bearMarkChore,
  unBearMarkChore,
  ackBearScare,
  getEarliestIncompletePerChore,
  getLastCompletedPerChore,
  getTrashState,
  getTrashVotes,
  addTrashVote,
  removeTrashVote,
  completeTrash,
  getCompletedPositions,
  getTrashHistory,
  getChoreById,
  savePushSubscription,
  deletePushSubscription
} from '../storage.js';
import { getVapidPublicKey, sendNotificationToUser } from '../push.js';

export const apiRouter = Router();

// Trash queue config (matches trash_maker.py)
const PEOPLE_ORDER = ['Gabe', 'Shivaji', 'Luke', 'Johnathan', 'Adi'];
const TRASH_OFFSET = 3;

function getTrashPerson(position) {
  return PEOPLE_ORDER[(position - 1 + TRASH_OFFSET) % PEOPLE_ORDER.length];
}

// Helper: annotate chores with skipped flag
// A chore is "skipped" if there's an earlier incomplete occurrence of the same
// chore_name. This freezes the rotation until the overdue person completes theirs.
function annotateSkipped(chores, earliestIncomplete, today) {
  return chores.map(chore => {
    if (chore.completedAt || chore.exception) {
      return { ...chore, skipped: false };
    }
    const earliest = earliestIncomplete[chore.choreName];
    // Only skip if this chore is already due AND there's an earlier incomplete one
    if (earliest && earliest.dueDate < chore.dueDate && chore.dueDate <= today) {
      return { ...chore, skipped: true, skippedBecause: earliest.assignedTo };
    }
    return { ...chore, skipped: false };
  });
}

// ============ People ============

apiRouter.get('/people', async (req, res) => {
  const people = await getPeople();
  res.json(people);
});

// ============ Chores ============

apiRouter.get('/chores', async (req, res) => {
  const month = req.query.month; // YYYY-MM format
  const today = req.query.today; // YYYY-MM-DD format (user's local date)
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month query parameter required (YYYY-MM format)' });
  }
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return res.status(400).json({ error: 'today query parameter required (YYYY-MM-DD format)' });
  }
  const chores = await getChoresByMonth(month);
  const earliestIncomplete = await getEarliestIncompletePerChore();
  res.json(annotateSkipped(chores, earliestIncomplete, today));
});

apiRouter.patch('/chores/:id', async (req, res) => {
  const { id } = req.params;
  const { completedBy, force, today } = req.body;

  if (!completedBy) {
    return res.status(400).json({ error: 'completedBy is required' });
  }
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return res.status(400).json({ error: 'today is required (YYYY-MM-DD format)' });
  }

  const result = force
    ? await forceCompleteChore(id, completedBy)
    : await completeChore(id, completedBy, today);
  res.json(result);
});

apiRouter.patch('/chores/:id/uncomplete', async (req, res) => {
  const { id } = req.params;
  const { force } = req.body || {};

  if (force) {
    await forceUncompleteChore(id);
  } else {
    await uncompleteChore(id);
  }
  res.json({ success: true });
});

apiRouter.post('/chores/:id/bear', async (req, res) => {
  const { id } = req.params;
  await bearMarkChore(id);

  // Send push notification to chore owner (fire-and-forget)
  const chore = await getChoreById(id);
  if (chore) {
    sendNotificationToUser(chore.assignedTo, {
      title: '\u{1F43B}',
      body: `${chore.choreName}..!`
    }).catch(() => {});
  }

  res.json({ success: true });
});

apiRouter.post('/chores/:id/unbear', async (req, res) => {
  const { id } = req.params;
  await unBearMarkChore(id);
  res.json({ success: true });
});

apiRouter.post('/chores/:id/bear-seen', async (req, res) => {
  const { id } = req.params;
  await ackBearScare(id);
  res.json({ success: true });
});

// ============ Trash ============

apiRouter.get('/trash', async (req, res) => {
  const state = await getTrashState();
  const votes = await getTrashVotes();
  const completedPositions = await getCompletedPositions();

  // Find the lowest incomplete position (the "next up")
  let nextUpPosition = 1;
  while (completedPositions[nextUpPosition]) {
    nextUpPosition++;
  }

  // Generate queue: show 5 before next up (completed) and 10 after (upcoming)
  const startPos = Math.max(1, nextUpPosition - 5);
  const endPos = nextUpPosition + 10;

  const queue = [];
  for (let pos = startPos; pos <= endPos; pos++) {
    const assignedTo = getTrashPerson(pos);
    const completion = completedPositions[pos];
    queue.push({
      position: pos,
      assignedTo,
      completedAt: completion?.completedAt || null,
      completedBy: completion?.completedBy || null
    });
  }

  res.json({
    queue,
    nextUpPosition,
    nextUpPerson: getTrashPerson(nextUpPosition),
    voteCount: votes.length,
    isFull: state.isFull,
    voters: votes.map(v => v.voter) // For checking if user has voted (not displayed)
  });
});

apiRouter.post('/trash/vote-full', async (req, res) => {
  const { voter } = req.body;
  if (!voter) {
    return res.status(400).json({ error: 'voter is required' });
  }

  const result = await addTrashVote(voter);

  // Send push notification to next-up person (fire-and-forget)
  if (!result.alreadyVoted) {
    const completedPositions = await getCompletedPositions();
    let nextUpPosition = 1;
    while (completedPositions[nextUpPosition]) {
      nextUpPosition++;
    }
    const nextUpPerson = getTrashPerson(nextUpPosition);
    if (nextUpPerson !== voter) {
      sendNotificationToUser(nextUpPerson, {
        title: '\u{1F5D1}\u{FE0F}',
        body: "Nnngh... I'm so full..."
      }).catch(() => {});
    }
  }

  res.json(result);
});

apiRouter.delete('/trash/vote', async (req, res) => {
  const { voter } = req.body;
  if (!voter) {
    return res.status(400).json({ error: 'voter is required' });
  }

  const result = await removeTrashVote(voter);
  res.json(result);
});

apiRouter.post('/trash/complete', async (req, res) => {
  const { completedBy, position } = req.body;
  if (!completedBy) {
    return res.status(400).json({ error: 'completedBy is required' });
  }

  // If position specified, complete that slot
  // Otherwise, find the next incomplete slot for this person
  let targetPosition = position;

  if (!targetPosition) {
    const completedPositions = await getCompletedPositions();
    // Find the first incomplete position assigned to completedBy
    let pos = 1;
    while (true) {
      if (!completedPositions[pos] && getTrashPerson(pos) === completedBy) {
        targetPosition = pos;
        break;
      }
      pos++;
      if (pos > 1000) break; // Safety limit
    }
  }

  if (!targetPosition) {
    return res.status(400).json({ error: 'Could not find position to complete' });
  }

  const assignedTo = getTrashPerson(targetPosition);
  const result = await completeTrash(completedBy, assignedTo, targetPosition);
  res.json(result);
});

// ============ Push Notifications ============

apiRouter.get('/push/vapid-key', async (req, res) => {
  const publicKey = await getVapidPublicKey();
  res.json({ publicKey });
});

apiRouter.post('/push/subscribe', async (req, res) => {
  const { userName, subscription } = req.body;
  if (!userName || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'userName and subscription (with endpoint, keys.p256dh, keys.auth) required' });
  }
  await savePushSubscription(userName, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  res.json({ success: true });
});

apiRouter.post('/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required' });
  }
  await deletePushSubscription(endpoint);
  res.json({ success: true });
});

// ============ Chore Status ============

apiRouter.get('/chore-status', async (req, res) => {
  const today = req.query.today;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return res.status(400).json({ error: 'today query parameter required (YYYY-MM-DD format)' });
  }

  const [earliestIncomplete, lastCompleted] = await Promise.all([
    getEarliestIncompletePerChore(),
    getLastCompletedPerChore()
  ]);

  const choreNames = [...new Set([
    ...Object.keys(earliestIncomplete),
    ...Object.keys(lastCompleted)
  ])];

  const statuses = choreNames.map(name => {
    const incomplete = earliestIncomplete[name];
    const completed = lastCompleted[name];

    let status, daysOverdue = 0;

    if (!incomplete) {
      status = 'green';
    } else {
      const dueDate = new Date(incomplete.dueDate + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');
      const diffDays = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        status = 'green';
      } else if (diffDays <= 7) {
        status = 'yellow';
        daysOverdue = diffDays;
      } else {
        status = 'red';
        daysOverdue = diffDays;
      }
    }

    return {
      choreName: name,
      status,
      daysOverdue,
      currentlyDue: incomplete ? {
        assignedTo: incomplete.assignedTo,
        dueDate: incomplete.dueDate
      } : null,
      lastCompleted: completed ? {
        completedBy: completed.completedBy,
        completedAt: completed.completedAt
      } : null
    };
  });

  statuses.sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return order[a.status] - order[b.status];
  });

  res.json(statuses);
});

// ============ Home ============

apiRouter.get('/home', async (req, res) => {
  const user = req.query.user;
  const today = req.query.today; // YYYY-MM-DD format (user's local date)
  if (!user) {
    return res.status(400).json({ error: 'user query parameter required' });
  }
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return res.status(400).json({ error: 'today query parameter required (YYYY-MM-DD format)' });
  }

  const earliestIncomplete = await getEarliestIncompletePerChore();
  const rawDue = await getChoresDueForUser(user, today);
  const rawUpcoming = await getChoresUpcomingForUser(user, today);

  // Filter out skipped chores from due list (upcoming ones still have time)
  const due = rawDue.filter(chore => {
    const earliest = earliestIncomplete[chore.choreName];
    return !earliest || earliest.dueDate >= chore.dueDate;
  });
  const upcoming = rawUpcoming;

  // Check trash status for this user
  const trashState = await getTrashState();
  const completedPositions = await getCompletedPositions();
  const votes = await getTrashVotes();

  // Find the actual next-up position (lowest incomplete)
  let nextUpPosition = 1;
  while (completedPositions[nextUpPosition]) {
    nextUpPosition++;
  }
  const currentTrashPerson = getTrashPerson(nextUpPosition);

  let trashDue = null;
  let trashUpcoming = null;

  if (currentTrashPerson === user && trashState.isFull) {
    trashDue = {
      type: 'trash',
      assignedTo: user,
      isFull: true,
      voteCount: votes.length
    };
  } else if (currentTrashPerson === user && !trashState.isFull) {
    trashUpcoming = {
      type: 'trash',
      assignedTo: user,
      isFull: false,
      label: 'You\'re next for trash duty'
    };
  }

  res.json({
    due: [...due, ...(trashDue ? [trashDue] : [])],
    upcoming: [...upcoming, ...(trashUpcoming ? [trashUpcoming] : [])]
  });
});
