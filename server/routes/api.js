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
  getEarliestIncompletePerChore,
  getTrashState,
  getTrashVotes,
  addTrashVote,
  removeTrashVote,
  completeTrash,
  getCompletedPositions,
  getTrashHistory
} from '../storage.js';

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
