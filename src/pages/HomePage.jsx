import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { homeApi, choresApi, trashApi } from '../services/api';
import { CheckIcon, AlertIcon } from '../components/icons/Icons';

export function HomePage({ onRefreshNeeded }) {
  const { selectedUser } = useUser();
  const [data, setData] = useState({ due: [], upcoming: [] });
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      console.error('Failed to complete chore:', err);
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
              <div key={item.id || `trash-${idx}`} className="home-item due">
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
                    <button
                      className="home-checkbox"
                      onClick={() => handleCompleteChore(item.id)}
                      title="Mark as done"
                    />
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

      {hasUpcoming && (
        <section className="home-section">
          <h2 className="home-section-title upcoming">Upcoming</h2>
          <div className="home-items">
            {data.upcoming.map((item, idx) => (
              <div key={item.id || `trash-upcoming-${idx}`} className="home-item upcoming">
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
                    <button
                      className="home-checkbox"
                      onClick={() => handleCompleteChore(item.id)}
                      title="Complete ahead of time"
                    />
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
    </div>
  );
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
