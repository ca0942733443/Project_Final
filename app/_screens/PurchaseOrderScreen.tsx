"use client";

import { ArrowLeft, Ban, Check, CheckCircle2, ClipboardList, PackageCheck, Printer, RefreshCw, Send, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type RecommendationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

type PurchaseOrder = {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: RecommendationStatus;
  note: string | null;
  createdByName: string;
  items: Array<{
    id: number;
    productId: number;
    sku: string;
    productName: string;
    categoryName: string;
    supplierName: string | null;
    unit: string;
    currentStock: number;
    reorderPoint: number;
    suggestedQuantity: number;
    approvedQuantity: number | null;
  }>;
};

const statusLabels: Record<RecommendationStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_APPROVAL: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

const statusClasses: Record<RecommendationStatus, string> = {
  DRAFT: "inventory-order-status is-draft",
  PENDING_APPROVAL: "inventory-order-status is-pending",
  APPROVED: "inventory-order-status is-approved",
  REJECTED: "inventory-order-status is-rejected",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function formatQuantity(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function supplierText(order: PurchaseOrder) {
  return Array.from(new Set(order.items.map((item) => item.supplierName ?? "ผู้จำหน่ายทั่วไป"))).join(", ");
}

export default function PurchaseOrderScreen() {
  const searchParams = useSearchParams();
  const idQuery = searchParams.get("ids") ?? searchParams.get("id") ?? "";
  const orderIds = useMemo(() => Array.from(new Set(idQuery.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))), [idQuery]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    if (!orderIds.length) {
      setLoading(false);
      setError("ไม่พบเลขที่ใบ PO ที่ต้องการดู");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const loadedOrders = await Promise.all(orderIds.map((id) => apiFetch<PurchaseOrder>(`/inventory-orders/${id}`)));
      setOrders(loadedOrders);
      setSelectedId((current) => current && loadedOrders.some((order) => order.id === current) ? current : loadedOrders[0]?.id ?? null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, [idQuery]);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0] ?? null;

  const updateStatus = async (nextStatus: RecommendationStatus) => {
    if (!selectedOrder || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/inventory-orders/${selectedOrder.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await loadOrders();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setSaving(false);
    }
  };

  const totalQuantity = selectedOrder?.items.reduce((total, item) => total + Number(item.approvedQuantity ?? item.suggestedQuantity), 0) ?? 0;

  return <AdminShell active="inventory-orders" contentClassName="purchase-order-page">
    <PageTitle
      title="ใบคำสั่งซื้อ (Purchase Order)"
      subtitle={selectedOrder ? `${selectedOrder.orderNumber} · สร้างเมื่อ ${formatDate(selectedOrder.orderDate)}` : "กำลังโหลดใบ PO"}
      action={<div className="purchase-order-page-actions"><Link className="secondary-button" href="/inventory-orders"><ArrowLeft size={16} /> กลับรายการคำสั่งซื้อ</Link><button className="primary-button purchase-order-print-button" type="button" onClick={() => window.print()} disabled={!selectedOrder}><Printer size={16} /> พิมพ์ใบ PO</button></div>}
    />
    {error && <div className="api-message error">{error}</div>}
    {loading && <div className="api-message">กำลังโหลดใบ PO...</div>}
    {!loading && selectedOrder && <section className={`purchase-order-view ${orders.length > 1 ? "has-order-list" : ""}`}>
      {orders.length > 1 && <aside className="purchase-order-list"><div className="purchase-order-list-heading"><span>สร้างสำเร็จ</span><strong>{orders.length} ใบ</strong><small>แยกตาม Supplier</small></div>{orders.map((order) => <button className={order.id === selectedOrder.id ? "selected" : ""} type="button" key={order.id} onClick={() => setSelectedId(order.id)}><div><strong>{order.orderNumber}</strong><small><Truck size={12} /> {supplierText(order)}</small></div><span className={statusClasses[order.status]}>{statusLabels[order.status]}</span></button>)}</aside>}
      <article className="purchase-order-document">
        <header className="purchase-order-document-header"><div><span>CAPTAIN GAI SOD · MAIN BRANCH</span><h2>ใบคำสั่งซื้อสินค้า</h2><small>Purchase Order</small></div><div className="purchase-order-document-number"><span>เลขที่เอกสาร</span><strong>{selectedOrder.orderNumber}</strong><small>{formatDate(selectedOrder.orderDate)}</small></div></header>
        <div className="purchase-order-meta"><div><span>ผู้จำหน่าย</span><strong><Truck size={15} /> {supplierText(selectedOrder)}</strong></div><div><span>ผู้สร้างรายการ</span><strong>{selectedOrder.createdByName}</strong></div><div><span>สถานะ</span><strong><span className={statusClasses[selectedOrder.status]}>{statusLabels[selectedOrder.status]}</span></strong></div></div>
        <div className="purchase-order-document-heading"><div><h3>รายการสินค้า</h3><span>{selectedOrder.items.length} รายการ</span></div><ClipboardList size={19} /></div>
        <div className="purchase-order-items-table"><table><thead><tr><th>#</th><th>สินค้า</th><th>SKU</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>จำนวนสั่ง</th></tr></thead><tbody>{selectedOrder.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.productName}</strong><small>{item.unit}</small></td><td>{item.sku}</td><td>{item.categoryName}</td><td>{formatQuantity(item.currentStock)} {item.unit}</td><td><strong>{formatQuantity(item.approvedQuantity ?? item.suggestedQuantity)}</strong> {item.unit}</td></tr>)}</tbody></table></div>
        <div className="purchase-order-total"><span>รวมจำนวนสินค้าที่สั่ง</span><strong>{formatQuantity(totalQuantity)} หน่วย</strong></div>
        <div className="purchase-order-note"><span>หมายเหตุ</span><strong>{selectedOrder.note ?? "ไม่มีหมายเหตุ"}</strong></div>
        <footer className="purchase-order-document-footer"><span>เอกสารนี้สร้างจากระบบจัดการคลังสินค้า</span><div className="purchase-order-status-actions">{selectedOrder.status === "DRAFT" && <button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("PENDING_APPROVAL")}><Send size={15} /> ส่งขออนุมัติ</button>}{selectedOrder.status === "PENDING_APPROVAL" && <><button className="inventory-order-danger" type="button" disabled={saving} onClick={() => void updateStatus("REJECTED")}><Ban size={15} /> ไม่อนุมัติ</button><button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("APPROVED")}><Check size={15} /> อนุมัติ PO</button></>}{selectedOrder.status === "REJECTED" && <button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("DRAFT")}><RefreshCw size={15} /> แก้ไขและส่งใหม่</button>}{selectedOrder.status === "APPROVED" && <span className="purchase-order-approved"><CheckCircle2 size={16} /> PO อนุมัติแล้ว</span>}</div></footer>
      </article>
    </section>}
  </AdminShell>;
}
