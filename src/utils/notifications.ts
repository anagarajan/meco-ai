import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const isNative = Capacitor.isNativePlatform();

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// ── ID mapping ────────────────────────────────────────────────────────────────

/** Deterministically maps a UUID reminder ID to a 32-bit int notification ID. */
export function reminderIdToNotifId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ── Native scheduling (iOS / Android) ────────────────────────────────────────

export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  body: string,
  at: Date,
): Promise<void> {
  if (!isNative) return;
  await LocalNotifications.schedule({
    notifications: [{
      id: reminderIdToNotifId(reminderId),
      title,
      body,
      schedule: { at, allowWhileIdle: true },
      extra: { reminderId },
    }],
  });
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (!isNative) return;
  await LocalNotifications.cancel({
    notifications: [{ id: reminderIdToNotifId(reminderId) }],
  });
}

// ── Web fallback (PWA / browser) ──────────────────────────────────────────────

export function fireNotification(title: string, body: string): void {
  if (!isNative && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icons/icon-192.svg" });
  }
}

/** Schedules a web notification after `delayMs` ms. Returns the timer id for cancellation. */
export function scheduleNotification(
  title: string,
  body: string,
  delayMs: number,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => fireNotification(title, body), delayMs);
}
