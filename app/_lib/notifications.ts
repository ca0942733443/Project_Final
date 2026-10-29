export type InventoryNotificationItem = {
  id: number;
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  status: "out" | "low" | "normal";
  expiryDate: string | null;
};

export type NotificationAlert = {
  id: string;
  kind: "low-stock" | "near-expiry";
  item: InventoryNotificationItem;
  daysUntilExpiry: number | null;
};

export type NotificationState = { read: string[]; dismissed: string[] };

const STORAGE_KEY = "captain-gai-sod-notifications";
export const NOTIFICATION_STATE_CHANGED = "captain-gai-sod-notifications-changed";

export function buildNotificationAlerts(items: InventoryNotificationItem[]): NotificationAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts: NotificationAlert[] = [];

  for (const item of items) {
    // Older products may have a zero reorder point from the legacy schema.
    // Treat an unset/zero threshold as the form's default of five units.
    const lowStockThreshold = item.lowStockThreshold > 0 ? item.lowStockThreshold : 5;
    if (item.status !== "normal" || item.stockQuantity <= lowStockThreshold) {
      alerts.push({ id: `low-stock:${item.id}:${item.status}`, kind: "low-stock", item, daysUntilExpiry: null });
    }
    if (item.expiryDate) {
      const expiry = new Date(item.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
      if (daysUntilExpiry <= 7) {
        alerts.push({ id: `near-expiry:${item.id}:${item.expiryDate}`, kind: "near-expiry", item, daysUntilExpiry });
      }
    }
  }
  return alerts;
}

export function loadNotificationState(): NotificationState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { read: [], dismissed: [] };
    const parsed = JSON.parse(stored) as Partial<NotificationState>;
    return {
      read: Array.isArray(parsed.read) ? parsed.read.filter((id): id is string => typeof id === "string") : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

export function saveNotificationState(state: NotificationState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(NOTIFICATION_STATE_CHANGED));
}

export function markNotificationRead(id: string) {
  const state = loadNotificationState();
  if (!state.read.includes(id)) saveNotificationState({ ...state, read: [...state.read, id] });
}

export function markAllNotificationsRead(alertIds: string[]) {
  const state = loadNotificationState();
  saveNotificationState({ ...state, read: [...new Set([...state.read, ...alertIds])] });
}

export function dismissNotification(id: string) {
  const state = loadNotificationState();
  saveNotificationState({ ...state, dismissed: [...new Set([...state.dismissed, id])] });
}

export function dismissAllNotifications(alertIds: string[]) {
  const state = loadNotificationState();
  saveNotificationState({ ...state, dismissed: [...new Set([...state.dismissed, ...alertIds])] });
}
