"use client";

import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import ReceiptModal, { ReceiptData } from "../_components/ReceiptModal";
import { apiFetch, errorMessage } from "../_lib/api";

type Order = {
  id: number;
  orderNumber: string;
  total: number;
  status: "paid" | "cancelled";
  paymentMethod: "cash" | "qr" | "credit" | null;
  customerName: string | null;
  employeeName: string | null;
  createdAt: string;
};

type OrdersData = { items: Order[]; summary: { totalSales: number; orderCount: number } };
const methodLabels = { cash: "เงินสด", qr: "QR PromptPay", credit: "ขายเชื่อ" } as const;
const statusLabels = { paid: "สำเร็จ", cancelled: "ยกเลิก" } as const;
type SortKey = "orderNumber" | "createdAt" | "total" | "paymentMethod" | "status";
type SortDirection = "asc" | "desc";
type OrderFilters = { dateFrom: string; dateTo: string; paymentMethod: string; orderStatus: string };
const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "orderNumber", label: "เลขที่คำสั่งซื้อ" },
  { key: "createdAt", label: "เวลา" },
  { key: "total", label: "ยอดรวม" },
  { key: "paymentMethod", label: "ชำระโดย" },
  { key: "status", label: "สถานะ" },
];

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function HistoryScreen() {
  const [dateFrom, setDateFrom] = useState(localDateValue);
  const [dateTo, setDateTo] = useState(localDateValue);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadOrders = async (filterOverrides: Partial<OrderFilters> = {}) => {
    setLoading(true);
    setError("");
    const filters: OrderFilters = { dateFrom, dateTo, paymentMethod, orderStatus, ...filterOverrides };
    const query = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    if (filters.paymentMethod) query.set("paymentMethod", filters.paymentMethod);
    if (filters.orderStatus) query.set("status", filters.orderStatus);
    try {
      setData(await apiFetch<OrdersData>(`/orders?${query}`));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []); // โหลดข้อมูลเริ่มต้นหนึ่งครั้ง ส่วนตัวกรองจะโหลดใหม่ทันทีเมื่อเปลี่ยนค่า

  const filterOrders = (event: FormEvent) => {
    event.preventDefault();
    void loadOrders();
  };

  const sortOrders = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const sortedOrders = [...(data?.items ?? [])].sort((left, right) => {
    let comparison = 0;

    if (sortKey === "orderNumber") {
      comparison = left.orderNumber.localeCompare(right.orderNumber, "th", { numeric: true });
    } else if (sortKey === "createdAt") {
      comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    } else if (sortKey === "total") {
      comparison = left.total - right.total;
    } else if (sortKey === "paymentMethod") {
      comparison = (left.paymentMethod ? methodLabels[left.paymentMethod] : "–").localeCompare(right.paymentMethod ? methodLabels[right.paymentMethod] : "–", "th");
    } else {
      comparison = statusLabels[left.status].localeCompare(statusLabels[right.status], "th");
    }

    if (comparison === 0) return right.id - left.id;
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const openReceipt = async (order: Order) => {
    type OrderDetail = { orderNumber: string; subtotal: number; total: number; createdAt: string; items: Array<{ productName: string; quantity: number; lineTotal: number }>; payments: Array<{ method: "cash" | "qr" | "credit"; amountReceived: number; changeAmount: number }> };
    try {
      const detail = await apiFetch<OrderDetail>(`/orders/${order.orderNumber}`);
      const payment = detail.payments.at(-1);
      setReceipt({ orderNumber: detail.orderNumber, createdAt: detail.createdAt, items: detail.items, subtotal: detail.subtotal, total: detail.total, paymentMethod: payment?.method ?? "cash", amountReceived: payment?.amountReceived ?? detail.total, changeAmount: payment?.changeAmount ?? 0 });
    } catch (receiptError) {
      setError(errorMessage(receiptError));
    }
  };

  return <AdminShell active="history">
    <PageTitle title="รายการย้อนหลัง" subtitle="ตรวจสอบประวัติการขายที่บันทึกใน MySQL" action={<div className="history-summary"><span>ยอดรวมตามตัวกรอง <b>฿{(data?.summary.totalSales ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</b></span><span>จำนวนบิล <b>{data?.summary.orderCount ?? 0} รายการ</b></span></div>} />
    <form className="filter-bar history-filters" onSubmit={filterOrders}><label>ช่วงวันที่<input type="date" value={dateFrom} onChange={(event) => { const value = event.target.value; setDateFrom(value); setDateTo(value); void loadOrders({ dateFrom: value, dateTo: value }); }} /></label><label>ช่องทางชำระเงิน<select value={paymentMethod} onChange={(event) => { const value = event.target.value; setPaymentMethod(value); void loadOrders({ paymentMethod: value }); }}><option value="">ทั้งหมด</option><option value="cash">เงินสด</option><option value="qr">QR PromptPay</option><option value="credit">ขายเชื่อ</option></select></label><label>สถานะ<select value={orderStatus} onChange={(event) => { const value = event.target.value; setOrderStatus(value); void loadOrders({ orderStatus: value }); }}><option value="">ทั้งหมด</option><option value="paid">สำเร็จ</option><option value="cancelled">ยกเลิก</option></select></label><button className="primary-button" type="submit">กรองข้อมูล</button></form>
    <section className="data-card history-card">
      {loading && <div className="api-message">กำลังโหลดประวัติการขาย...</div>}
      {error && <div className="api-message error">{error}</div>}
      <div className="table-wrap"><table><thead><tr>{sortableColumns.map(({ key, label }) => <th key={key} aria-sort={sortKey === key ? sortDirection === "asc" ? "ascending" : "descending" : "none"}><button type="button" className="sort-button" title={`เรียงตาม${label}`} aria-label={`เรียงตาม${label}${sortKey === key ? (sortDirection === "asc" ? " จากน้อยไปมาก" : "จากมากไปน้อย") : ""}`} onClick={() => sortOrders(key)}>{label}{sortKey === key ? (sortDirection === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowDownUp size={14} aria-hidden="true" />}</button></th>)}<th aria-label="การจัดการ" /></tr></thead><tbody>{sortedOrders.slice(0, 4).map(order => <tr key={order.id}><td>{order.orderNumber}</td><td>{new Date(order.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</td><td>฿{order.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td><td>{order.paymentMethod ? methodLabels[order.paymentMethod] : "–"}</td><td><span className={order.status === "paid" ? "success-pill" : "status-pill s-2"}>● {statusLabels[order.status]}</span></td><td><button type="button" className="tiny-button" aria-label={`เปิดใบเสร็จ ${order.orderNumber}`} onClick={() => void openReceipt(order)}><Printer size={17} /></button></td></tr>)}</tbody></table></div>
      {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบรายการขายในช่วงที่เลือก</div>}
      <div className="pagination"><span>แสดง {data?.items.length ? 1 : 0}-{Math.min(4, data?.items.length ?? 0)} จาก {data?.summary.orderCount ?? 0} รายการ</span><div><button aria-label="หน้าก่อนหน้า"><ChevronLeft size={17}/></button><button className="selected" aria-current="page">1</button><button>2</button><button>3</button><button aria-label="หน้าถัดไป"><ChevronRight size={17}/></button></div></div>
    </section>
    {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
  </AdminShell>;
}
