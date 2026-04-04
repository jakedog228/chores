import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { choresApi } from '../../services/api';

function getLocalDate() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}

function getCurrentMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function computeMerriment(chores) {
  if (!chores.length) return 100;

  const nowStr = getLocalDate();
  const relevant = chores.filter(c => c.dueDate < nowStr);
  const total = relevant.length;

  if (total === 0) return 100;

  const completedOnTime = relevant.filter(
    c => !!c.completedAt && c.completedBy !== 'skipped' && !c.skipped
  ).length;

  return (completedOnTime / total) * 100;
}

function getSantaImage(percent) {
  if (percent < 20) return '/santa with gun.png';
  if (percent < 40) return '/santa anger.png';
  if (percent < 60) return '/santa surpirse.png';
  if (percent < 80) return '/santa content.png';
  return '/santa very happy.png';
}

function getSantaMood(percent) {
  if (percent < 20) return "Deck my balls.";
  if (percent < 40) return "It's a lost Clause.";
  if (percent < 60) return 'Just in the Nick of time!';
  if (percent < 80) return 'No gift like the present!';
  return "YOU'RE GONNA RIDE MY SLEIGH TONIGHT";
}

export function SantaPersistent() {
  const [chores, setChores] = useState(null);
  const [hohos, setHohos] = useState([]);
  const [isShaking, setIsShaking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const audioRef = useRef(null);
  const hohoIdRef = useRef(0);
  const badgeTimeoutRef = useRef(null);

  // Fetch current month's chores
  const fetchChores = useCallback(() => {
    choresApi.getByMonth(getCurrentMonth())
      .then(setChores)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchChores();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchChores();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('chores-updated', fetchChores);

    // Refresh every 5 minutes
    const interval = setInterval(fetchChores, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('chores-updated', fetchChores);
      clearInterval(interval);
    };
  }, [fetchChores]);

  const loaded = chores !== null;
  const merriment = useMemo(() => loaded ? computeMerriment(chores) : 0, [chores, loaded]);
  const santaImage = getSantaImage(merriment);
  const mood = getSantaMood(merriment);
  const isChristmasMode = loaded && merriment >= 80;

  // Apply/remove Christmas theme
  useEffect(() => {
    if (isChristmasMode) {
      document.documentElement.classList.add('christmas-mode');
    } else {
      document.documentElement.classList.remove('christmas-mode');
    }
    return () => document.documentElement.classList.remove('christmas-mode');
  }, [isChristmasMode]);

  const handleClick = () => {
    // Play Ho Ho Ho sound (new Audio each time for overlap)
    const audio = new Audio('/hohoho.mp3');
    audio.play().catch(() => {});

    // Trigger shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);

    // Spawn a new floating Ho Ho Ho with slight random offset
    const id = hohoIdRef.current++;
    const offsetX = Math.random() * 40 - 10;
    const offsetY = Math.random() * 10;
    const texts = ['Ho Ho Ho!', 'HOHOHO!', 'Yum...', "I'm literally Santa!", 'mmm beards...', mood];
    const text = texts[Math.floor(Math.random() * texts.length)];
    setHohos(prev => [...prev, { id, offsetX, offsetY, text }]);
    setTimeout(() => {
      setHohos(prev => prev.filter(h => h.id !== id));
    }, 1400);

    // Show merriment badge for 5s after last click
    setShowBadge(true);
    if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    badgeTimeoutRef.current = setTimeout(() => setShowBadge(false), 5000);
  };

  const merrimentColor = merriment >= 80 ? '#2ecc40' : merriment >= 60 ? '#a3d977' : merriment >= 40 ? '#ffdc00' : merriment >= 20 ? '#ff851b' : '#ff4136';

  if (!loaded) return null;

  return (
    <>
      <div className="santa-persistent-wrapper">
        {/* Santa image */}
        <img
          src={santaImage}
          className={`santa-persistent ${isShaking ? 'santa-shake' : ''} ${isChristmasMode ? 'santa-glow' : ''}`}
          alt={`Santa is ${mood}`}
          onClick={handleClick}
          draggable={false}
        />

        {/* Ho Ho Ho popups */}
        {hohos.map(h => (
          <div
            key={h.id}
            className="santa-hoho-popup"
            style={{ left: `calc(80% + ${h.offsetX}px)`, bottom: `calc(100% + ${h.offsetY}px)` }}
          >
            <span className="santa-hoho-text">{h.text}</span>
          </div>
        ))}

        {/* Merriment badge - shown for 5s after click */}
        {showBadge && (
          <button
            className="santa-merriment-badge"
            onClick={() => setShowTooltip(t => !t)}
            style={{ '--merriment-color': merrimentColor }}
            title={`Merriment: ${Math.round(merriment)}%`}
          >
            <svg className="santa-merriment-ring" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke={merrimentColor}
                strokeWidth="3"
                strokeDasharray={`${merriment} ${100 - merriment}`}
                strokeDashoffset="25"
                strokeLinecap="round"
                className="santa-merriment-progress"
              />
            </svg>
            <span className="santa-merriment-text">{Math.round(merriment)}</span>
          </button>
        )}

        {showTooltip && showBadge && (
          <div className="santa-tooltip" onClick={() => setShowTooltip(false)}>
            <div className="santa-tooltip-mood">{mood}</div>
            <div className="santa-tooltip-percent">{Math.round(merriment)}% Merriment</div>
          </div>
        )}
      </div>
    </>
  );
}
