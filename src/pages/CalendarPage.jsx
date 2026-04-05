import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../hooks/useUser';
import { choresApi } from '../services/api';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons/Icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CREATURE_MAP = {
  'Do Dishes': { type: 'plate', emoji: '🍽️', label: 'PLATE' },
  'Clean kitchen/table': { type: 'stove', emoji: '🍳', label: 'STOVE' }
};
const DEFAULT_CREATURE = { type: 'bear', emoji: '🐻', label: 'BEAR' };

function getCreatureForChore(choreName) {
  return CREATURE_MAP[choreName] || DEFAULT_CREATURE;
}

export function CalendarPage({ onRefreshNeeded, pendingChoreOpen, onPendingChoreHandled }) {
  const { selectedUser, people } = useUser();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChore, setSelectedChore] = useState(null);
  const [showMerrimentInfo, setShowMerrimentInfo] = useState(false);
  const [showUncreatureConfirm, setShowUncreatureConfirm] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [creaturePressTimer, setCreaturePressTimer] = useState(null);

  const monthStr = `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}`;

  const fetchChores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await choresApi.getByMonth(monthStr);
      setChores(data);
    } catch (err) {
      console.error('Failed to fetch chores:', err);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  // Handle pending chore open from status panel
  useEffect(() => {
    if (!pendingChoreOpen || !chores.length) return;
    // Navigate to the correct month if needed
    if (pendingChoreOpen.year !== currentDate.year || pendingChoreOpen.month !== currentDate.month) {
      setCurrentDate({ year: pendingChoreOpen.year, month: pendingChoreOpen.month });
      return; // Will re-fetch and re-trigger this effect
    }
    const match = chores.find(c => c.choreName === pendingChoreOpen.choreName && c.dueDate === pendingChoreOpen.dueDate);
    if (match) {
      setSelectedChore(match);
    }
    onPendingChoreHandled?.();
  }, [pendingChoreOpen, chores, currentDate, onPendingChoreHandled]);

  const prevMonth = () => {
    setCurrentDate(prev => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentDate(prev => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const handleCompleteChore = async (choreId) => {
    try {
      await choresApi.complete(choreId, selectedUser);
      fetchChores();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to complete chore:', err);
    }
  };

  const handleUncompleteChore = async (choreId) => {
    try {
      await choresApi.uncomplete(choreId);
      fetchChores();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to uncomplete chore:', err);
    }
  };

  const handleForceCompleteChore = async (choreId) => {
    try {
      await choresApi.complete(choreId, selectedUser, { force: true });
      fetchChores();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to force-complete chore:', err);
    }
  };

  const handleForceUncompleteChore = async (choreId) => {
    try {
      await choresApi.uncomplete(choreId, { force: true });
      fetchChores();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to force-uncomplete chore:', err);
    }
  };

  const handleUncreature = async () => {
    if (!selectedChore) return;
    try {
      await choresApi.removeCreatures(selectedChore.id);
      fetchChores();
      onRefreshNeeded?.();
      setShowUncreatureConfirm(false);
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to remove creatures:', err);
    }
  };

  const handleCreatureDown = () => {
    const timer = setTimeout(() => {
        setShowUncreatureConfirm(true);
    }, 3000);
    setCreaturePressTimer(timer);
  };

  const handleCreatureUp = () => {
    if (creaturePressTimer) {
        clearTimeout(creaturePressTimer);
        setCreaturePressTimer(null);
    }
  };

  const handleCreatureRelease = async () => {
    if (!selectedChore) return;
    const creature = getCreatureForChore(selectedChore.choreName);
    try {
      await choresApi.addCreature(selectedChore.id, creature.type);
      const updatedChores = await choresApi.getByMonth(monthStr);
      setChores(updatedChores);
      // Keep modal open with updated data
      const updated = updatedChores.find(c => c.id === selectedChore.id);
      if (updated) setSelectedChore(updated);
      onRefreshNeeded?.();
    } catch (err) {
      console.error('Failed to release creature:', err);
    }
  };

  // Build calendar grid
  const firstDay = new Date(currentDate.year, currentDate.month - 1, 1);
  const lastDay = new Date(currentDate.year, currentDate.month, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const weeks = [];
  let currentWeek = new Array(startOffset).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // Group chores by date
  const choresByDate = {};
  for (const chore of chores) {
    const day = parseInt(chore.dueDate.split('-')[2], 10);
    if (!choresByDate[day]) choresByDate[day] = [];
    choresByDate[day].push(chore);
  }

  const today = new Date();
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  const personColorMap = {};
  for (const p of people) {
    personColorMap[p.name] = p.color;
  }

  const monthName = new Date(currentDate.year, currentDate.month - 1).toLocaleString('default', { month: 'long' });

  const merrimentData = useMemo(() => {
    if (!chores.length) return null;

    const now = new Date();
    const nowStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    const isCurrentMonth = currentDate.year === now.getFullYear()
      && currentDate.month === now.getMonth() + 1;
    const isFutureMonth = currentDate.year > now.getFullYear()
      || (currentDate.year === now.getFullYear() && currentDate.month > now.getMonth() + 1);

    if (isFutureMonth) return null;

    // Only count chores strictly before today (today's chores are still in progress)
    const relevant = isCurrentMonth
      ? chores.filter(c => c.dueDate < nowStr)
      : chores;

    const total = relevant.length;

    // First day of the current month: no past chores yet, default to 100%
    if (total === 0) return { completed: 0, skipped: 0, pardoned: 0, overdue: 0, total: 0, percent: 100 };

    const completedOnTime = relevant.filter(c => !!c.completedAt && c.completedBy !== 'skipped' && !c.skipped).length;
    const skipped = relevant.filter(c => c.skipped && c.completedBy !== 'skipped').length;
    const pardoned = relevant.filter(c => c.completedBy === 'skipped').length;
    const overdue = relevant.filter(c => !c.completedAt && !c.skipped).length;

    const percent = (completedOnTime / total * 100);

    return { completed: completedOnTime, skipped, pardoned, overdue, total, percent };
  }, [chores, currentDate]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Chore Calendar</h1>
      </div>

      <div className="calendar-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>
          <ChevronLeftIcon />
        </button>
        <span className="cal-nav-title">{monthName} {currentDate.year}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>
          <ChevronRightIcon />
        </button>
      </div>

      {loading ? (
        <div className="loading-text">Loading...</div>
      ) : (
        <div className="calendar-grid">
          <div className="calendar-header-row">
            {WEEKDAYS.map(wd => (
              <div key={wd} className="calendar-header-cell">{wd}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="calendar-week-row">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="calendar-cell empty" />;

                const dateStr = `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayChores = choresByDate[day] || [];
                const isToday = dateStr === todayStr;

                return (
                  <div key={di} className={`calendar-cell ${isToday ? 'today' : ''}`}>
                    <span className="calendar-day-number">{day}</span>
                    <div className="calendar-chores">
                      {dayChores.sort((a, b) => a.choreName.localeCompare(b.choreName)).map(chore => {
                        const isPardoned = chore.completedBy === 'skipped';
                        const isComplete = !!chore.completedAt && !isPardoned;
                        const isSkipped = chore.skipped && !isPardoned;
                        const isDue = !chore.completedAt && !chore.skipped && dateStr <= todayStr;
                        const color = personColorMap[chore.assignedTo] || '#ccc';

                        // Determine pill state class
                        let stateClass = '';
                        if (isSkipped) stateClass = 'skipped';
                        else if (isPardoned) stateClass = 'pardoned';
                        else if (isComplete) stateClass = 'complete';

                        return (
                          <button
                            key={chore.id}
                            className={`chore-pill ${stateClass} ${isDue ? 'due' : ''}`}
                            style={{ '--pill-color': color }}
                            onClick={() => setSelectedChore(chore)}
                            title={`${chore.choreName} - ${chore.assignedTo}${isSkipped ? ' (skipped)' : isPardoned ? ' (pardoned)' : ''}`}
                          >
                            <span className="chore-pill-text">
                              {shortenChore(chore.choreName)}
                              {chore.creatures && chore.creatures.length > 0 && (
                                <span style={{ marginLeft: '4px' }}>
                                  {getCreatureForChore(chore.choreName).emoji}
                                  {chore.creatures.length > 1 && `×${chore.creatures.length}`}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        {people.map(p => (
          <div key={p.name} className="legend-item">
            <span className="legend-swatch" style={{ background: p.color }} />
            <span className="legend-name">{p.name}</span>
          </div>
        ))}
      </div>

      {!loading && merrimentData && (
        <div className="merriment-row">
          <span className="merriment-label">Merriment</span>
          <span className="merriment-value">{merrimentData.percent.toFixed(1)}%</span>
          <button
            className="merriment-info-btn"
            onClick={() => { setShowMerrimentInfo(true); setExpandedTerm(null); }}
            title="What is Merriment?"
          >
            i
          </button>
        </div>
      )}

      {/* Chore detail modal */}
      {selectedChore && (
        <div className="modal-overlay" onClick={() => setSelectedChore(null)}>
          <div className="modal chore-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>{selectedChore.choreName}</h2>
                {/* Creature Button: Only for overdue, incomplete, unskipped chores */}
                {(!selectedChore.completedAt && !selectedChore.skipped && selectedChore.dueDate <= todayStr) && (() => {
                    const creature = getCreatureForChore(selectedChore.choreName);
                    const count = selectedChore.creatures?.length || 0;
                    return (
                        <button
                            className="btn-secondary"
                            style={{ fontSize: '1.2rem', padding: '4px 8px' }}
                            onClick={handleCreatureRelease}
                            onMouseDown={handleCreatureDown}
                            onMouseUp={handleCreatureUp}
                            onMouseLeave={handleCreatureUp}
                            onTouchStart={handleCreatureDown}
                            onTouchEnd={handleCreatureUp}
                            title={`Send ${creature.label}`}
                        >
                            {creature.emoji}{count > 1 && `×${count}`}
                        </button>
                    );
                })()}
            </div>
            <div className="chore-detail-info">
              <p>
                <strong>Assigned to:</strong>{' '}
                {selectedChore.skipped || selectedChore.completedBy === 'skipped' ? (
                  <span className="crossed-out">{selectedChore.assignedTo}</span>
                ) : (
                  selectedChore.assignedTo
                )}
              </p>
              <p><strong>Due:</strong> {formatDate(selectedChore.dueDate)}</p>
              {selectedChore.completedBy === 'skipped' ? (
                <p className="skipped-notice">Pardoned — someone earlier in the rotation was still overdue</p>
              ) : selectedChore.skipped ? (
                <p className="skipped-notice">
                  Skipped — {selectedChore.skippedBecause} still hasn't done theirs
                </p>
              ) : selectedChore.completedAt ? (
                <>
                  <p><strong>Completed:</strong> {formatDateTime(selectedChore.completedAt)}</p>
                  <p><strong>Marked as Completed by:</strong> {selectedChore.completedBy}</p>
                </>
              ) : null}
            </div>
            <div className="chore-detail-actions">
              {selectedChore.completedBy === 'skipped' ? (
                <button
                  className="btn-secondary"
                  onClick={() => handleForceUncompleteChore(selectedChore.id)}
                >
                  Mark Incomplete
                </button>
              ) : selectedChore.skipped ? (
                <button
                  className="btn-secondary"
                  onClick={() => handleForceCompleteChore(selectedChore.id)}
                >
                  <CheckIcon /> Mark Complete Anyway
                </button>
              ) : selectedChore.completedAt ? (
                <button
                  className="btn-secondary"
                  onClick={() => handleUncompleteChore(selectedChore.id)}
                >
                  Mark Incomplete
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => handleCompleteChore(selectedChore.id)}
                >
                  <CheckIcon /> Mark Complete
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedChore(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Un-Creature Confirmation Modal */}
      {showUncreatureConfirm && selectedChore && (() => {
        const creature = getCreatureForChore(selectedChore.choreName);
        return (
          <div className="modal-overlay" style={{ zIndex: 301 }} onClick={() => setShowUncreatureConfirm(false)}>
              <div className="modal" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <h2>UN-{creature.label}?!</h2>
                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
                      <button
                          className="btn-primary"
                          onClick={handleUncreature}
                      >
                          YES
                      </button>
                      <button
                          className="btn-secondary"
                          onClick={() => setShowUncreatureConfirm(false)}
                      >
                          NO
                      </button>
                  </div>
              </div>
          </div>
        );
      })()}

      {/* Merriment info modal */}
      {showMerrimentInfo && merrimentData && (
        <div className="modal-overlay" onClick={() => setShowMerrimentInfo(false)}>
          <div className="modal merriment-info-modal" onClick={e => e.stopPropagation()}>
            <h2>What is Merriment?</h2>
            <p className="merriment-info-desc">
              Merriment is the percentage of chores that were completed on time. It only
              counts chores from before today, since today's are still in progress.
              On the first day of the month, Merriment starts at 100%.
            </p>

            <div className="merriment-info-formula">
              <div className="merriment-formula-label">Formula</div>
              <div className="merriment-formula-expr">
                Completed On Time / Total
              </div>
              {merrimentData.total > 0 ? (
                <div className="merriment-formula-work">
                  {merrimentData.completed} / {merrimentData.total} = <strong>{merrimentData.percent.toFixed(1)}%</strong>
                </div>
              ) : (
                <div className="merriment-formula-work">
                  No chores due before today, so <strong>100.0%</strong>
                </div>
              )}
            </div>

            <div className="merriment-term-label">What counts against Merriment:</div>

            {/* Overdue collapsible */}
            <div className="merriment-collapsible">
              <button
                className={`merriment-collapsible-header ${expandedTerm === 'overdue' ? 'expanded' : ''}`}
                onClick={() => setExpandedTerm(expandedTerm === 'overdue' ? null : 'overdue')}
              >
                <span>Overdue ({merrimentData.overdue})</span>
                <ChevronRightIcon />
              </button>
              {expandedTerm === 'overdue' && (
                <div className="merriment-collapsible-content">
                  <p>
                    Chores that are still incomplete past their due date, actively
                    waiting on someone to finish them.
                  </p>
                  <p>
                    <strong>On the calendar:</strong> Overdue chores pulse with a
                    highlighted border, drawing attention to unfinished work.
                  </p>
                  <p>
                    <strong>These points are the easiest to recover! Simply completing the
                    chore restores the Merriment it took away. Pardoned and Skipped tasks,
                    on the other hand, are permanently lost since nobody can redo the
                    chores that were missed between those dates.</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Pardoned collapsible */}
            <div className="merriment-collapsible">
              <button
                className={`merriment-collapsible-header ${expandedTerm === 'pardoned' ? 'expanded' : ''}`}
                onClick={() => setExpandedTerm(expandedTerm === 'pardoned' ? null : 'pardoned')}
              >
                <span>Pardoned ({merrimentData.pardoned})</span>
                <ChevronRightIcon />
              </button>
              {expandedTerm === 'pardoned' && (
                <div className="merriment-collapsible-content">
                  <p>
                    A chore that was automatically marked as resolved, without anyone
                    actually doing it, because the rotation needed to move forward.
                  </p>
                  <p>
                    When someone completes an overdue chore, any intermediate occurrences
                    of that same chore between the overdue date and today are pardoned.
                  </p>
                  <p>
                    <strong>Example:</strong> Gabe's Dishes from last Monday is overdue.
                    Luke had Dishes on Thursday. When Gabe finally completes his, Luke's
                    Thursday assignment is automatically pardoned since the backlog is cleared.
                  </p>
                  <p>
                    <strong>On the calendar:</strong> Pardoned chores appear as faded,
                    neutral-colored pills, visually washed out compared to normal assignments.
                  </p>
                </div>
              )}
            </div>

            {/* Skipped collapsible */}
            <div className="merriment-collapsible">
              <button
                className={`merriment-collapsible-header ${expandedTerm === 'skipped' ? 'expanded' : ''}`}
                onClick={() => setExpandedTerm(expandedTerm === 'skipped' ? null : 'skipped')}
              >
                <span>Skipped ({merrimentData.skipped})</span>
                <ChevronRightIcon />
              </button>
              {expandedTerm === 'skipped' && (
                <div className="merriment-collapsible-content">
                  <p>
                    A chore that's frozen because someone earlier in the rotation
                    hasn't completed theirs yet. The rotation won't advance until
                    they catch up.
                  </p>
                  <p>
                    <strong>Example:</strong> Gabe's Dishes from Monday is still incomplete.
                    Luke is assigned Dishes on Thursday, but his assignment is skipped
                    until Gabe finishes. This way Luke isn't penalized for Gabe's delay.
                  </p>
                  <p>
                    <strong>On the calendar:</strong> Skipped chores show as neutral-colored
                    pills instead of the person's color. Clicking one shows who is blocking
                    the rotation.
                  </p>
                </div>
              )}
            </div>

            <div className="merriment-info-actions">
              <button className="btn-secondary" onClick={() => setShowMerrimentInfo(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shortenChore(name) {
  const map = {
    'Do Dishes': 'Dishes',
    'Swiffer Top Floor': 'Swiffer Top',
    'Swiffer Bottom Floor': 'Swiffer Bot',
    'Clean kitchen/table': 'Kitchen',
    'Clean Top Bathroom': 'Bath Top',
    'Clean Bottom Bathroom': 'Bath Bot'
  };
  return map[name] || name;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateTime(isoStr) {
  const date = new Date(isoStr);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}
