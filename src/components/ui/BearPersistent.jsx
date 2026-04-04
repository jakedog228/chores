import { useEffect, useState, useRef } from 'react';

export function BearPersistent({ dueChores }) {
  const [showBear, setShowBear] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [roars, setRoars] = useState([]);
  const roarIdRef = useRef(0);

  useEffect(() => {
    if (!dueChores) {
      setShowBear(false);
      return;
    }
    const hasPersistentBear = dueChores.some(c => c.bearMarked && c.bearScareShown);
    setShowBear(hasPersistentBear);
  }, [dueChores]);

  const handleClick = () => {
    // Play bear sound (new Audio each time for spammability)
    const audio = new Audio('/bear_sound.m4a');
    audio.play().catch(() => {});

    // Trigger shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);

    // Spawn floating text with random offset
    const id = roarIdRef.current++;
    const offsetX = Math.random() * 40 - 10;
    const offsetY = Math.random() * 10;
    const texts = ['BEAR!', 'BEAAAAR!', 'GRRRR!', 'RAWR!'];
    const text = texts[Math.floor(Math.random() * texts.length)];
    setRoars(prev => [...prev, { id, offsetX, offsetY, text }]);
    setTimeout(() => {
      setRoars(prev => prev.filter(r => r.id !== id));
    }, 1400);
  };

  if (!showBear) return null;

  return (
    <div className="bear-persistent-wrapper">
      <img
        src="/bear.png"
        className={`bear-persistent ${isShaking ? 'bear-shake' : ''}`}
        alt="Watching you..."
        onClick={handleClick}
        draggable={false}
      />

      {roars.map(r => (
        <div
          key={r.id}
          className="bear-roar-popup"
          style={{ right: `calc(80% + ${r.offsetX}px)`, bottom: `calc(100% + ${r.offsetY}px)` }}
        >
          <span className="bear-roar-text">{r.text}</span>
        </div>
      ))}
    </div>
  );
}
