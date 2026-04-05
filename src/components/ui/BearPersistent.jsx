import { useEffect, useState, useRef } from 'react';

const CREATURE_CONFIG = {
  plate: {
    image: '/dish.png',
    sound: '/plate.mp3',
    texts: ['WASH ME.', 'THE PLATE SEES ALL', '...', 'YOU CANNOT HIDE', 'DISHES.'],
    alt: 'The plate watches...'
  },
  stove: {
    image: '/stove.png',
    sound: '/Stove.m4a',
    texts: ['Hi! :)', 'You got this!', 'Clean me please?', 'Warm hugs!', 'I love you!'],
    alt: 'The stove believes in you!'
  },
  bear: {
    image: '/bear.png',
    sound: '/bear_sound.m4a',
    texts: ['BEAR!', 'BEAAAAR!', 'GRRRR!', 'RAWR!'],
    alt: 'Watching you...'
  }
};

// Priority order: plate > stove > bear
const CREATURE_PRIORITY = ['plate', 'stove', 'bear'];

function CreatureInstance({ type, index, onLoreNote }) {
  const [isShaking, setIsShaking] = useState(false);
  const [floats, setFloats] = useState([]);
  const floatIdRef = useRef(0);
  const config = CREATURE_CONFIG[type];

  const handleClick = () => {
    const audio = new Audio(config.sound);
    audio.play().catch(() => {});

    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);

    const id = floatIdRef.current++;
    const offsetX = Math.random() * 30 - 15;
    const offsetY = Math.random() * 10;
    const text = config.texts[Math.floor(Math.random() * config.texts.length)];
    setFloats(prev => [...prev, { id, offsetX, offsetY, text }]);
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== id));
    }, 1400);

    // Easter egg: plate triggers lore note
    if (type === 'plate' && onLoreNote) {
      onLoreNote();
    }
  };

  return (
    <div className="creature-persistent-item" style={{ '--creature-index': index }}>
      <img
        src={config.image}
        className={`bear-persistent ${isShaking ? 'bear-shake' : ''}`}
        alt={config.alt}
        onClick={handleClick}
        draggable={false}
      />
      {floats.map(f => (
        <div
          key={f.id}
          className="bear-roar-popup"
          style={{ bottom: `calc(100% + ${f.offsetY}px)`, right: `calc(50% + ${f.offsetX}px)` }}
        >
          <span className={`bear-roar-text creature-text-${type}`}>{f.text}</span>
        </div>
      ))}
    </div>
  );
}

function LoreNote({ dropPx, onDismiss }) {
  const [fullscreen, setFullscreen] = useState(false);

  // Note is off-screen until dropPx brings it into view
  // Image is ~100px wide, aspect ratio ~1:2, so ~200px tall
  const top = -220 + dropPx;

  if (fullscreen) {
    return (
      <div className="lorenote-fullscreen" onClick={() => { setFullscreen(false); onDismiss(); }}>
        <img src="/lorenote1.png" alt="Lore Note" className="lorenote-fullscreen-img" draggable={false} />
      </div>
    );
  }

  // Don't render if still fully off-screen
  if (top < -220) return null;

  return (
    <div
      className="lorenote-descend"
      style={{ top: `${top}px` }}
      onClick={() => setFullscreen(true)}
    >
      <img src="/lorenote1.png" alt="Lore Note" className="lorenote-img" draggable={false} />
    </div>
  );
}

export function BearPersistent({ dueChores }) {
  const [activeTypes, setActiveTypes] = useState([]);
  const [loreDropPx, setLoreDropPx] = useState(0);

  useEffect(() => {
    if (!dueChores) {
      setActiveTypes([]);
      return;
    }

    // Find all creature types that have been seen (scare shown)
    const seenTypes = new Set();
    for (const chore of dueChores) {
      if (!chore.creatures) continue;
      for (const creature of chore.creatures) {
        if (creature.scareShown) {
          seenTypes.add(creature.creatureType);
        }
      }
    }

    // Sort by priority
    const sorted = CREATURE_PRIORITY.filter(t => seenTypes.has(t));
    setActiveTypes(sorted);
  }, [dueChores]);

  if (activeTypes.length === 0) return null;

  return (
    <>
      <div className="bear-persistent-wrapper">
        {activeTypes.map((type, i) => (
          <CreatureInstance
            key={type}
            type={type}
            index={i}
            onLoreNote={() => setLoreDropPx(prev => prev + 8)}
          />
        ))}
      </div>
      {loreDropPx > 0 && <LoreNote dropPx={loreDropPx} onDismiss={() => setLoreDropPx(0)} />}
    </>
  );
}
