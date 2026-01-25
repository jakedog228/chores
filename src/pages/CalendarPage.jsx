import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { choresApi } from '../services/api';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons/Icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarPage() {
  const { selectedUser, people } = useUser();
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChore, setSelectedChore] = useState(null);

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
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to complete chore:', err);
    }
  };

  const handleUncompleteChore = async (choreId) => {
    try {
      await choresApi.uncomplete(choreId);
      fetchChores();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to uncomplete chore:', err);
    }
  };

  const handleForceCompleteChore = async (choreId) => {
    try {
      await choresApi.complete(choreId, selectedUser, { force: true });
      fetchChores();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to force-complete chore:', err);
    }
  };

  const handleForceUncompleteChore = async (choreId) => {
    try {
      await choresApi.uncomplete(choreId, { force: true });
      fetchChores();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to force-uncomplete chore:', err);
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
  const todayStr = today.toISOString().split('T')[0];

  const personColorMap = {};
  for (const p of people) {
    personColorMap[p.name] = p.color;
  }

  const monthName = new Date(currentDate.year, currentDate.month - 1).toLocaleString('default', { month: 'long' });

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
                        const isPermanentlySkipped = chore.completedBy === 'skipped';
                        const isComplete = !!chore.completedAt && !isPermanentlySkipped;
                        const isSkipped = chore.skipped || isPermanentlySkipped;
                        const isDue = !chore.completedAt && !chore.skipped && dateStr <= todayStr;
                        const color = personColorMap[chore.assignedTo] || '#ccc';

                        return (
                          <button
                            key={chore.id}
                            className={`chore-pill ${isComplete || isSkipped ? 'complete' : ''} ${isDue ? 'due' : ''}`}
                            style={{ '--pill-color': color }}
                            onClick={() => setSelectedChore(chore)}
                            title={`${chore.choreName} - ${chore.assignedTo}${isSkipped ? ' (skipped)' : ''}`}
                          >
                            <span className="chore-pill-text">{shortenChore(chore.choreName)}</span>
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

      {/* Chore detail modal */}
      {selectedChore && (
        <div className="modal-overlay" onClick={() => setSelectedChore(null)}>
          <div className="modal chore-modal" onClick={e => e.stopPropagation()}>
            <h2>{selectedChore.choreName}</h2>
            <div className="chore-detail-info">
              <p><strong>Assigned to:</strong> {selectedChore.assignedTo}</p>
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
    </div>
  );
}

function shortenChore(name) {
  const map = {
    'Do Dishes': 'Dishes',
    'Swiffer Top Floor': 'Swiffer Top',
    'Swiffer Bottom Floor': 'Swiffer Bottom',
    'Clean kitchen/table': 'Kitchen',
    'Clean Top Bathroom': 'Bath Top',
    'Clean Bottom Bathroom': 'Bath Bottom'
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
