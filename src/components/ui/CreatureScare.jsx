import { useEffect, useState, useRef, useCallback } from 'react';
import { choresApi } from '../../services/api';

const CREATURE_CONFIG = {
  bear: {
    image: '/bear.png',
    sound: '/bear_sound.m4a',
    phrases: ['BEAR!', 'BEAAAAR!!!', "IT'S A BEAAR!!!"]
  },
  plate: {
    image: '/dish.png',
    sound: '/plate.mp3',
    phrases: ['THE PLATE HUNGERS', 'YOU CANNOT ESCAPE', 'WASH ME.', '...', 'DISHES.']
  },
  stove: {
    image: '/stove.png',
    sound: '/Stove.m4a',
    phrases: ['Hi friend!', 'Cook something nice!', 'Warm hugs!', 'Clean me please? :)', 'I believe in you!']
  }
};

export function CreatureScare({ dueChores, onScareComplete }) {
  const [isActive, setIsActive] = useState(false);
  const [texts, setTexts] = useState([]);
  const [visibleCreatures, setVisibleCreatures] = useState([]);
  const lastCreatureKeyRef = useRef('');
  const isScaringRef = useRef(false);
  const pendingRef = useRef(null);
  const audiosRef = useRef([]);

  const triggerScare = useCallback((choreCreatures) => {
    if (isScaringRef.current) return;
    isScaringRef.current = true;
    pendingRef.current = null;
    setIsActive(true);

    // Build list of all individual creatures (preserving duplicates)
    const allCreatures = choreCreatures.flatMap(cc => cc.creatures.map(c => c.creatureType));
    const uniqueTypes = [...new Set(allCreatures)];

    const interval = setInterval(() => {
      const instances = allCreatures.map((type, i) => ({
        key: i,
        type,
        show: Math.random() > 0.3,
        left: Math.random() * 80 + 10,
        top: Math.random() * 60 + 10,
      }));
      setVisibleCreatures(instances);

      const count = Math.floor(Math.random() * 3) + 1;
      const allPhrases = uniqueTypes.flatMap(t => CREATURE_CONFIG[t]?.phrases || []);
      const newTexts = Array.from({ length: count }).map((_, i) => ({
        id: i,
        text: allPhrases[Math.floor(Math.random() * allPhrases.length)],
        top: Math.random() * 80 + 10 + '%',
        left: Math.random() * 80 + 10 + '%',
        rotation: Math.random() * 60 - 30 + 'deg',
        type: uniqueTypes[Math.floor(Math.random() * uniqueTypes.length)]
      }));
      setTexts(newTexts);
    }, 100);

    const finishScare = async () => {
      clearInterval(interval);
      for (const audio of audiosRef.current) {
        audio.onended = null;
        audio.pause();
        audio.currentTime = 0;
      }
      audiosRef.current = [];

      setIsActive(false);
      setVisibleCreatures([]);
      setTexts([]);
      isScaringRef.current = false;

      try {
        await Promise.all(
          choreCreatures.map(cc => choresApi.creaturesSeen(cc.choreId))
        );
        onScareComplete?.();
      } catch (e) {
        console.error("Failed to ack creatures", e);
      }
    };

    let endedCount = 0;
    const totalSounds = uniqueTypes.length;
    let hasFinished = false;

    for (const type of uniqueTypes) {
      const config = CREATURE_CONFIG[type];
      if (!config) continue;
      try {
        const audio = new Audio(config.sound);
        audio.volume = 1.0;
        audio.onended = () => {
          endedCount++;
          if (endedCount >= totalSounds && !hasFinished) {
            hasFinished = true;
            finishScare();
          }
        };
        audiosRef.current.push(audio);
        audio.play().catch(() => {});
      } catch (e) {
        endedCount++;
      }
    }

    setTimeout(() => {
      if (!hasFinished) {
        hasFinished = true;
        finishScare();
      }
    }, 5000);
  }, [onScareComplete]);

  useEffect(() => {
    if (!dueChores) return;

    // Find all chores with unseen creatures
    const choreCreatures = dueChores
      .filter(c => c.creatures && c.creatures.length > 0)
      .map(c => ({
        choreId: c.id,
        creatures: c.creatures.filter(cr => !cr.scareShown)
      }))
      .filter(cc => cc.creatures.length > 0);

    if (choreCreatures.length === 0) {
      pendingRef.current = null;
      return;
    }

    // Build a key from all unseen creature IDs to detect new ones
    const creatureKey = choreCreatures
      .flatMap(cc => cc.creatures.map(c => c.id))
      .sort()
      .join(',');

    // Skip if we've already processed this exact set
    if (creatureKey === lastCreatureKeyRef.current) return;
    lastCreatureKeyRef.current = creatureKey;

    // Try playing immediately
    const probe = new Audio(CREATURE_CONFIG.bear.sound);
    const probeResult = probe.play();
    if (probeResult !== undefined) {
      probeResult.then(() => {
        probe.pause();
        probe.currentTime = 0;
        triggerScare(choreCreatures);
      }).catch(() => {
        // Blocked by autoplay — silently intercept first interaction
        pendingRef.current = choreCreatures;
        const onInteraction = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          document.removeEventListener('click', onInteraction, true);
          document.removeEventListener('touchstart', onInteraction, true);
          document.removeEventListener('keydown', onInteraction, true);
          if (pendingRef.current) {
            triggerScare(pendingRef.current);
          }
        };
        document.addEventListener('click', onInteraction, true);
        document.addEventListener('touchstart', onInteraction, true);
        document.addEventListener('keydown', onInteraction, true);
      });
    }

    return () => {
      pendingRef.current = null;
    };
  }, [dueChores, triggerScare]);

  if (!isActive) return null;

  const textColor = (type) => {
    if (type === 'plate') return '#8B0000';
    if (type === 'stove') return '#FF8C00';
    return 'red';
  };

  const instances = Array.isArray(visibleCreatures) ? visibleCreatures : [];

  return (
    <div className="bear-scare-overlay">
      {instances.map(inst => (
        <img
          key={inst.key}
          src={CREATURE_CONFIG[inst.type]?.image}
          className="bear-image"
          alt={inst.type}
          style={{
            opacity: inst.show ? 1 : 0,
            position: 'absolute',
            left: `${inst.left}%`,
            top: `${inst.top}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
      {texts.map((t) => (
        <div
          key={t.id}
          className="bear-text"
          style={{
            top: t.top,
            left: t.left,
            transform: `translate(-50%, -50%) rotate(${t.rotation})`,
            color: textColor(t.type)
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
