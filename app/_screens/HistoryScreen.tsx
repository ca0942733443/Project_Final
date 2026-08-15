"use client";

import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import ReceiptModal, { ReceiptData } from "../_components/ReceiptModal";
import { apiFetch, errorMessage } from "../_lib/api";

type Order = {
  id: number;
  orderNumber: string;
  total: number;
  status: "pending" | "paid" | "cancelled";
  paymentMethod: "cash" | "qr" | "credit" | null;
  customerName: string | null;
  employeeName: string | null;
  createdAt: string;
};

type OrdersData = { items: Order[]; summary: { totalSales: number; orderCount: number } };
const methodLabels = { cash: "เงินสด", qr: "QR PromptPay", credit: "ขายเชื่อ" } as const;
const statusLabels = { pending: "รอดำเนินการ", paid: "สำเร็จ", cancelled: "ยกเลิก" } as const;

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

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ dateFrom, dateTo });
    if (paymentMethod) query.set("paymentMethod", paymentMethod);
    try {
      setData(await apiFetch<OrdersData>(`/orders?${query}`));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []); // โหลดค่าเริ่มต้นหนึ่งครั้ง แล้วใช้ปุ่มกรองสำหรับการค้นหาครั้งต่อไป

  const filterOrders = (event: FormEvent) => {
    event.preventDefault();
    void loadOrders();
  };

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
    <form className="filter-bar history-filters" onSubmit={filterOrders}><label>ช่วงวันที่<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setDateTo(event.target.value); }} /></label><label>ช่องทางชำระเงิน<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">ทั้งหมด</option><option value="cash">เงินสด</option><option value="qr">QR PromptPay</option><option value="credit">ขายเชื่อ</option></select></label><label>สถานะ<select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="">ทั้งหมด</option><option value="paid">สำเร็จ</option><option value="cancelled">ยกเลิก</option></select></label><button className="primary-button" type="submit">กรองข้อมูล</button></form>
    <section className="data-card history-card">
      {loading && <div className="api-message">กำลังโหลดประวัติการขาย...</div>}
      {error && <div className="api-message error">{error}</div>}
      <div className="table-wrap"><table><thead><tr>{["เลขที่คำสั่งซื้อ", "เวลา", "ยอดรวม", "ชำระโดย", "สถานะ", ""].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{data?.items.slice(0, 4).map(order => <tr key={order.id}><td>{order.orderNumber}</td><td>{new Date(order.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</td><td>฿{order.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td><td>{order.paymentMethod ? methodLabels[order.paymentMethod] : "–"}</td><td><span className={order.status === "paid" ? "success-pill" : "status-pill s-2"}>● {statusLabels[order.status]}</span></td><td><button className="tiny-button" aria-label={`เปิดใบเสร็จ ${order.orderNumber}`} onClick={() => void openReceipt(order)}><Printer size={17} /></button></td></tr>)}</tbody></table></div>
      {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบรายการขายในช่วงที่เลือก</div>}
      <div className="pagination"><span>แสดง {data?.items.length ? 1 : 0}-{Math.min(4, data?.items.length ?? 0)} จาก {data?.summary.orderCount ?? 0} รายการ</span><div><button aria-label="หน้าก่อนหน้า"><ChevronLeft size={17}/></button><button className="selected" aria-current="page">1</button><button>2</button><button>3</button><button aria-label="หน้าถัดไป"><ChevronRight size={17}/></button></div></div>
    </section>
    {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
  </AdminShell>;
}
