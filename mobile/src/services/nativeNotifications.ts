import { Platform } from 'react-native';
import { AppNotification } from '../types';

let isHandlerConfigured = false;
let _notificationsModule: any = null;
let _hasAttemptedLoad = false;
const activeWebNotifications = new Map<string, any>();

/**
 * Safely and lazily acquire the expo-notifications module.
 * If the native module is unavailable (e.g. in certain Expo Go environments),
 * it returns null instead of throwing an unhandled exception that causes an infinite reload loop.
 */
function getNotificationsModule(): any {
  if (_hasAttemptedLoad) return _notificationsModule;
  _hasAttemptedLoad = true;
  if (Platform.OS === 'web') return null;

  try {
    // Dynamic require inside a try-catch so static module evaluation never throws on startup
    const mod = require('expo-notifications');
    _notificationsModule = mod;
  } catch (err) {
    console.warn('[NativeNotifications] expo-notifications unavailable in current runtime:', err);
    _notificationsModule = null;
  }
  return _notificationsModule;
}

/**
 * Configure notifications handler so notifications pop in the native notification bar
 * even when the app is in the foreground or background.
 */
export function setupNotificationHandler() {
  if (isHandlerConfigured || Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications || typeof Notifications.setNotificationHandler !== 'function') return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    isHandlerConfigured = true;
  } catch (err) {
    console.warn('[NativeNotifications] Failed to set notification handler:', err);
  }
}

/**
 * Request notification permissions and register the Android notification channel
 */
export async function requestNativeNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission().catch(() => 'default');
        return res === 'granted';
      }
    }
    return false;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  try {
    setupNotificationHandler();

    if (typeof Notifications.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }));
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
        const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
        finalStatus = status;
      }

      if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
        await Notifications.setNotificationChannelAsync('foodies-alerts', {
          name: 'Foodies Cafe Alerts',
          importance: Notifications.AndroidImportance?.MAX || 5,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#EA580C',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        }).catch(() => {});
      }

      return finalStatus === 'granted';
    }
    return false;
  } catch (err) {
    console.warn('[NativeNotifications] Permission error:', err);
    return false;
  }
}

/**
 * Present a notification in the device's native notification bar / status tray
 */
export async function presentNativeNotification(
  notif: AppNotification,
  unreadCount: number = 1
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const webNotif = new Notification(notif.title, {
          body: notif.message,
          tag: notif.id,
          icon: '/favicon.ico',
        });
        activeWebNotifications.set(notif.id, webNotif);
      } catch {}
    }
    return;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return;

  try {
    setupNotificationHandler();

    await Notifications.scheduleNotificationAsync({
      identifier: notif.id,
      content: {
        title: notif.title,
        body: notif.message,
        data: {
          notificationId: notif.id,
          orderId: notif.orderId,
          orderNumber: notif.orderNumber,
          category: notif.category,
        },
        sound: 'default',
        badge: unreadCount > 0 ? unreadCount : undefined,
        color: '#EA580C',
        priority: 'max',
      },
      trigger: null, // Shows immediately in system notification bar
    }).catch((err: any) => {
      console.warn('[NativeNotifications] Schedule error:', err);
    });
  } catch (err) {
    console.warn('[NativeNotifications] Present error:', err);
  }
}

/**
 * Dismiss a notification from the device's native notification bar when marked read
 */
export async function dismissNativeNotification(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    const webNotif = activeWebNotifications.get(id);
    if (webNotif && typeof webNotif.close === 'function') {
      webNotif.close();
      activeWebNotifications.delete(id);
    }
    return;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    if (typeof Notifications.dismissNotificationAsync === 'function') {
      await Notifications.dismissNotificationAsync(id).catch(() => {});
    }
    if (typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  } catch {}
}

/**
 * Dismiss all notifications from the device's notification bar when user clicks Mark All Read or Clear
 */
export async function dismissAllNativeNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    activeWebNotifications.forEach((n) => {
      try {
        if (n && typeof n.close === 'function') n.close();
      } catch {}
    });
    activeWebNotifications.clear();
    return;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
      await Notifications.dismissAllNotificationsAsync().catch(() => {});
    }
    if (typeof Notifications.cancelAllScheduledNotificationsAsync === 'function') {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }
    if (typeof Notifications.setBadgeCountAsync === 'function') {
      await Notifications.setBadgeCountAsync(0).catch(() => {});
    }
  } catch {}
}

/**
 * Register a listener for when a user taps a notification in the native notification bar
 */
export function addNotificationResponseListener(
  onNotificationTapped: (notifId: string) => void
): () => void {
  if (Platform.OS === 'web') return () => {};
  const Notifications = getNotificationsModule();
  if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
    return () => {};
  }
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const notifId = response?.notification?.request?.identifier;
      if (notifId) {
        onNotificationTapped(notifId);
      }
    });
    return () => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch {}
    };
  } catch (err) {
    console.warn('[NativeNotifications] Listener registration error:', err);
    return () => {};
  }
}
