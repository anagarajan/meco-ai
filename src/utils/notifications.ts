import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    // On native Capacitor, @capacitor/local-notifications handles permissions.
    // For now, fall through to Web Notifications API which works in WKWebView.
    // TODO: Install @capacitor/local-notifications for reliable native scheduling.
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function fireNotification(title: string, body: string): void {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icons/icon-192.svg" });
}

/** Schedules a notification after `delayMs` milliseconds. Returns the timer id. */
export function scheduleNotification(title: string, body: string, delayMs: number): ReturnType<typeof setTimeout> {
  return setTimeout(() => { fireNotification(title, body); }, delayMs);
}
