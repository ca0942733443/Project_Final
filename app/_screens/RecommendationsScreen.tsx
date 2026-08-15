"use client";

import { Check, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryItem = { id: number; name: string; stockQuantity: number; lowStockThreshold: number; unit: string; status: "out" | "low" | "normal" };
type InventoryData = { items: InventoryItem[]; stats: { lowStockCount: number; outOfStockCount: number } };
type DashboardData = { summary: { totalRevenue: number; averageOrderValue: number }; bestSellers: Array<{ productId: number; productName: string; categoryName: string; quantitySold: number; revenue: number }> };
type Customer = { id: number; fullName: string; phone: string | null; favoriteProduct: string | null; lastPurchaseAt: string | null; orderCount: number };

export default function RecommendationsScreen() {
  const [tab, setTab] = useState<"sales" | "customers">("sales");
  const [ordered, setOrdered] = useState<number[]>([]);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryData, dashboardData, customerRows] = await Promise.all([
        apiFetch<InventoryData>("/inventory"),
        apiFetch<DashboardData>("/dashboard?period=week"),
        apiFetch<Customer[]>("/customers"),
      ]);
      setInventory(inventoryData);
      setDashboard(dashboardData);
      setCustomers(customerRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecommendations(); }, []);

  const customerSuggestions = customers
    .filter((customer) => customer.orderCount > 0)
    .sort((a, b) => new Date(a.lastPurchaseAt ?? 0).getTime() - new Date(b.lastPurchaseAt ?? 0).getTime())
    .slice(0, 5);

  return <AdminShell active="recommendations">
    <PageTitle title="ระบบแนะนำการสั่งซื้อ" subtitle={`คำนวณจากยอดขายรายสัปดาห์ (ข้อมูลอัปเดต: ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })})`} />
    {loading && <div className="api-message">กำลังคำนวณคำแนะนำ...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card rec-card">
      <div className="tabs"><button className={tab === "sales" ? "selected" : ""} onClick={() => setTab("sales")}>แนะนำตามยอดขาย</button><button className={tab === "customers" ? "selected" : ""} onClick={() => setTab("customers")}>แนะนำตามกลุ่มลูกค้า</button></div>
      <div className="recommendation-tools"><select><option>ทุกหมวดหมู่</option></select><select><option>เรียงตาม: ยอดขายสูงสุด</option></select><button><Download size={16} /> ส่งออก</button></div>
      {tab === "sales" ? <div className="table-wrap"><table><thead><tr>{["สินค้า", "ยอดขายสัปดาห์นี้", "สต็อกคงเหลือ", "ปริมาณที่แนะนำ", "สถานะ", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{inventory?.items.slice(0, 5).map(item => { const sales = dashboard?.bestSellers.find((seller) => seller.productId === item.id)?.quantitySold ?? 0; const suggested = Math.max(0, item.lowStockThreshold * 2 - item.stockQuantity); const ratio = Math.min(100, item.lowStockThreshold ? item.stockQuantity / (item.lowStockThreshold * 2) * 100 : 100); return <tr key={item.id}><td>{item.name}</td><td><strong>{sales.toLocaleString("th-TH")} {item.unit}</strong></td><td><div className="stock-level"><span>{item.stockQuantity} {item.unit}</span><b>{Math.round(ratio)}%</b><i><em style={{ width: `${ratio}%` }} /></i></div></td><td className="suggested-qty">{suggested > 0 ? `+ ${suggested.toLocaleString("th-TH")} ${item.unit}` : "0"}</td><td><span className={`status-pill ${item.status === "out" ? "s-1" : item.status === "low" ? "s-3" : "s-0"}`}>{item.status === "out" ? "สินค้าขาด" : item.status === "low" ? "ควรเติม" : "ปกติ"}</span></td><td><button className="row-action" disabled={ordered.includes(item.id) || suggested === 0} onClick={() => setOrdered([...ordered, item.id])}>{ordered.includes(item.id) ? <><Check size={14} /> เพิ่มแล้ว</> : "เพิ่มในรายการสั่งซื้อ"}</button></td></tr>; })}</tbody></table></div> : <div className="table-wrap"><table><thead><tr>{["ชื่อลูกค้า", "สั่งซื้อล่าสุด", "สินค้าประจำ", "เบอร์", "ทะเบียนรถ", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{customerSuggestions.slice(0, 3).map(customer => <tr key={customer.id}><td><strong>{customer.fullName}</strong></td><td>{customer.lastPurchaseAt ? `${Math.max(1, Math.round((Date.now() - new Date(customer.lastPurchaseAt).getTime()) / 86400000))} วันที่แล้ว` : "–"}</td><td>{customer.favoriteProduct ?? "–"}</td><td>{customer.phone ?? "–"}</td><td>–</td><td><button className="row-action">เตรียมของ</button></td></tr>)}</tbody></table></div>}
      <div className="recommendation-pagination"><span>แสดง 1 - 5 จากทั้งหมด {tab === "sales" ? inventory?.items.length ?? 0 : customers.length} รายการ</span><div><button><ChevronLeft size={17}/></button><button className="selected">1</button><button>2</button><button>3</button><button><ChevronRight size={17}/></button></div></div>
    </section>
  </AdminShell>;
}
