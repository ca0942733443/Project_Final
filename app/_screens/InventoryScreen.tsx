"use client";

import { Download, PackageCheck, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  price: number;
  stockValue: number;
  status: "out" | "low" | "normal";
  updatedAt?: string;
};

type InventoryData = {
  items: InventoryItem[];
  stats: { totalStockValue: number; productCount: number; lowStockCount: number; outOfStockCount: number };
};

type InventoryMovement = {
  id: number;
  productName: string;
  movementType: "opening" | "purchase" | "adjustment" | "return" | "sale";
  quantity: number;
  note: string | null;
  createdAt: string;
};

type Supplier = { id: number; name: string };

const statusLabels = { normal: "ปกติ", low: "สต็อกต่ำ", out: "สินค้าหมด" } as const;

export default function InventoryScreen() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryData, movementRows, supplierRows] = await Promise.all([
        apiFetch<InventoryData>(`/inventory${status ? `?status=${status}` : ""}`),
        apiFetch<InventoryMovement[]>("/inventory/movements?limit=2"),
        apiFetch<Supplier[]>("/suppliers"),
      ]);
      setData(inventoryData);
      setMovements(movementRows);
      setSuppliers(supplierRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void loadInventory(); }, [loadInventory]);

  const receiveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(form.get("productId")),
          movementType: "purchase",
          quantity: Number(form.get("quantity")),
          unitCost: Number(form.get("unitCost") || 0),
          supplierId: form.get("supplierId") ? Number(form.get("supplierId")) : null,
          note: form.get("note"),
        }),
      });
      setShowReceive(false);
      await loadInventory();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const stats = data?.stats;
  const exportCsv = () => {
    if (!data) return;
    const rows = [["SKU", "สินค้า", "หมวดหมู่", "คงเหลือ", "หน่วย", "มูลค่า"], ...data.items.map((item) => [item.sku, item.name, item.categoryName, item.stockQuantity, item.unit, item.stockValue])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "inventory.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <AdminShell active="inventory">
    <PageTitle title="การจัดการคลังสินค้า" subtitle="ตรวจสอบและจัดการสต็อกจากฐานข้อมูลจริง" action={<button className="primary-button" onClick={() => setShowReceive(true)}><PackageCheck size={17} /> รับสินค้าเข้า</button>} />
    <div className="stat-grid four"><Stat label="มูลค่าสินค้าในคลังทั้งหมด" value={`฿${(stats?.totalStockValue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} /><Stat label="จำนวนรายการสินค้า" value={`${stats?.productCount ?? 0} รายการ`} tone="neutral" /><Stat label="สินค้าสต็อกต่ำ" value={`${stats?.lowStockCount ?? 0}`} tone="orange" note="ควรเติมสินค้าทันที" /><Stat label="สินค้าหมด" value={`${stats?.outOfStockCount ?? 0}`} tone="red" /></div>
    <section className="data-card inventory-stock-card">
      <div className="table-tools"><select aria-label="หมวดหมู่"><option>ทุกหมวดหมู่</option></select><select value={status} onChange={event => setStatus(event.target.value)}><option value="">สถานะ: ทั้งหมด</option><option value="normal">สถานะ: ปกติ</option><option value="low">สถานะ: สต็อกต่ำ</option><option value="out">สถานะ: สินค้าหมด</option></select><button onClick={exportCsv}><Download size={15} /> ส่งออก</button></div>
      {loading && <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>}
      {error && <div className="api-message error">{error}</div>}
      <div className="inventory-table">
        <div className="table-wrap"><table><thead><tr>{["สินค้า", "ล็อต", "คลัง", "หน้าร้าน", "หมดอายุ", "สถานะ", ""].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{data?.items.slice(0, 3).map(item => <tr className={item.status === "out" ? "expired-row" : ""} key={item.id}><td>{item.name}</td><td>{item.sku}</td><td className={item.status !== "normal" ? "danger-text" : ""}>{item.stockQuantity.toLocaleString("th-TH")}</td><td>{item.status === "out" ? 0 : Math.min(item.stockQuantity, item.lowStockThreshold)}</td><td className={item.status === "low" ? "danger-text" : ""}>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td><td><span className={`status-pill ${item.status === "out" ? "s-2" : item.status === "low" ? "s-1" : "s-0"}`}>{item.status === "out" ? "สต็อกสินค้า: หมดอายุ" : item.status === "low" ? "ใกล้หมดอายุ (7 วัน)" : "ปกติ"}</span></td><td className="more-cell">⋮</td></tr>)}</tbody></table></div>
        <div className="pagination"><span>แสดง {data?.items.length ? 1 : 0} ถึง {data?.items.length ?? 0} จาก {data?.items.length ?? 0} รายการ</span><div><button aria-label="หน้าก่อนหน้า" disabled>‹</button><button className="selected" aria-current="page">1</button><button aria-label="หน้าถัดไป" disabled>›</button></div></div>
      </div>
      {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบสินค้าในสถานะที่เลือก</div>}
    </section>
    <section className="inventory-movement-card"><h2>ประวัติการเคลื่อนย้ายสินค้าล่าสุด</h2><div className="movement-list">{movements.map((movement, index) => <article className={`movement-item movement-${index % 2}`} key={movement.id}><span className="movement-icon">⇥</span><div><strong>{movement.movementType === "purchase" ? "รับเข้าคลัง" : movement.movementType === "sale" ? "ขายออกหน้าร้าน" : "ย้ายไปหน้าร้าน"}: {movement.productName}</strong><small>{movement.note ?? `อัปเดตเมื่อ ${new Date(movement.createdAt).toLocaleString("th-TH")}`}</small></div><b className={movement.quantity < 0 ? "danger-text" : ""}>{movement.quantity > 0 ? "+" : ""}{movement.quantity.toLocaleString("th-TH")} หน่วย</b></article>)}</div><button className="movement-link" type="button">ดูประวัติทั้งหมด</button></section>
    {showReceive && <div className="modal-backdrop"><form className="modal" onSubmit={receiveStock}><button type="button" className="modal-close" onClick={() => setShowReceive(false)}><X /></button><h2>รับสินค้าเข้า</h2><label>สินค้า<select name="productId" required>{data?.items.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.stockQuantity} {item.unit})</option>)}</select></label><label>จำนวนรับเข้า<input name="quantity" min="0.001" step="0.001" type="number" required /></label><label>ต้นทุนต่อหน่วย (บาท)<input name="unitCost" min="0" step="0.01" type="number" defaultValue="0" /></label><label>Supplier<select name="supplierId"><option value="">ใช้ผู้จำหน่ายทั่วไป</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label><label>หมายเหตุ<input name="note" placeholder="เช่น เลขที่ใบรับสินค้า" /></label><button className="primary-button" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : "บันทึกรับเข้า"}</button></form></div>}
  </AdminShell>;
}
