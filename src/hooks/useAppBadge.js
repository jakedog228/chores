import { useEffect, useRef } from 'react';
import { isBadgeSupported, setAppBadge } from '../utils/badge';

export function useAppBadge(dueCount) {
  const isSupported = isBadgeSupported();
  const countRef = useRef(dueCount);
  countRef.current = dueCount;

  useEffect(() => {
    if (!isSupported) return;

    setAppBadge(dueCount);

    // Delayed re-set to handle iOS PWA startup timing
    const timeout = setTimeout(() => {
      setAppBadge(countRef.current);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [dueCount, isSupported]);

  return { isSupported };
}
