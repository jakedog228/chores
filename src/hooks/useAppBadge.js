import { useEffect } from 'react';
import { isBadgeSupported, setAppBadge } from '../utils/badge';

export function useAppBadge(dueCount) {
  const isSupported = isBadgeSupported();

  useEffect(() => {
    if (!isSupported) return;
    setAppBadge(dueCount);
  }, [dueCount, isSupported]);

  return { isSupported };
}
