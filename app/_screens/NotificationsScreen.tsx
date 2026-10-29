"use client";

import { Bell, Package, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";
import { buildNotificationAlerts, dismissAllNotifications, dismissNotification, loadNotificationState, markAllNotificationsRead, markNotificationRead, NOTIFICATION_STATE_CHANGED, type InventoryNotificationItem, type NotificationAlert, type NotificationState } from "../_lib/notifications";

export default function NotificationsScreen() {
  const [items, setItems] = useState<InventoryNotificationItem[]>([]);
  const [notificationState, setNotificationState] = useState<NotificationState>({ read: [], dismissed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotificationState(loadNotificationState());
    apiFetch<{ items: InventoryNotificationItem[] }>("/inventory")
      .then((data) => setItems(data.items))
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
    const syncNotificationState = () => setNotificationState(loadNotificationState());
    window.addEventListener(NOTIFICATION_STATE_CHANGED, syncNotificationState);
    window.addEventListener("storage", syncNotificationState);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_CHANGED, syncNotificationState);
      window.removeEventListener("storage", syncNotificationState);
    };
  }, []);

  const alerts = buildNotificationAlerts(items);
  const visibleAlerts = alerts
    .filter((alert) => !notificationState.dismissed.includes(alert.id))
    .sort((a, b) => Number(notificationState.read.includes(a.id)) - Number(notificationState.read.includes(b.id)));
  const readAll = () => markAllNotificationsRead(alerts.map((alert) => alert.id));
  const deleteAll = () => dismissAllNotifications(alerts.map((alert) => alert.id));
  const handleAlertAction = (alert: NotificationAlert, action: () => void) => {
    markNotificationRead(alert.id);
    action();
  };

  return <AdminShell active="notifications">
    <button aria-label="ปิดศูนย์แจ้งเตือน" className="notification-scrim" onClick={() => window.history.back()} />
    <section className="notification-drawer" aria-label="ศูนย์แจ้งเตือน">
      <header className="notification-drawer-header">
        <h1><Bell size={21} /> ศูนย์แจ้งเตือน</h1>
        <button aria-label="ปิด" onClick={() => window.history.back()}><X size={21} /></button>
      </header>
      <div className="notification-list">
        {loading && <div className="api-message">กำลังตรวจสอบการแจ้งเตือน...</div>}
        {error && <div className="api-message error">{error}</div>}
        {visibleAlerts.map((alert) => {
          const isRead = notificationState.read.includes(alert.id);
          const isLowStock = alert.kind === "low-stock";
          const Icon = isLowStock ? Package : Timer;
          return <article key={alert.id} className={`notice ${isLowStock ? "red" : "orange"} ${isRead ? "read" : ""}`}>
            <span className="notice-icon"><Icon size={16} /></span>
            <div className="notice-content">
              <h3>{isLowStock ? "ของใกล้หมด" : alert.daysUntilExpiry !== null && alert.daysUntilExpiry < 0 ? "สินค้าหมดอายุแล้ว" : "ของจะหมดอายุ"}</h3>
              <p>{isLowStock
                ? `${alert.item.name} เหลือเพียง ${alert.item.stockQuantity.toLocaleString("th-TH")} ${alert.item.unit} ในสต็อก`
                : `${alert.item.name} ${alert.daysUntilExpiry !== null && alert.daysUntilExpiry < 0 ? "หมดอายุแล้ว" : `จะหมดอายุในอีก ${alert.daysUntilExpiry} วัน`}`}</p>
              {isLowStock
                ? <button onClick={() => handleAlertAction(alert, () => window.location.assign("/inventory-order-create"))}>สั่งซื้อ</button>
                : <button className="flash-button" onClick={() => markNotificationRead(alert.id)}>พิมพ์ป้ายลดราคา</button>}
            </div>
            <div className="notice-meta">
              <button className="notice-dismiss" aria-label={`ลบการแจ้งเตือน ${alert.item.name}`} onClick={() => dismissNotification(alert.id)}><X size={16} /></button>
              <small>{isRead ? "อ่านแล้ว" : "จากข้อมูลสต็อกสินค้า"}</small>
            </div>
          </article>;
        })}
        {!loading && !error && visibleAlerts.length === 0 && <div className="api-message">ยังไม่มีการแจ้งเตือนจากสต็อกหรือล็อตสินค้า</div>}
      </div>
      <footer className="notification-drawer-footer"><button className="delete-all-notifications" onClick={deleteAll}>ลบทั้งหมด</button><button onClick={readAll}>อ่านทั้งหมด</button></footer>
    </section>
  </AdminShell>;
}
