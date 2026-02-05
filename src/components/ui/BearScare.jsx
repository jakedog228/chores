import { useEffect, useState, useRef, useCallback } from 'react';
import { choresApi } from '../../services/api';

export function BearScare({ dueChores, onScareComplete }) {
  const [isActive, setIsActive] = useState(false);
  const [texts, setTexts] = useState([]);
  const [showBear, setShowBear] = useState(false);
  const audioRef = useRef(null);
  const processedRef = useRef(new Set());
  const isScaringRef = useRef(false);
  const pendingChoreRef = useRef(null);

  const triggerScare = useCallback((chore) => {
    if (isScaringRef.current) return;
    isScaringRef.current = true;
    pendingChoreRef.current = null;
    setIsActive(true);

    const interval = setInterval(() => {
        const showBear = Math.random() > 0.3;
        setShowBear(showBear);

        const phrases = ['BEAR!', 'BEAAAAR!!!', "IT'S A BEAAR!!!"];
        const count = Math.floor(Math.random() * 3) + 1;
        const newTexts = Array.from({ length: count }).map((_, i) => ({
            id: i,
            text: phrases[Math.floor(Math.random() * phrases.length)],
            top: Math.random() * 80 + 10 + '%',
            left: Math.random() * 80 + 10 + '%',
            rotation: Math.random() * 60 - 30 + 'deg'
        }));
        setTexts(newTexts);
    }, 100);

    const finishScare = async () => {
        clearInterval(interval);
        if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        setIsActive(false);
        setShowBear(false);
        setTexts([]);
        isScaringRef.current = false;

        try {
            await choresApi.bearSeen(chore.id);
            onScareComplete?.();
        } catch (e) {
            console.error("Failed to ack bear", e);
        }
    };

    try {
        if (!audioRef.current) {
            audioRef.current = new Audio('/bear_sound.m4a');
        }
        audioRef.current.volume = 1.0;
        audioRef.current.currentTime = 0;
        audioRef.current.onended = finishScare;
        audioRef.current.play().catch(e => {
            console.warn("Audio play failed:", e);
            setTimeout(finishScare, 3000);
        });
    } catch (e) {
        console.warn("Audio setup failed", e);
        setTimeout(finishScare, 3000);
    }
  }, [onScareComplete]);

  useEffect(() => {
    if (!dueChores) return;

    const targetChore = dueChores.find(
      c => c.bearMarked && !c.bearScareShown && !processedRef.current.has(c.id)
    );

    if (!targetChore) return;
    processedRef.current.add(targetChore.id);

    // Preload the audio
    if (!audioRef.current) {
      audioRef.current = new Audio('/bear_sound.m4a');
    }

    // Try playing immediately — this will succeed if the browser
    // already trusts us (MEI score, prior interaction, etc.)
    const probe = audioRef.current.play();
    if (probe !== undefined) {
      probe.then(() => {
        // Audio started — we have permission. Stop the probe and run the real scare.
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        triggerScare(targetChore);
      }).catch(() => {
        // Blocked by autoplay policy. Wait for the user's next natural
        // interaction, then ambush them.
        pendingChoreRef.current = targetChore;
        const onInteraction = () => {
          document.removeEventListener('click', onInteraction, true);
          document.removeEventListener('touchstart', onInteraction, true);
          document.removeEventListener('keydown', onInteraction, true);
          if (pendingChoreRef.current) {
            triggerScare(pendingChoreRef.current);
          }
        };
        document.addEventListener('click', onInteraction, true);
        document.addEventListener('touchstart', onInteraction, true);
        document.addEventListener('keydown', onInteraction, true);
      });
    }

    return () => {
      // Cleanup listeners if component unmounts while waiting
      pendingChoreRef.current = null;
    };
  }, [dueChores, triggerScare]);

  if (!isActive) return null;

  return (
    <div className="bear-scare-overlay">
      <img
        src="/bear.png"
        className="bear-image"
        alt="BEAR"
        style={{ opacity: showBear ? 1 : 0 }}
      />
      {texts.map((t) => (
        <div
            key={t.id}
            className="bear-text"
            style={{
                top: t.top,
                left: t.left,
                transform: `translate(-50%, -50%) rotate(${t.rotation})`
            }}
        >
            {t.text}
        </div>
      ))}
    </div>
  );
}
