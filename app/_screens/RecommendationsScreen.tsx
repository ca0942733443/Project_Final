"use client";

import { Check, Download, PackagePlus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type SalesRecommendation = {
  productId: number;
  productName: string;
  categoryName: string;
  unit: string;
  weeklySalesQuantity: number;
  weeklyRevenue: number;
  currentStock: number;
  reorderPoint: number;
  targetStock: number;
  suggestedQuantity: number;
};

type CustomerProduct = {
  productId: number;
  productName: string;
  unit: string;
  quantityPurchased: number;
  lastPurchasedAt: string | null;
};

type CustomerRecommendation = {
  customerId: number;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
  orderCount: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
  daysSinceLastPurchase: number;
  products: CustomerProduct[];
};

type RecommendationData = {
  generatedAt: string;
  salesWindowDays: number;
  inactivityDays: number;
  sales: SalesRecommendation[];
  customers: CustomerRecommendation[];
};

function numberText(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function money(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateText(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : "–";
}

function customerProductText(products: CustomerProduct[]) {
  return products.map((product) => `${product.productName} (${numberText(product.quantityPurchased)} ${product.unit})`).join(" | ");
}

export default function RecommendationsScreen() {
  const [tab, setTab] = useState<"sales" | "customers">("sales");
  const [inactivityDays, setInactivityDays] = useState(3);
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [orderedProductIds, setOrderedProductIds] = useState<number[]>([]);
  const [preparedCustomerIds, setPreparedCustomerIds] = useState<number[]>([]);
  const [orderingProductId, setOrderingProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<RecommendationData>(`/recommendations?inactivityDays=${inactivityDays}`);
      setRecommendations(data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecommendations(); }, [inactivityDays]);

  const addToInventoryOrder = async (item: SalesRecommendation) => {
    if (item.suggestedQuantity <= 0 || orderingProductId !== null) return;
    setOrderingProductId(item.productId);
    setError("");
    try {
      await apiFetch("/inventory-orders", {
        method: "POST",
        body: JSON.stringify({
          note: `สร้างจากยอดขายย้อนหลัง ${recommendations?.salesWindowDays ?? 7} วัน`,
          items: [{ productId: item.productId, quantity: item.suggestedQuantity }],
        }),
      });
      setOrderedProductIds((current) => [...current, item.productId]);
    } catch (orderError) {
      setError(errorMessage(orderError));
    } finally {
      setOrderingProductId(null);
    }
  };

  const exportCsv = () => {
    if (!recommendations) return;
    const rows = tab === "sales"
      ? [
        ["สินค้า", "หมวดหมู่", "ยอดขาย 7 วัน", "สต็อกปัจจุบัน", "เป้าสต็อก", "แนะนำเติม"],
        ...recommendations.sales.map((item) => [item.productName, item.categoryName, item.weeklySalesQuantity, item.currentStock, item.targetStock, item.suggestedQuantity]),
      ]
      : [
        ["ลูกค้า", "วันที่ซื้อครั้งล่าสุด", "หายไป (วัน)", "สินค้าที่ซื้อประจำ", "เบอร์โทรศัพท์", "ทะเบียนรถ"],
        ...recommendations.customers.map((customer) => [customer.fullName, dateText(customer.lastPurchaseAt), customer.daysSinceLastPurchase, customerProductText(customer.products), customer.phone ?? "", customer.carPlate ?? ""]),
      ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = tab === "sales" ? "weekly-stock-recommendations.csv" : "customer-recommendations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const sales = recommendations?.sales ?? [];
  const customers = recommendations?.customers ?? [];

  return <AdminShell active="recommendations">
    <PageTitle
      title="ระบบแนะนำการสั่งซื้อ"
      subtitle={`ยอดขายย้อนหลัง ${recommendations?.salesWindowDays ?? 7} วัน • อัปเดต ${recommendations ? dateText(recommendations.generatedAt) : "กำลังโหลด"}`}
    />
    {loading && <div className="api-message">กำลังคำนวณคำแนะนำจากประวัติการขาย...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card rec-card">
      <div className="tabs">
        <button className={tab === "sales" ? "selected" : ""} onClick={() => setTab("sales")} type="button">แนะนำเติมสินค้าตามยอดขาย</button>
        <button className={tab === "customers" ? "selected" : ""} onClick={() => setTab("customers")} type="button">แนะนำตามลูกค้าที่หายไป</button>
      </div>
      <div className="recommendation-tools">
        {tab === "sales" ? <span className="recommendation-rule">จัดอันดับจากจำนวนสินค้าที่ขายได้มากที่สุดในช่วง 7 วันล่าสุด และคำนวณยอดเติมให้พอขาย 7 วันถัดไป + จุดสั่งซื้อ</span> : <>
          <label className="recommendation-filter">แสดงลูกค้าที่ไม่ซื้อซ้ำ
            <select value={inactivityDays} onChange={(event) => setInactivityDays(Number(event.target.value))}>
              <option value={2}>ตั้งแต่ 2 วัน</option>
              <option value={3}>ตั้งแต่ 3 วัน</option>
              <option value={7}>ตั้งแต่ 7 วัน</option>
            </select>
          </label>
          <span className="recommendation-rule">เรียงจากลูกค้าที่หายไปนานที่สุด พร้อมสินค้าที่ลูกค้าคนนั้นเคยซื้อสะสมมากที่สุด</span>
        </>}
        <button onClick={exportCsv} type="button"><Download size={16} /> ส่งออก</button>
        <button aria-label="รีเฟรชคำแนะนำ" onClick={() => void loadRecommendations()} type="button"><RefreshCw size={16} /></button>
      </div>
      {tab === "sales" ? <div className="table-wrap"><table><thead><tr>{["สินค้า", "หมวดหมู่", "ขายได้ใน 7 วัน", "สต็อกคงเหลือ", "เป้าสต็อก", "ปริมาณที่แนะนำ", "จัดการ"].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>
        {sales.map((item) => {
          const stockRatio = item.targetStock > 0 ? Math.min(100, item.currentStock / item.targetStock * 100) : 100;
          const isOrdered = orderedProductIds.includes(item.productId);
          return <tr key={item.productId}>
            <td><strong>{item.productName}</strong><small className="table-subtext">หน่วย: {item.unit}</small></td>
            <td>{item.categoryName}</td>
            <td><strong>{numberText(item.weeklySalesQuantity)} {item.unit}</strong><small className="table-subtext">฿{money(item.weeklyRevenue)}</small></td>
            <td><div className="stock-level"><span>{numberText(item.currentStock)} {item.unit}</span><b>{Math.round(stockRatio)}%</b><i><em style={{ width: `${stockRatio}%` }} /></i></div></td>
            <td>{numberText(item.targetStock)} {item.unit}</td>
            <td className="suggested-qty">{item.suggestedQuantity > 0 ? `+ ${numberText(item.suggestedQuantity)} ${item.unit}` : "ไม่ต้องเติม"}</td>
            <td><button className="row-action" disabled={isOrdered || item.suggestedQuantity <= 0 || orderingProductId !== null} onClick={() => void addToInventoryOrder(item)} type="button">{isOrdered ? <><Check size={14} /> เพิ่มแล้ว</> : orderingProductId === item.productId ? "กำลังบันทึก..." : <><PackagePlus size={14} /> สร้างรายการสั่งซื้อ</>}</button></td>
          </tr>;
        })}
        {!loading && sales.length === 0 && <tr><td className="empty-cell" colSpan={7}>ยังไม่มียอดขายในช่วง 7 วันล่าสุด หรือไม่มีสินค้าที่ถึงจุดสั่งซื้อ</td></tr>}
      </tbody></table></div> : <div className="table-wrap"><table><thead><tr>{["ลูกค้า", "ซื้อครั้งล่าสุด", "หายไป", "สินค้าที่ลูกค้าเคยซื้อ", "เบอร์", "ทะเบียนรถ", "จัดการ"].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>
        {customers.map((customer) => {
          const isPrepared = preparedCustomerIds.includes(customer.customerId);
          return <tr key={customer.customerId}>
            <td><strong>{customer.fullName}</strong><small className="table-subtext">ซื้อมาแล้ว {customer.orderCount} ครั้ง</small></td>
            <td>{dateText(customer.lastPurchaseAt)}</td>
            <td><span className="status-pill s-3">{customer.daysSinceLastPurchase} วัน</span></td>
            <td><div className="customer-recommendation-products">{customer.products.length ? customer.products.map((product) => <span key={product.productId}>{product.productName}<small>{numberText(product.quantityPurchased)} {product.unit}</small></span>) : <span>ยังไม่มีรายละเอียดสินค้า</span>}</div></td>
            <td>{customer.phone ?? "–"}</td>
            <td>{customer.carPlate ?? "–"}</td>
            <td><button className="row-action" onClick={() => setPreparedCustomerIds((current) => isPrepared ? current.filter((id) => id !== customer.customerId) : [...current, customer.customerId])} type="button">{isPrepared ? <><Check size={14} /> เตรียมแล้ว</> : "เตรียมของ"}</button></td>
          </tr>;
        })}
        {!loading && customers.length === 0 && <tr><td className="empty-cell" colSpan={7}>ยังไม่มีลูกค้าที่ไม่ซื้อซ้ำตามจำนวนวันที่เลือก</td></tr>}
      </tbody></table></div>}
      <div className="recommendation-pagination"><span>{tab === "sales" ? `พบสินค้า ${sales.length} รายการ` : `พบลูกค้าที่ควรติดตาม ${customers.length} ราย`}</span><span>{tab === "sales" ? "เป้าสต็อก = ยอดขาย 7 วัน + จุดสั่งซื้อ" : `เกณฑ์แจ้งเตือน: ไม่ซื้อซ้ำตั้งแต่ ${inactivityDays} วัน`}</span></div>
    </section>
  </AdminShell>;
}
