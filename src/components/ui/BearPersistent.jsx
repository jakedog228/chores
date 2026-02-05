import { useEffect, useState } from 'react';

export function BearPersistent({ dueChores }) {
  const [showBear, setShowBear] = useState(false);

  useEffect(() => {
    if (!dueChores) {
        setShowBear(false);
        return;
    }

    // Show bear if there is a chore that is bear-marked AND has been seen (bearScareShown = true)
    // The user said "bear-marked until that chore is completed".
    // If it's completed, it won't be in dueChores (or will be filtered out by logic in Home/App).
    // Actually, dueChores usually comes from `homeApi.get`.
    
    // We want: bearMarked && bearScareShown.
    const hasPersistentBear = dueChores.some(c => c.bearMarked && c.bearScareShown);
    setShowBear(hasPersistentBear);

  }, [dueChores]);

  if (!showBear) return null;

  return (
    <img 
        src="/bear.png" 
        className="bear-persistent" 
        alt="Watching you..." 
    />
  );
}
