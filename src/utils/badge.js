export const isBadgeSupported = () => {
  return typeof navigator !== 'undefined' &&
         typeof navigator.setAppBadge === 'function';
};

export const setAppBadge = async (count) => {
  if (!isBadgeSupported()) return;

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    console.debug('Failed to set app badge:', error);
  }
};
