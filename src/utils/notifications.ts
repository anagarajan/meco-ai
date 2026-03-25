export async function requestNotificationPermission(): Promise<boolean> {
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
