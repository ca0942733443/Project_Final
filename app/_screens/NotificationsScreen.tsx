"use client";

import { Bell, Check, Package, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryItem = { id: number; name: string; stockQuantity: number; lowStockThreshold: number; unit: string; status: "out" | "low" | "normal"; expiryDate: string | null };
type InventoryData = { items: InventoryItem[] };

function expiryDays(value: string | null) {
  if (!value) return null;
  const expiry = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

export default function NotificationsScreen() {
  const [read, setRead] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<InventoryData>("/inventory")
      .then((data) => setItems(data.items))
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  const lowStockItem = items.find((item) => item.status !== "normal");
  const nearExpiryItem = items.find((item) => {
    const days = expiryDays(item.expiryDate);
    return days !== null && days <= 7;
  });
  const nearExpiryDays = expiryDays(nearExpiryItem?.expiryDate ?? null);

  return <AdminShell active="notifications">
    <button aria-label="ปิดศูนย์แจ้งเตือน" className="notification-scrim" onClick={() => window.history.back()} />
    <section className="notification-drawer" aria-label="ศูนย์แจ้งเตือน">
      <header className="notification-drawer-header"><h1><Bell size={21} /> ศูนย์แจ้งเตือน</h1><button aria-label="ปิด" onClick={() => window.history.back()}><X size={21} /></button></header>
      <div className="notification-list">
        {loading && <div className="api-message">กำลังตรวจสอบการแจ้งเตือน...</div>}
        {error && <div className="api-message error">{error}</div>}
        {lowStockItem && <article className={`notice red ${read ? "read" : ""}`}><span className="notice-icon"><Package size={20} /></span><div><h3>ของใกล้หมด (Low Stock)</h3><p>{lowStockItem.name} เหลือเพียง {lowStockItem.stockQuantity.toLocaleString("th-TH")} {lowStockItem.unit} ในสต็อก</p><button onClick={() => window.location.assign("/inventory")}>สั่งซื้อ</button></div><small>{read ? "อ่านแล้ว" : "จากฐานข้อมูลสต็อก"}</small></article>}
        {nearExpiryItem && <article className={`notice orange ${read ? "read" : ""}`}><span className="notice-icon"><Timer size={20} /></span><div><h3>{nearExpiryDays !== null && nearExpiryDays < 0 ? "สินค้าหมดอายุแล้ว" : "ของจะหมดอายุ (Near Expiry)"}</h3><p>{nearExpiryItem.name} {nearExpiryDays !== null && nearExpiryDays < 0 ? "หมดอายุแล้ว" : `จะหมดอายุในอีก ${nearExpiryDays} วัน`}</p><button className="flash-button">พิมพ์ป้ายลดราคา (Flash Sale)</button></div><small>{read ? "อ่านแล้ว" : "จากฐานข้อมูลล็อตสินค้า"}</small></article>}
        {!loading && !error && !lowStockItem && !nearExpiryItem && <div className="api-message">ยังไม่มีการแจ้งเตือนจากสต็อกหรือล็อตสินค้า</div>}
      </div>
      <footer className="notification-drawer-footer"><span><Check size={15} /> อ่านทั้งหมดแล้ว</span><button onClick={() => setRead(true)}>อ่านทั้งหมด</button></footer>
    </section>
  </AdminShell>;
}
