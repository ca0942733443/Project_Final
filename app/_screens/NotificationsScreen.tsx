"use client";

import { Bell, Check, Package, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryItem = { id: number; name: string; stockQuantity: number; lowStockThreshold: number; unit: string; status: "out" | "low" | "normal" };
type InventoryData = { items: InventoryItem[] };

export default function NotificationsScreen() {
  const [read, setRead] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<InventoryData>("/inventory")
      .then((data) => setItems(data.items.filter((item) => item.status !== "normal")))
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  return <AdminShell active="notifications">
    <button aria-label="ปิดศูนย์แจ้งเตือน" className="notification-scrim" onClick={() => window.history.back()} />
    <section className="notification-drawer" aria-label="ศูนย์แจ้งเตือน">
      <header className="notification-drawer-header"><h1><Bell size={21} /> ศูนย์แจ้งเตือน</h1><button aria-label="ปิด" onClick={() => window.history.back()}><X size={21} /></button></header>
      <div className="notification-list">
        {loading && <div className="api-message">กำลังตรวจสอบการแจ้งเตือน...</div>}
        {error && <div className="api-message error">{error}</div>}
        {items[0] && <article className={`notice red ${read ? "read" : ""}`}><span className="notice-icon"><Package size={20} /></span><div><h3>ของใกล้หมด (Low Stock)</h3><p>{items[0].name} เหลือเพียง {items[0].stockQuantity.toLocaleString("th-TH")} {items[0].unit} ในสต็อก</p><button onClick={() => window.location.assign("/inventory")}>สั่งซื้อ</button></div><small>{read ? "อ่านแล้ว" : "3 นาทีที่แล้ว"}</small></article>}
        <article className={`notice orange ${read ? "read" : ""}`}><span className="notice-icon"><Timer size={20} /></span><div><h3>ของจะหมดอายุ (Near Expiry)</h3><p>{items[1]?.name ?? "โยเกิร์ตรสธรรมชาติ"} กำลังจะหมดอายุในอีก 48 ชั่วโมง</p><button className="flash-button">พิมพ์ป้ายลดราคา (Flash Sale)</button></div><small>{read ? "อ่านแล้ว" : "1 ชั่วโมงที่แล้ว"}</small></article>
        {!loading && !error && items.length === 0 && <div className="api-message">สต็อกสินค้าทุกรายการอยู่ในระดับปกติ</div>}
      </div>
      <footer className="notification-drawer-footer"><span><Check size={15} /> อ่านทั้งหมดแล้ว</span><button onClick={() => setRead(true)}>อ่านทั้งหมด</button></footer>
    </section>
  </AdminShell>;
}
