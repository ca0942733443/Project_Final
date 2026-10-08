"use client";

import { ArrowLeft, Ban, Check, CheckCircle2, ClipboardList, PackageCheck, Printer, RefreshCw, Send, Truck, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type RecommendationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RECEIVED";

type ReceiveLine = { quantity: string; unitCost: string; lotNo: string; expiryDate: string };

type PurchaseOrder = {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: RecommendationStatus;
  note: string | null;
  createdByName: string;
  goodsReceiptId: number | null;
  receiptNo: string | null;
  receivedAt: string | null;
  receivedByName: string | null;
  items: Array<{
    id: number;
    productId: number;
    sku: string;
    productName: string;
    categoryName: string;
    supplierName: string | null;
    supplierId: number | null;
    unit: string;
    costPrice: number;
    currentStock: number;
    reorderPoint: number;
    suggestedQuantity: number;
    approvedQuantity: number | null;
    receivedQuantity: number | null;
    receivedUnitCost: number | null;
    lotNo: string | null;
    batchReceivedDate: string | null;
    expiryDate: string | null;
  }>;
};

const statusLabels: Record<RecommendationStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_APPROVAL: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  RECEIVED: "รับเข้าสต็อกแล้ว",
};

const statusClasses: Record<RecommendationStatus, string> = {
  DRAFT: "inventory-order-status is-draft",
  PENDING_APPROVAL: "inventory-order-status is-pending",
  APPROVED: "inventory-order-status is-approved",
  REJECTED: "inventory-order-status is-rejected",
  RECEIVED: "inventory-order-status is-received",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function formatQuantity(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function localDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function supplierText(order: PurchaseOrder) {
  return Array.from(new Set(order.items.map((item) => item.supplierName ?? "ผู้จำหน่ายทั่วไป"))).join(", ");
}

function PurchaseOrderContent() {
  const searchParams = useSearchParams();
  const idQuery = searchParams.get("ids") ?? searchParams.get("id") ?? "";
  const orderIds = useMemo(() => Array.from(new Set(idQuery.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))), [idQuery]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveLines, setReceiveLines] = useState<Record<number, ReceiveLine>>({});
  const [receiveReceiptNo, setReceiveReceiptNo] = useState("");
  const [receiveReceivedAt, setReceiveReceivedAt] = useState("");

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

  const openReceive = () => {
    if (!selectedOrder) return;
    setError("");
    setNotice("");
    setReceiveReceiptNo(`GR-PO-${String(selectedOrder.id).padStart(6, "0")}`);
    setReceiveReceivedAt(localDateTimeInputValue());
    setReceiveLines(Object.fromEntries(selectedOrder.items.map((item) => [item.id, {
      quantity: String(item.approvedQuantity ?? item.suggestedQuantity),
      unitCost: String(item.costPrice ?? 0),
      lotNo: `PO-${selectedOrder.id}-${item.id}`,
      expiryDate: "",
    }])));
    setReceiveOpen(true);
  };

  const updateReceiveLine = (itemId: number, field: keyof ReceiveLine, value: string) => {
    setReceiveLines((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  };

  const receiveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrder || saving) return;
    const items = selectedOrder.items.map((item) => ({
      itemId: item.id,
      quantity: Number(receiveLines[item.id]?.quantity),
      unitCost: Number(receiveLines[item.id]?.unitCost),
      lotNo: receiveLines[item.id]?.lotNo.trim() ?? "",
      expiryDate: receiveLines[item.id]?.expiryDate || null,
    }));
    if (!receiveReceiptNo.trim()) {
      setError("กรุณาระบุเลขที่ใบรับสินค้า");
      return;
    }
    if (!receiveReceivedAt) {
      setError("กรุณาระบุวันที่และเวลารับสินค้า");
      return;
    }
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setError("กรุณาระบุจำนวนรับจริงให้มากกว่า 0 ครบทุกรายการ");
      return;
    }
    if (items.some((item) => !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
      setError("กรุณาระบุต้นทุนต่อหน่วยให้ถูกต้อง");
      return;
    }
    if (items.some((item) => !item.lotNo)) {
      setError("กรุณาระบุเลขล็อตให้ครบทุกรายการ");
      return;
    }
    const receivedDate = receiveReceivedAt.slice(0, 10);
    if (items.some((item) => item.expiryDate && item.expiryDate < receivedDate)) {
      setError("วันหมดอายุต้องไม่ก่อนวันที่รับสินค้า");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ receiptNo: string; totalQuantity: number }>(`/inventory-orders/${selectedOrder.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ receiptNo: receiveReceiptNo.trim(), receivedAt: receiveReceivedAt, items }),
      });
      setReceiveOpen(false);
      await loadOrders();
      setNotice(`รับสินค้าเข้าสต็อกสำเร็จ เลขที่ใบรับ ${result.receiptNo} รวม ${formatQuantity(result.totalQuantity)} หน่วย`);
    } catch (receiveError) {
      setError(errorMessage(receiveError));
    } finally {
      setSaving(false);
    }
  };

  const totalQuantity = selectedOrder?.items.reduce((total, item) => total + Number(item.approvedQuantity ?? item.suggestedQuantity), 0) ?? 0;
  const receiveQuantity = selectedOrder?.items.reduce((total, item) => total + Number(receiveLines[item.id]?.quantity ?? 0), 0) ?? 0;
  const receiveValue = selectedOrder?.items.reduce((total, item) => total + Number(receiveLines[item.id]?.quantity ?? 0) * Number(receiveLines[item.id]?.unitCost ?? 0), 0) ?? 0;

  return <>
    <AdminShell active="inventory-orders" contentClassName="purchase-order-page">
    <PageTitle
      title="ใบคำสั่งซื้อ (Purchase Order)"
      subtitle={selectedOrder ? `${selectedOrder.orderNumber} · สร้างเมื่อ ${formatDate(selectedOrder.orderDate)}` : "กำลังโหลดใบ PO"}
      action={<div className="purchase-order-page-actions"><Link className="secondary-button" href="/inventory-orders"><ArrowLeft size={16} /> กลับรายการคำสั่งซื้อ</Link><button className="primary-button purchase-order-print-button" type="button" onClick={() => window.print()} disabled={!selectedOrder}><Printer size={16} /> พิมพ์ใบ PO</button></div>}
    />
    {error && <div className="api-message error">{error}</div>}
    {notice && <div className="api-message success">{notice}</div>}
    {loading && <div className="api-message">กำลังโหลดใบ PO...</div>}
    {!loading && selectedOrder && <section className={`purchase-order-view ${orders.length > 1 ? "has-order-list" : ""}`}>
      {orders.length > 1 && <aside className="purchase-order-list"><div className="purchase-order-list-heading"><span>สร้างสำเร็จ</span><strong>{orders.length} ใบ</strong><small>แยกตาม Supplier</small></div>{orders.map((order) => <button className={order.id === selectedOrder.id ? "selected" : ""} type="button" key={order.id} onClick={() => { setSelectedId(order.id); setReceiveOpen(false); }}><div><strong>{order.orderNumber}</strong><small><Truck size={12} /> {supplierText(order)}</small></div><span className={statusClasses[order.status]}>{statusLabels[order.status]}</span></button>)}</aside>}
      <article className="purchase-order-document">
        <header className="purchase-order-document-header"><div><span>CAPTAIN GAI SOD · MAIN BRANCH</span><h2>ใบคำสั่งซื้อสินค้า</h2><small>Purchase Order</small></div><div className="purchase-order-document-number"><span>เลขที่เอกสาร</span><strong>{selectedOrder.orderNumber}</strong><small>{formatDate(selectedOrder.orderDate)}</small></div></header>
        <div className="purchase-order-meta"><div><span>ผู้จำหน่าย</span><strong><Truck size={15} /> {supplierText(selectedOrder)}</strong></div><div><span>ผู้สร้างรายการ</span><strong>{selectedOrder.createdByName}</strong></div><div><span>สถานะ</span><strong><span className={statusClasses[selectedOrder.status]}>{statusLabels[selectedOrder.status]}</span></strong></div></div>
        {selectedOrder.status === "RECEIVED" && <div className="purchase-order-receipt-banner"><PackageCheck size={20} /><div><span>รับสินค้าเข้าสต็อกแล้ว</span><strong>{selectedOrder.receiptNo}</strong><small>{formatDateTime(selectedOrder.receivedAt)} · ผู้รับ {selectedOrder.receivedByName ?? "-"}</small></div></div>}
        <div className="purchase-order-document-heading"><div><h3>รายการสินค้า</h3><span>{selectedOrder.items.length} รายการ</span></div><ClipboardList size={19} /></div>
        <div className="purchase-order-items-table"><table><thead><tr><th>#</th><th>สินค้า</th><th>SKU</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>จำนวนสั่ง</th></tr></thead><tbody>{selectedOrder.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.productName}</strong><small>{selectedOrder.status === "RECEIVED" ? `Lot ${item.lotNo ?? "-"} · หมดอายุ ${item.expiryDate ? formatDate(item.expiryDate) : "ไม่มี"}` : item.unit}</small></td><td>{item.sku}</td><td>{item.categoryName}</td><td>{formatQuantity(item.currentStock)} {item.unit}</td><td><strong>{formatQuantity(item.approvedQuantity ?? item.suggestedQuantity)}</strong> {item.unit}{selectedOrder.status === "RECEIVED" && <small>รับจริง {formatQuantity(item.receivedQuantity)} · ฿{formatMoney(item.receivedUnitCost)}</small>}</td></tr>)}</tbody></table></div>
        <div className="purchase-order-total"><span>รวมจำนวนสินค้าที่สั่ง</span><strong>{formatQuantity(totalQuantity)} หน่วย</strong></div>
        <div className="purchase-order-note"><span>หมายเหตุ</span><strong>{selectedOrder.note ?? "ไม่มีหมายเหตุ"}</strong></div>
        <footer className="purchase-order-document-footer"><span>เอกสารนี้สร้างจากระบบจัดการคลังสินค้า</span><div className="purchase-order-status-actions">{selectedOrder.status === "DRAFT" && <button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("PENDING_APPROVAL")}><Send size={15} /> ส่งขออนุมัติ</button>}{selectedOrder.status === "PENDING_APPROVAL" && <><button className="inventory-order-danger" type="button" disabled={saving} onClick={() => void updateStatus("REJECTED")}><Ban size={15} /> ไม่อนุมัติ</button><button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("APPROVED")}><Check size={15} /> อนุมัติ PO</button></>}{selectedOrder.status === "REJECTED" && <button className="inventory-order-primary" type="button" disabled={saving} onClick={() => void updateStatus("DRAFT")}><RefreshCw size={15} /> แก้ไขและส่งใหม่</button>}{selectedOrder.status === "APPROVED" && <><span className="purchase-order-approved"><CheckCircle2 size={16} /> PO อนุมัติแล้ว</span><button className="inventory-order-primary" type="button" disabled={saving} onClick={openReceive}><PackageCheck size={16} /> ตรวจรับเข้าสต็อก</button></>}{selectedOrder.status === "RECEIVED" && <span className="purchase-order-received"><PackageCheck size={16} /> รับเข้าสต็อกครบแล้ว</span>}</div></footer>
      </article>
    </section>}
    </AdminShell>
    {receiveOpen && selectedOrder && <div className="purchase-order-receive-layer"><button className="purchase-order-receive-scrim" type="button" aria-label="ปิดหน้าตรวจรับสินค้า" onClick={() => !saving && setReceiveOpen(false)} /><form className="purchase-order-receive-modal" onSubmit={receiveStock}><header><div><span>ตรวจรับสินค้าจาก PO</span><h2>เพิ่มสินค้าเข้าสต็อก</h2><small>{selectedOrder.orderNumber} · {supplierText(selectedOrder)}</small></div><button type="button" aria-label="ปิด" onClick={() => setReceiveOpen(false)} disabled={saving}><X size={20} /></button></header><div className="purchase-order-receive-body"><div className="purchase-order-receive-guide"><PackageCheck size={19} /><div><strong>กรอกข้อมูลรับสินค้าให้ตรงกับเอกสารจริง</strong><span>Supplier และผู้รับดึงจาก PO/ผู้ใช้งานปัจจุบัน ส่วนสถานะจะยืนยันอัตโนมัติเมื่อบันทึก</span></div></div><div className="purchase-order-receive-document-fields"><label><span>เลขที่ใบรับสินค้า *</span><input maxLength={50} value={receiveReceiptNo} onChange={(event) => setReceiveReceiptNo(event.target.value)} required /></label><label><span>วันที่และเวลารับ *</span><input type="datetime-local" value={receiveReceivedAt} onChange={(event) => setReceiveReceivedAt(event.target.value)} required /></label><div><span>Supplier</span><strong>{supplierText(selectedOrder)}</strong></div><div><span>สถานะเมื่อบันทึก</span><strong>ยืนยันแล้ว (CONFIRMED)</strong></div></div><div className="purchase-order-receive-table">{selectedOrder.items.map((item) => <div className="purchase-order-receive-row" key={item.id}><div className="purchase-order-receive-product"><strong>{item.productName}</strong><small>{item.sku} · {item.unit}</small></div><div className="purchase-order-receive-ordered"><span>จำนวนตาม PO</span><strong>{formatQuantity(item.approvedQuantity ?? item.suggestedQuantity)} {item.unit}</strong></div><div className="purchase-order-receive-item-fields"><label><span>จำนวนรับจริง *</span><input type="number" min="0.001" step="0.001" value={receiveLines[item.id]?.quantity ?? ""} onChange={(event) => updateReceiveLine(item.id, "quantity", event.target.value)} required /></label><label><span>ต้นทุน / หน่วย *</span><div><small>฿</small><input type="number" min="0" step="0.01" value={receiveLines[item.id]?.unitCost ?? ""} onChange={(event) => updateReceiveLine(item.id, "unitCost", event.target.value)} required /></div></label><label><span>เลขล็อต *</span><input maxLength={100} value={receiveLines[item.id]?.lotNo ?? ""} onChange={(event) => updateReceiveLine(item.id, "lotNo", event.target.value)} required /></label><label><span>วันหมดอายุ <small>(ถ้ามี)</small></span><input type="date" min={receiveReceivedAt.slice(0, 10)} value={receiveLines[item.id]?.expiryDate ?? ""} onChange={(event) => updateReceiveLine(item.id, "expiryDate", event.target.value)} /></label></div></div>)}</div><div className="purchase-order-receive-summary"><div><span>จำนวนรับรวม</span><strong>{formatQuantity(receiveQuantity)} หน่วย</strong></div><div><span>มูลค่ารับเข้ารวม</span><strong>฿{formatMoney(receiveValue)}</strong></div></div><p className="purchase-order-receive-warning">* ช่องบังคับตาม Database · วันหมดอายุเว้นว่างได้ · การยืนยันจะเพิ่มสต็อกทันทีและไม่สามารถรับ PO เดิมซ้ำได้</p>{error && <div className="api-message error">{error}</div>}</div><footer><button className="inventory-order-secondary" type="button" onClick={() => setReceiveOpen(false)} disabled={saving}>ยกเลิก</button><button className="inventory-order-primary" type="submit" disabled={saving}><PackageCheck size={16} /> {saving ? "กำลังรับเข้าสินค้า..." : "ยืนยันรับเข้าสต็อก"}</button></footer></form></div>}
    <style jsx global>{`
      .purchase-order-page { max-width: 1440px; padding: 30px 40px 56px; }
      .purchase-order-page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .purchase-order-print-button { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
      .purchase-order-view { display: grid; grid-template-columns: minmax(0, 1fr); max-width: 980px; margin-top: 20px; }
      .purchase-order-view.has-order-list { grid-template-columns: 250px minmax(0, 1fr); max-width: 1260px; gap: 18px; }
      .purchase-order-list { overflow: hidden; align-self: start; border: 1px solid var(--border); border-radius: 12px; background: #fff; box-shadow: 0 3px 12px rgba(19, 42, 30, .04); }
      .purchase-order-list-heading { padding: 17px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--border); background: #f3f8f5; }
      .purchase-order-list-heading span { color: var(--muted); font-size: 10px; }
      .purchase-order-list-heading strong { color: var(--ink); font-size: 18px; }
      .purchase-order-list-heading small { color: var(--green); font-size: 10px; font-weight: 700; }
      .purchase-order-list > button { width: 100%; min-height: 76px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 0; border-bottom: 1px solid #edf1ee; color: var(--ink); background: #fff; text-align: left; cursor: pointer; }
      .purchase-order-list > button:last-child { border-bottom: 0; }
      .purchase-order-list > button.selected { background: #eff9f3; box-shadow: inset 3px 0 var(--green); }
      .purchase-order-list > button > div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .purchase-order-list > button strong, .purchase-order-list > button small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .purchase-order-list > button strong { font-size: 11px; }
      .purchase-order-list > button small { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 10px; }
      .purchase-order-document { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; color: var(--ink); background: #fff; box-shadow: 0 3px 12px rgba(19, 42, 30, .04); }
      .purchase-order-document-header { min-height: 132px; padding: 26px 28px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, #f3faf6, #fff); }
      .purchase-order-document-header > div:first-child { min-width: 0; }
      .purchase-order-document-header span { color: var(--green); font-size: 10px; font-weight: 800; letter-spacing: .04em; }
      .purchase-order-document-header h2 { margin: 7px 0 3px; font-size: 24px; }
      .purchase-order-document-header small { color: var(--muted); font-size: 11px; }
      .purchase-order-document-number { flex: 0 0 auto; padding: 12px 14px; border: 1px solid #cfe0d5; border-radius: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; background: #fff; }
      .purchase-order-document-number strong { color: var(--green); font-size: 15px; }
      .purchase-order-meta { padding: 18px 28px; display: grid; grid-template-columns: 1.2fr 1fr .8fr; gap: 14px; border-bottom: 1px solid var(--border); }
      .purchase-order-meta > div { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
      .purchase-order-meta span { color: var(--muted); font-size: 10px; }
      .purchase-order-meta > div > strong { overflow: hidden; display: flex; align-items: center; gap: 6px; color: var(--ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
      .purchase-order-document-heading { min-height: 64px; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); }
      .purchase-order-document-heading > div { display: flex; align-items: baseline; gap: 9px; }
      .purchase-order-document-heading h3 { margin: 0; font-size: 15px; }
      .purchase-order-document-heading span { color: var(--muted); font-size: 10px; }
      .purchase-order-document-heading > svg { color: var(--green); }
      .purchase-order-items-table { overflow-x: auto; }
      .purchase-order-items-table table { min-width: 720px; width: 100%; border-collapse: collapse; }
      .purchase-order-items-table th { height: 44px; padding: 0 16px; color: var(--muted); background: #f7f9ff; font-size: 10px; font-weight: 700; text-align: left; }
      .purchase-order-items-table td { min-height: 60px; padding: 12px 16px; border-top: 1px solid #edf1ee; color: var(--muted); font-size: 11px; }
      .purchase-order-items-table td:first-child { width: 38px; color: var(--ink); text-align: center; }
      .purchase-order-items-table td strong { color: var(--ink); }
      .purchase-order-items-table td small { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; }
      .purchase-order-total { min-height: 70px; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); }
      .purchase-order-total span { color: var(--muted); font-size: 11px; }
      .purchase-order-total strong { color: var(--green); font-size: 19px; }
      .purchase-order-note { margin: 0 28px 22px; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; border-radius: 8px; background: #f3f8f5; }
      .purchase-order-note span { color: var(--muted); font-size: 10px; }
      .purchase-order-note strong { color: var(--ink); font-size: 11px; font-weight: 500; line-height: 1.5; }
      .purchase-order-document-footer { min-height: 72px; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border); background: #f7f9ff; }
      .purchase-order-document-footer > span { color: var(--muted); font-size: 10px; }
      .purchase-order-status-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .purchase-order-approved { min-height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 7px; color: #087a57; background: #daf5e9; font-size: 11px; font-weight: 700; }
      .purchase-order-received { min-height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 7px; color: #165aa7; background: #e6f1ff; font-size: 11px; font-weight: 700; }
      .purchase-order-receipt-banner { margin: 18px 28px 0; padding: 14px 16px; display: flex; align-items: center; gap: 12px; border: 1px solid #bcd8f7; border-radius: 9px; color: #165aa7; background: #f1f7ff; }
      .purchase-order-receipt-banner > div { display: grid; gap: 3px; }
      .purchase-order-receipt-banner span, .purchase-order-receipt-banner small { color: #60758e; font-size: 10px; }
      .purchase-order-receipt-banner strong { font-size: 13px; }
      .purchase-order-receive-layer { position: fixed; z-index: 120; inset: 0; display: grid; place-items: center; padding: 24px; }
      .purchase-order-receive-scrim { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: rgba(18, 35, 26, .58); cursor: pointer; }
      .purchase-order-receive-modal { position: relative; z-index: 1; width: min(1040px, 100%); max-height: calc(100vh - 48px); overflow: hidden; display: flex; flex-direction: column; border-radius: 14px; color: var(--ink); background: #fff; box-shadow: 0 26px 80px rgba(10, 35, 21, .3); }
      .purchase-order-receive-modal > header { padding: 21px 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, #f1faf5, #fff); }
      .purchase-order-receive-modal > header > div { display: grid; gap: 4px; }
      .purchase-order-receive-modal > header span { color: var(--green); font-size: 10px; font-weight: 800; }
      .purchase-order-receive-modal > header h2 { margin: 0; font-size: 21px; }
      .purchase-order-receive-modal > header small { color: var(--muted); font-size: 10px; }
      .purchase-order-receive-modal > header > button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 50%; color: var(--muted); background: transparent; cursor: pointer; }
      .purchase-order-receive-modal > header > button:hover { color: var(--ink); background: #e9f1ec; }
      .purchase-order-receive-body { min-height: 0; overflow-y: auto; padding: 20px 24px; }
      .purchase-order-receive-guide { margin-bottom: 15px; padding: 12px 14px; display: flex; align-items: center; gap: 11px; border-radius: 8px; color: #087a57; background: #eaf8f1; }
      .purchase-order-receive-guide > div { display: grid; gap: 3px; }
      .purchase-order-receive-guide strong { font-size: 11px; }
      .purchase-order-receive-guide span { color: #547067; font-size: 10px; }
      .purchase-order-receive-document-fields { margin-bottom: 15px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .purchase-order-receive-document-fields > label, .purchase-order-receive-document-fields > div { min-width: 0; display: grid; gap: 6px; }
      .purchase-order-receive-document-fields span, .purchase-order-receive-item-fields label > span, .purchase-order-receive-ordered > span { color: var(--muted); font-size: 9px; font-weight: 700; }
      .purchase-order-receive-document-fields input, .purchase-order-receive-document-fields > div > strong { width: 100%; height: 39px; padding: 0 10px; display: flex; align-items: center; overflow: hidden; border: 1px solid #bdcbbf; border-radius: 7px; color: var(--ink); background: #fff; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; box-sizing: border-box; }
      .purchase-order-receive-document-fields > div > strong { background: #f4f7f5; font-weight: 600; }
      .purchase-order-receive-table { overflow: hidden; border: 1px solid var(--border); border-radius: 9px; }
      .purchase-order-receive-row { padding: 14px 15px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px 18px; align-items: center; border-top: 1px solid #e9eeeb; }
      .purchase-order-receive-row:first-child { border-top: 0; }
      .purchase-order-receive-product { min-width: 0; }
      .purchase-order-receive-product strong, .purchase-order-receive-product small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .purchase-order-receive-product strong { font-size: 12px; }
      .purchase-order-receive-product small { margin-top: 4px; color: var(--muted); font-size: 10px; }
      .purchase-order-receive-ordered { display: grid; gap: 4px; text-align: right; }
      .purchase-order-receive-ordered strong { color: var(--green); font-size: 11px; }
      .purchase-order-receive-item-fields { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .purchase-order-receive-item-fields label { min-width: 0; display: grid; gap: 6px; }
      .purchase-order-receive-item-fields label > span small { display: inline; color: #809087; font-size: 8px; font-weight: 500; }
      .purchase-order-receive-item-fields input { width: 100%; height: 38px; padding: 0 10px; border: 1px solid #bdcbbf; border-radius: 7px; color: var(--ink); background: #fff; font-size: 11px; outline: 0; box-sizing: border-box; }
      .purchase-order-receive-item-fields label:first-child input, .purchase-order-receive-item-fields label:nth-child(2) input { text-align: right; }
      .purchase-order-receive-document-fields input:focus, .purchase-order-receive-item-fields input:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0, 108, 73, .09); }
      .purchase-order-receive-item-fields label > div { position: relative; }
      .purchase-order-receive-item-fields label > div small { position: absolute; z-index: 1; top: 11px; left: 10px; margin: 0; color: var(--muted); font-size: 10px; }
      .purchase-order-receive-item-fields label > div input { padding-left: 25px; }
      .purchase-order-receive-summary { margin-top: 14px; display: flex; justify-content: flex-end; gap: 12px; }
      .purchase-order-receive-summary > div { min-width: 180px; padding: 12px 14px; display: grid; gap: 4px; border-radius: 8px; background: #f4f7f5; }
      .purchase-order-receive-summary span { color: var(--muted); font-size: 9px; }
      .purchase-order-receive-summary strong { color: var(--green); font-size: 15px; text-align: right; }
      .purchase-order-receive-warning { margin: 14px 0 0; color: #a36200; font-size: 10px; line-height: 1.5; text-align: right; }
      .purchase-order-receive-modal > footer { padding: 14px 24px; display: flex; justify-content: flex-end; gap: 9px; border-top: 1px solid var(--border); background: #f7f9ff; }
      @media (max-width: 900px) { .purchase-order-view.has-order-list { grid-template-columns: 1fr; }.purchase-order-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }.purchase-order-list-heading { grid-column: 1 / -1; }.purchase-order-list > button { border-right: 1px solid #edf1ee; } }
      @media (max-width: 820px) { .purchase-order-receive-document-fields, .purchase-order-receive-item-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 700px) { .purchase-order-receive-layer { padding: 10px; }.purchase-order-receive-modal { max-height: calc(100vh - 20px); }.purchase-order-receive-summary { display: grid; grid-template-columns: 1fr 1fr; }.purchase-order-receive-summary > div { min-width: 0; } }
      @media (max-width: 480px) { .purchase-order-receive-document-fields, .purchase-order-receive-item-fields { grid-template-columns: 1fr; }.purchase-order-receive-row { grid-template-columns: 1fr; }.purchase-order-receive-ordered { text-align: left; }.purchase-order-receive-summary { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { .purchase-order-page { padding: 22px 16px 42px; }.purchase-order-page-actions { width: 100%; }.purchase-order-page-actions > * { flex: 1; }.purchase-order-document-header { padding: 20px; flex-direction: column; }.purchase-order-document-number { align-items: flex-start; }.purchase-order-meta { padding: 16px 20px; grid-template-columns: 1fr; }.purchase-order-document-heading, .purchase-order-total, .purchase-order-document-footer { padding-inline: 20px; }.purchase-order-note, .purchase-order-receipt-banner { margin-inline: 20px; }.purchase-order-document-footer { align-items: flex-start; flex-direction: column; }.purchase-order-status-actions { width: 100%; justify-content: stretch; }.purchase-order-status-actions > button { flex: 1; }.purchase-order-receive-modal > header, .purchase-order-receive-body, .purchase-order-receive-modal > footer { padding-inline: 16px; }.purchase-order-receive-modal > footer > button { flex: 1; } }
      @media print { .sidebar, .app-header, .purchase-order-page-actions, .purchase-order-list, .purchase-order-document-footer { display: none !important; }.app-main, .section-inventory-orders, .purchase-order-page { padding: 0 !important; margin: 0 !important; max-width: none !important; }.purchase-order-view, .purchase-order-view.has-order-list { display: block; max-width: none; margin: 0; }.purchase-order-document { border: 0; box-shadow: none; } }
    `}</style>
  </>;
}

export default function PurchaseOrderScreen() {
  return (
    <Suspense fallback={<AdminShell active="inventory-orders" contentClassName="purchase-order-page"><div className="api-message">กำลังโหลดใบ PO...</div></AdminShell>}>
      <PurchaseOrderContent />
    </Suspense>
  );
}
