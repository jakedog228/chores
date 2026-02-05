import { useState, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import { pushApi } from '../../services/api';
import { BellIcon, BellOffIcon } from '../icons/Icons';

function getStorageKey(userName) {
  return `notifications_${userName}`;
}

async function subscribeToPush(userName) {
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await pushApi.getVapidKey();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await pushApi.subscribe(userName, subscription.toJSON());
}

async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await pushApi.unsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export function NotificationToggle() {
  const { selectedUser } = useUser();
  const [enabled, setEnabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!selectedUser) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setSupported(false);
      return;
    }
    const pref = localStorage.getItem(getStorageKey(selectedUser));
    setEnabled(pref === 'granted');
  }, [selectedUser]);

  if (!supported) return null;

  const handleToggle = async () => {
    if (enabled) {
      // Turn off: unsubscribe and clear
      try {
        await unsubscribeFromPush();
      } catch (err) {
        console.error('Failed to unsubscribe from push:', err);
      }
      localStorage.setItem(getStorageKey(selectedUser), 'denied');
      setEnabled(false);
    } else {
      // Turn on: show confirmation modal
      setShowModal(true);
    }
  };

  const handleEnable = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        await subscribeToPush(selectedUser);
      } catch (err) {
        console.error('Failed to subscribe to push:', err);
      }
      localStorage.setItem(getStorageKey(selectedUser), 'granted');
      setEnabled(true);
    }
    setShowModal(false);
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  return (
    <>
      <button
        className="notification-toggle"
        onClick={handleToggle}
        title={enabled ? 'Disable notifications' : 'Enable notifications'}
      >
        {enabled ? <BellIcon /> : <BellOffIcon />}
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={handleDismiss}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <img
              src="/hypno-notifications.gif"
              alt="Enable notifications"
              style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
            />
            <div className="chore-detail-actions">
              <button className="btn-primary" onClick={handleEnable}>
                YES!!!
              </button>
              <button className="btn-secondary" onClick={handleEnable}>
                yes, but grey
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
