import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { trashApi } from '../services/api';
import { CheckIcon } from '../components/icons/Icons';

export function TrashPage() {
  const { selectedUser, people } = useUser();
  const [trashData, setTrashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const fetchTrash = useCallback(async () => {
    try {
      const data = await trashApi.getState();
      setTrashData(data);
    } catch (err) {
      console.error('Failed to fetch trash data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleVoteFull = async () => {
    try {
      await trashApi.voteFull(selectedUser);
      fetchTrash();
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleRevokeVote = async () => {
    try {
      await trashApi.revokeVote(selectedUser);
      fetchTrash();
    } catch (err) {
      console.error('Failed to revoke vote:', err);
    }
  };

  const handleComplete = async (position) => {
    try {
      await trashApi.complete(selectedUser, position);
      fetchTrash();
      setSelectedSlot(null);
    } catch (err) {
      console.error('Failed to complete trash:', err);
    }
  };

  if (loading || !trashData) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Trash Duty</h1>
        </div>
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  const personColorMap = {};
  for (const p of people) {
    personColorMap[p.name] = p.color;
  }

  const hasVoted = trashData.voters.includes(selectedUser);
  const nextUpColor = personColorMap[trashData.nextUpPerson] || '#ccc';

  return (
    <div className="page trash-page">
      <div className="page-header">
        <h1>Trash Duty</h1>
      </div>

      {/* Next up highlight */}
      <div className="trash-next-up" style={{ '--next-up-color': nextUpColor }}>
        <div className="trash-next-up-label">Next Up</div>
        <div className="trash-next-up-name">{trashData.nextUpPerson}</div>
        {trashData.isFull && (
          <div className="trash-full-badge">
            Trash is full! ({trashData.voteCount} {trashData.voteCount === 1 ? 'vote' : 'votes'})
          </div>
        )}
      </div>

      {/* Scrollable queue */}
      <div className="trash-queue-container">
        <h2 className="queue-section-title">Queue</h2>
        <div className="trash-queue-scroll">
          {trashData.queue.map(slot => {
            const isCompleted = !!slot.completedAt;
            const isNextUp = slot.position === trashData.nextUpPosition;
            const color = personColorMap[slot.assignedTo] || '#ccc';

            return (
              <button
                key={slot.position}
                className={`queue-slot ${isCompleted ? 'completed' : ''} ${isNextUp ? 'next-up' : ''}`}
                style={{ '--slot-color': color }}
                onClick={() => setSelectedSlot(slot)}
              >
                <span className="queue-slot-position">#{slot.position}</span>
                <span className="queue-slot-name">{slot.assignedTo}</span>
                {isCompleted && <CheckIcon />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="trash-bottom-actions">
        {hasVoted ? (
          <button className="btn-revoke-vote" onClick={handleRevokeVote}>
            Revoke My Vote
          </button>
        ) : (
          <button className="btn-vote-full" onClick={handleVoteFull}>
            Mark Trash as Full
          </button>
        )}
      </div>

      {/* Slot detail modal */}
      {selectedSlot && (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Trash Duty #{selectedSlot.position}</h2>
            <div className="chore-detail-info">
              <p><strong>Assigned to:</strong> {selectedSlot.assignedTo}</p>
              {selectedSlot.completedAt ? (
                <>
                  <p><strong>Completed:</strong> {formatDateTime(selectedSlot.completedAt)}</p>
                  <p><strong>Marked as Completed by:</strong> {selectedSlot.completedBy}</p>
                </>
              ) : (
                <p className="slot-pending">Not yet completed</p>
              )}
            </div>
            <div className="chore-detail-actions">
              {!selectedSlot.completedAt && (
                <button
                  className="btn-primary"
                  onClick={() => handleComplete(selectedSlot.position)}
                >
                  <CheckIcon /> Mark Complete
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedSlot(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(isoStr) {
  const date = new Date(isoStr);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}
