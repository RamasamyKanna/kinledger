import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export async function registerPushChannel(): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  token: string | null;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported', token: null };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return { supported: true, permission, token: null };
  }

  try {
    const fcmSupported = await isSupported();
    if (fcmSupported && 'serviceWorker' in navigator) {
      const messaging = getMessaging(app);
      // Attempt token lookup only if a service worker registration exists
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const token = await getToken(messaging, {
          serviceWorkerRegistration: reg,
        });
        return { supported: true, permission, token: token || null };
      }
    }
  } catch {
    // Web Notification API remains active even when FCM SW isn't registered in iframe
  }

  return {
    supported: true,
    permission,
    token: `web-notify:${firebaseConfig.messagingSenderId}`,
  };
}

export function dispatchLocalPushAlert(title: string, body: string) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore if iframe blocks native Notification constructor
    }
  }
}
