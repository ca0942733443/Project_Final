"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FilePlus2,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type RecommendationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
type StatusFilter = RecommendationStatus | "";

type InventoryOrderBase = {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: RecommendationStatus;
  note: string | null;
  createdByName: string;
};

type InventoryOrder = InventoryOrderBase & {
  itemCount: number;
  totalQuantity: number;
  suggestedQuantity: number;
  supplierNames: string | null;
};

type InventoryOrderDetail = InventoryOrderBase & {
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
    historicalSalesQuantity: number;
  }>;
};

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  status: "out" | "low" | "normal";
};

type OrdersSummary = {
  totalOrders: number;
  draftCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalQuantity: number;
};

type OrdersResponse = { items: InventoryOrder[]; summary: OrdersSummary };
type InventoryResponse = { items: InventoryItem[] };

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
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatQuantity(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function suggestedQuantity(item: InventoryItem) {
  return Math.max(0, Number((item.lowStockThreshold * 2 - item.stockQuantity).toFixed(3)));
}

export default function InventoryOrdersScreen() {
  const [orders, setOrders] = useState<InventoryOrder[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>({ totalOrders: 0, draftCount: 0, pendingApprovalCount: 0, approvedCount: 0, rejectedCount: 0, totalQuantity: 0 });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<number, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<InventoryOrderBase | null>(null);
  const [detail, setDetail] = useState<InventoryOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const [orderResponse, inventoryResponse] = await Promise.all([
        apiFetch<OrdersResponse>("/inventory-orders?limit=200"),
        apiFetch<InventoryResponse>("/inventory"),
      ]);
      setOrders(orderResponse.items);
      setSummary(orderResponse.summary);
      setInventory(inventoryResponse.items);
      setPage(1);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesSearch = !query || [order.orderNumber, order.note, order.createdByName, order.supplierNames].some((value) => value?.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const visibleOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage((currentPage) => Math.min(currentPage, totalPages)); }, [totalPages]);

  const candidates = useMemo(() => {
    const lowStockItems = inventory.filter((item) => item.status !== "normal");
    return lowStockItems.length ? lowStockItems : inventory;
  }, [inventory]);

  const selectedCount = Object.values(selectedItems).filter((quantity) => Number(quantity) > 0).length;

  const openCreate = () => {
    const defaults = Object.fromEntries(candidates.filter((item) => suggestedQuantity(item) > 0).map((item) => [item.id, String(Math.ceil(suggestedQuantity(item)))]));
    setSelectedItems(defaults);
    setShowCreate(true);
  };

  const toggleItem = (item: InventoryItem, checked: boolean) => {
    setSelectedItems((current) => {
      const next = { ...current };
      if (checked) next[item.id] = String(Math.max(1, Math.ceil(suggestedQuantity(item))));
      else delete next[item.id];
      return next;
    });
  };

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = Object.entries(selectedItems).map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) })).filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
    if (!items.length) {
      setError("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      await apiFetch("/inventory-orders", { method: "POST", body: JSON.stringify({ note: form.get("note"), items }) });
      setShowCreate(false);
      setSelectedItems({});
      await loadOrders();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (order: InventoryOrder) => {
    setSelectedOrder(order);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await apiFetch<InventoryOrderDetail>(`/inventory-orders/${order.id}`));
    } catch (loadError) {
      setDetailError(errorMessage(loadError));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedOrder(null);
    setDetail(null);
    setDetailError("");
  };

  const updateStatus = async (nextStatus: RecommendationStatus) => {
    if (!selectedOrder) return;
    setSaving(true);
    setDetailError("");
    try {
      await apiFetch(`/inventory-orders/${selectedOrder.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await loadOrders();
      const refreshed = await apiFetch<InventoryOrderDetail>(`/inventory-orders/${selectedOrder.id}`);
      setSelectedOrder(refreshed);
      setDetail(refreshed);
    } catch (updateError) {
      setDetailError(errorMessage(updateError));
    } finally {
      setSaving(false);
    }
  };

  return <AdminShell active="inventory-orders">
    <PageTitle title="คำสั่งซื้อสินค้าคงคลัง" subtitle="วางแผนเติมสต็อกจากระดับสินค้าคงคลังและรายการแนะนำ" action={<button className="primary-button inventory-order-create-button" type="button" onClick={openCreate}><FilePlus2 size={17} /> สร้างคำสั่งซื้อ</button>} />

    <section className="inventory-order-summary" aria-label="สรุปคำสั่งซื้อสินค้าคงคลัง">
      <article className="inventory-order-summary-card"><span><ClipboardList size={17} /> คำสั่งซื้อทั้งหมด</span><strong>{summary.totalOrders.toLocaleString("th-TH")}</strong><small>รายการที่บันทึกในระบบ</small></article>
      <article className="inventory-order-summary-card is-pending"><span><Clock3 size={17} /> รออนุมัติ</span><strong>{summary.pendingApprovalCount.toLocaleString("th-TH")}</strong><small>รอผู้มีสิทธิ์ตรวจสอบ</small></article>
      <article className="inventory-order-summary-card is-approved"><span><CheckCircle2 size={17} /> อนุมัติแล้ว</span><strong>{summary.approvedCount.toLocaleString("th-TH")}</strong><small>พร้อมดำเนินการสั่งซื้อ</small></article>
      <article className="inventory-order-summary-card is-quantity"><span><PackageCheck size={17} /> ปริมาณที่ต้องเติม</span><strong>{formatQuantity(summary.totalQuantity)}</strong><small>หน่วยฐานจากรายการที่ยังไม่ปิด</small></article>
    </section>

    <section className="inventory-order-panel">
      <div className="inventory-order-tabs" role="tablist" aria-label="กรองสถานะคำสั่งซื้อ">
        {([["", "ทั้งหมด", summary.totalOrders], ["DRAFT", "ฉบับร่าง", summary.draftCount], ["PENDING_APPROVAL", "รออนุมัติ", summary.pendingApprovalCount], ["APPROVED", "อนุมัติแล้ว", summary.approvedCount], ["REJECTED", "ไม่อนุมัติ", summary.rejectedCount]] as const).map(([status, label, count]) => <button key={status || "all"} type="button" role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? "selected" : ""} onClick={() => { setStatusFilter(status); setPage(1); }}>{label}<b>{count}</b></button>)}
      </div>
      <div className="inventory-order-toolbar"><label><span>ค้นหาคำสั่งซื้อ</span><div className="inventory-order-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="เลขที่คำสั่งซื้อ ผู้จำหน่าย หรือผู้สร้าง" /></div></label><label><span>สถานะ</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }}><option value="">ทุกสถานะ</option><option value="DRAFT">ฉบับร่าง</option><option value="PENDING_APPROVAL">รออนุมัติ</option><option value="APPROVED">อนุมัติแล้ว</option><option value="REJECTED">ไม่อนุมัติ</option></select></label><button type="button" className="inventory-order-refresh" onClick={() => void loadOrders()}><RefreshCw size={15} /> รีเฟรช</button></div>

      {error && <div className="api-message error">{error}</div>}
      <div className="inventory-order-table-heading"><div><h2>รายการคำสั่งซื้อสินค้าคงคลัง</h2><p>{loading ? "กำลังโหลดข้อมูล..." : `พบ ${filteredOrders.length.toLocaleString("th-TH")} รายการ`}</p></div><span><i /> เชื่อมต่อ Database แล้ว</span></div>
      {loading && <div className="inventory-order-loading"><span className="loading-spinner" /> กำลังโหลดคำสั่งซื้อ...</div>}
      {!loading && visibleOrders.length === 0 && <div className="inventory-order-empty"><AlertTriangle size={27} /><strong>ยังไม่มีคำสั่งซื้อในมุมมองนี้</strong><span>เลือกสินค้าสต็อกต่ำแล้วกด “สร้างคำสั่งซื้อ” เพื่อเริ่มรายการใหม่</span></div>}
      {!loading && visibleOrders.length > 0 && <div className="table-wrap inventory-order-table-wrap"><table><thead><tr><th>คำสั่งซื้อ</th><th>วันที่สร้าง</th><th>สินค้า</th><th>ผู้จำหน่าย</th><th>จำนวนที่สั่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id}><td><strong className="inventory-order-number">{order.orderNumber}</strong><small>{order.note ?? "ไม่มีหมายเหตุ"}</small></td><td>{formatDate(order.orderDate)}</td><td><strong>{order.itemCount}</strong> รายการ</td><td><span className="inventory-order-supplier">{order.supplierNames ?? "ผู้จำหน่ายทั่วไป"}</span></td><td><strong className="inventory-order-quantity">{formatQuantity(order.totalQuantity)}</strong> หน่วย</td><td><span className={statusClasses[order.status]}>{statusLabels[order.status]}</span></td><td><button type="button" className="inventory-order-view" onClick={() => void openDetail(order)}><Eye size={15} /> รายละเอียด</button></td></tr>)}</tbody></table></div>}
      <div className="inventory-order-pagination"><span>แสดง {filteredOrders.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredOrders.length)} จาก {filteredOrders.length} รายการ</span><div><button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button><strong>หน้า {page} / {totalPages}</strong><button type="button" aria-label="หน้าถัดไป" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></button></div></div>
    </section>

    {showCreate && <div className="inventory-order-modal-layer"><button type="button" className="inventory-order-modal-scrim" aria-label="ปิดหน้าสร้างคำสั่งซื้อ" onClick={() => setShowCreate(false)} /><form className="inventory-order-create-modal" onSubmit={createOrder}><header><div><span>เติมสต็อกสินค้า</span><h2>สร้างคำสั่งซื้อใหม่</h2></div><button type="button" className="inventory-order-close" aria-label="ปิด" onClick={() => setShowCreate(false)}><X size={19} /></button></header><div className="inventory-order-create-body"><p className="inventory-order-helper">ระบบเลือกสินค้าที่สต็อกต่ำหรือหมดไว้ให้แล้ว แก้ไขจำนวนก่อนบันทึกได้</p><div className="inventory-order-create-list">{candidates.map((item) => { const checked = selectedItems[item.id] !== undefined; return <div className={`inventory-order-create-row ${checked ? "selected" : ""}`} key={item.id}><label><input type="checkbox" checked={checked} onChange={(event) => toggleItem(item, event.target.checked)} /><span><strong>{item.name}</strong><small>{item.sku} · คงเหลือ {formatQuantity(item.stockQuantity)} {item.unit}</small></span></label><div><input aria-label={`จำนวน ${item.name}`} type="number" min="0.001" step="0.001" disabled={!checked} value={selectedItems[item.id] ?? ""} onChange={(event) => setSelectedItems((current) => ({ ...current, [item.id]: event.target.value }))} /><small>{item.unit}</small></div></div>; })}</div>{!candidates.length && <div className="inventory-order-empty compact"><AlertTriangle size={22} /><span>ไม่พบสินค้าในฐานข้อมูล</span></div>}<label className="inventory-order-note"><span>หมายเหตุ</span><textarea name="note" rows={3} placeholder="เช่น รอบสั่งซื้อประจำสัปดาห์ หรือเหตุผลที่ต้องเติมสต็อก" /></label></div><footer><span>{selectedCount} รายการที่เลือก</span><button type="button" className="inventory-order-secondary" onClick={() => setShowCreate(false)}>ยกเลิก</button><button type="submit" className="inventory-order-primary" disabled={saving || selectedCount === 0}>{saving ? "กำลังบันทึก..." : "บันทึกฉบับร่าง"}</button></footer></form></div>}

    {selectedOrder && <div className="inventory-order-drawer-layer"><button type="button" className="inventory-order-drawer-scrim" aria-label="ปิดรายละเอียด" onClick={closeDetail} /><aside className="inventory-order-drawer" role="dialog" aria-modal="true" aria-labelledby="inventory-order-detail-title"><header><div><span>รายละเอียดคำสั่งซื้อ</span><h2 id="inventory-order-detail-title">{selectedOrder.orderNumber}</h2></div><button type="button" className="inventory-order-close" aria-label="ปิด" onClick={closeDetail}><X size={19} /></button></header>{detailLoading && <div className="inventory-order-loading"><span className="loading-spinner" /> กำลังโหลดรายละเอียด...</div>}{!detailLoading && detailError && <div className="api-message error">{detailError}</div>}{!detailLoading && detail && <div className="inventory-order-detail-body"><div className="inventory-order-detail-meta"><div><span>วันที่สร้าง</span><strong>{formatDate(detail.orderDate)}</strong><small>สร้างโดย {detail.createdByName}</small></div><span className={statusClasses[detail.status]}>{statusLabels[detail.status]}</span></div><div className="inventory-order-detail-note"><span>หมายเหตุ</span><strong>{detail.note ?? "ไม่มีหมายเหตุ"}</strong></div><div className="inventory-order-detail-items"><div><h3>รายการสินค้า</h3><span>{detail.items.length} รายการ</span></div><ul>{detail.items.map((item) => <li key={item.id}><div><strong>{item.productName}</strong><small>{item.sku} · {item.unit}</small></div><div><strong>{formatQuantity(item.approvedQuantity ?? item.suggestedQuantity)}</strong><small>สต็อก {formatQuantity(item.currentStock)} / จุดสั่ง {formatQuantity(item.reorderPoint)}</small></div></li>)}</ul></div><div className="inventory-order-detail-total"><span>รวมปริมาณที่สั่ง</span><strong>{formatQuantity(detail.items.reduce((sum, item) => sum + Number(item.approvedQuantity ?? item.suggestedQuantity), 0))} หน่วย</strong></div><div className="inventory-order-detail-actions">{detail.status === "DRAFT" && <button type="button" className="inventory-order-primary full" disabled={saving} onClick={() => void updateStatus("PENDING_APPROVAL")}><Send size={15} /> ส่งขออนุมัติ</button>}{detail.status === "PENDING_APPROVAL" && <><button type="button" className="inventory-order-danger" disabled={saving} onClick={() => void updateStatus("REJECTED")}><Ban size={15} /> ไม่อนุมัติ</button><button type="button" className="inventory-order-primary" disabled={saving} onClick={() => void updateStatus("APPROVED")}><Check size={15} /> อนุมัติคำสั่งซื้อ</button></>}{detail.status === "REJECTED" && <button type="button" className="inventory-order-primary full" disabled={saving} onClick={() => void updateStatus("DRAFT")}><RefreshCw size={15} /> แก้ไขและส่งใหม่</button>}{detail.status === "APPROVED" && <div className="inventory-order-approved-message"><CheckCircle2 size={17} /> คำสั่งซื้อนี้ได้รับการอนุมัติแล้ว</div>}</div></div>}</aside></div>}
  </AdminShell>;
}
