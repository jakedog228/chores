import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { homeApi, choresApi, trashApi } from '../services/api';
import { CheckIcon, AlertIcon } from '../components/icons/Icons';

const CREATURE_EMOJI = { 'Do Dishes': '🍽️', 'Clean kitchen/table': '🍳' };
function getCreatureEmoji(choreName) {
  return CREATURE_EMOJI[choreName] || '🐻';
}

export function HomePage({ onRefreshNeeded }) {
  const { selectedUser } = useUser();
  const [data, setData] = useState({ due: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [selectedChore, setSelectedChore] = useState(null);

  const fetchData = useCallback(async () => {
    if (!selectedUser) return;
    try {
      const result = await homeApi.get(selectedUser);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch home data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleCompleteChore = async (choreId) => {
    try {
      await choresApi.complete(choreId, selectedUser);
      fetchData();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to complete chore:', err);
    }
  };

  const handleUncompleteChore = async (choreId) => {
    try {
      await choresApi.uncomplete(choreId);
      fetchData();
      onRefreshNeeded?.();
      setSelectedChore(null);
    } catch (err) {
      console.error('Failed to uncomplete chore:', err);
    }
  };

  const handleCompleteTrash = async () => {
    try {
      await trashApi.complete(selectedUser);
      fetchData();
      onRefreshNeeded?.();
    } catch (err) {
      console.error('Failed to complete trash:', err);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Home</h1>
        </div>
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  const hasDue = data.due.length > 0;
  const hasUpcoming = data.upcoming.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Home</h1>
        <p className="subtitle">Hi, {selectedUser}</p>
      </div>

      {hasDue && (
        <section className="home-section">
          <h2 className="home-section-title due">
            <AlertIcon />
            Due Now
          </h2>
          <div className="home-items">
            {data.due.map((item, idx) => (
              <div
                key={item.id || `trash-${idx}`}
                className="home-item due"
                style={item.type !== 'trash' ? { cursor: 'pointer' } : undefined}
                onClick={item.type !== 'trash' ? () => setSelectedChore(item) : undefined}
              >
                {item.type === 'trash' ? (
                  <>
                    <button
                      className="home-checkbox"
                      onClick={handleCompleteTrash}
                      title="Mark as done"
                    />
                    <div className="home-item-content">
                      <span className="home-item-name">Take out the trash</span>
                      <span className="home-item-meta">
                        {item.voteCount} {item.voteCount === 1 ? 'person thinks' : 'people think'} it's full
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="home-item-content">
                      <span className="home-item-name">
                        {item.choreName}
                        {item.creatures && item.creatures.length > 0 && (
                          <span style={{ marginLeft: '6px' }}>
                            {getCreatureEmoji(item.choreName)}
                            {item.creatures.length > 1 && `×${item.creatures.length}`}
                          </span>
                        )}
                      </span>
                      <span className="home-item-meta">Due {formatDueDate(item.dueDate)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {hasUpcoming && (
        <section className="home-section">
          <h2 className="home-section-title upcoming">Upcoming</h2>
          <div className="home-items">
            {data.upcoming.map((item, idx) => (
              <div
                key={item.id || `trash-upcoming-${idx}`}
                className="home-item upcoming"
                style={item.type !== 'trash' ? { cursor: 'pointer' } : undefined}
                onClick={item.type !== 'trash' ? () => setSelectedChore(item) : undefined}
              >
                {item.type === 'trash' ? (
                  <>
                    <div className="home-checkbox-placeholder" />
                    <div className="home-item-content">
                      <span className="home-item-name">{item.label}</span>
                      <span className="home-item-meta">Waiting for trash to be full</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="home-item-content">
                      <span className="home-item-name">{item.choreName}</span>
                      <span className="home-item-meta">Due {formatDueDate(item.dueDate)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasDue && !hasUpcoming && (
        <div className="empty-state">
          <p className="empty-message">All caught up! No chores due.</p>
        </div>
      )}

      {selectedChore && (
        <div className="modal-overlay" onClick={() => setSelectedChore(null)}>
          <div className="modal chore-modal" onClick={e => e.stopPropagation()}>
            <h2>{selectedChore.choreName}</h2>
            <div className="chore-detail-info">
              <p><strong>Assigned to:</strong> {selectedChore.assignedTo}</p>
              <p><strong>Due:</strong> {formatDate(selectedChore.dueDate)}</p>
              {selectedChore.completedAt && (
                <>
                  <p><strong>Completed:</strong> {formatDateTime(selectedChore.completedAt)}</p>
                  <p><strong>Completed by:</strong> {selectedChore.completedBy}</p>
                </>
              )}
            </div>
            <div className="chore-detail-actions">
              {selectedChore.completedAt ? (
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

function formatDueDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((date - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

