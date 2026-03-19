/**
 * Push notification service for Dugout IQ
 * 
 * Handles push notification registration on native platforms.
 * No-ops on web (web push handled separately via service worker if needed).
 * 
 * Usage:
 *   import { initPushNotifications } from '../services/notifications';
 *   // Call once after user logs in:
 *   const token = await initPushNotifications();
 *   // Store token in Firestore for server-side sends
 */

import { isNative } from './platform';

let PushNotifications = null;

async function getPush() {
  if (PushNotifications) return PushNotifications;
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/push-notifications');
    PushNotifications = mod.PushNotifications;
    return PushNotifications;
  } catch {
    return null;
  }
}

/**
 * Initialize push notifications on native platforms.
 * Requests permission, registers with APNs/FCM, and returns the device token.
 * 
 * @param {Object} callbacks
 * @param {Function} callbacks.onToken - called with the FCM/APNs token string
 * @param {Function} callbacks.onNotification - called when a notification is received while app is open
 * @param {Function} callbacks.onAction - called when user taps a notification
 * @returns {Promise<string|null>} the device token, or null on web/failure
 */
export async function initPushNotifications({ onToken, onNotification, onAction } = {}) {
  const push = await getPush();
  if (!push) return null;

  try {
    // Check / request permission
    let permission = await push.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await push.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      console.log('Push permission not granted');
      return null;
    }

    // Listen for registration success
    let resolveToken;
    const tokenPromise = new Promise((resolve) => { resolveToken = resolve; });

    push.addListener('registration', (token) => {
      console.log('Push token:', token.value);
      if (onToken) onToken(token.value);
      resolveToken(token.value);
    });

    push.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      resolveToken(null);
    });

    // Listen for notifications received while app is in foreground
    push.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
      if (onNotification) onNotification(notification);
    });

    // Listen for notification tap (user opened a notification)
    push.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action:', action);
      if (onAction) onAction(action);
    });

    // Register with Apple/Google
    await push.register();

    // Wait for the token (with timeout)
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
    return await Promise.race([tokenPromise, timeout]);

  } catch (err) {
    console.error('Push init error:', err);
    return null;
  }
}

/**
 * Remove all push notification listeners.
 * Call on logout.
 */
export async function cleanupPushNotifications() {
  const push = await getPush();
  if (push) {
    try { await push.removeAllListeners(); } catch {}
  }
}
