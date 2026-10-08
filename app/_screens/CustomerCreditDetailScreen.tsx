"use client";

import { ArrowLeft, Banknote, Eye, Phone, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type CreditInvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

type Customer = {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
  location: string;
  carTypeName: string | null;
  creditLimit: number;
  balanceDue: number;
  overdueBalance: number;
  orderCount: number;
  totalSpent: number;
  favoriteProduct: string | null;
  lastPurchaseAt: string | null;
};

type CreditInvoice = {
  id: number;
  saleId: number;
  saleNumber: string;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  originalAmount: number;
  outstandingAmount: number;
  status: CreditInvoiceStatus;
  dueDate: string | null;
  createdAt: string;
  itemCount: number;
};

type CreditInvoiceDetail = CreditInvoice & {
  cashierName: string;
  subtotal: number;
  discountAmount: number;
  paidAmount: number;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: number;
    paidAmount: number;
    paymentMethod: "CASH" | "QR_CODE" | "BANK_TRANSFER";
    referenceNumber: string | null;
    paidAt: string;
    receivedByName: string;
  }>;
};

type CreditInvoicesData = {
  items: CreditInvoice[];
  summary: { invoiceCount: number; originalAmount: number; outstandingAmount: number; overdueAmount: number };
};

const statusLabels: Record<CreditInvoiceStatus, string> = {
  UNPAID: "ยังไม่ชำระ",
  PARTIAL: "ชำระบางส่วน",
  PAID: "ชำระครบแล้ว",
  OVERDUE: "เกินกำหนด",
};

const paymentLabels = {
  CASH: "เงินสด",
  QR_CODE: "QR PromptPay",
  BANK_TRANSFER: "โอนธนาคาร",
} as const;

function money(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantity(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function date(value: string | null) {
  if (!value) return "ไม่ระบุ";
  const normalized = value.length === 10 ? `${value}T00:00:00` : value;
  return new Date(normalized).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(status: CreditInvoiceStatus) {
  if (status === "OVERDUE") return "overdue";
  if (status === "PAID") return "paid";
  if (status === "PARTIAL") return "partial";
  return "unpaid";
}

export default function CustomerCreditDetailScreen() {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [creditData, setCreditData] = useState<CreditInvoicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<CreditInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paying, setPaying] = useState(false);

  const loadPage = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const [nextCustomer, nextCreditData] = await Promise.all([
        apiFetch<Customer>(`/customers/${id}`),
        apiFetch<CreditInvoicesData>(`/credit-invoices?customerId=${id}&status=all`),
      ]);
      setCustomer(nextCustomer);
      setCreditData(nextCreditData);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (invoiceId: number, showLoading = true) => {
    if (showLoading) setDetailLoading(true);
    setDetailError("");
    try {
      const nextDetail = await apiFetch<CreditInvoiceDetail>(`/credit-invoices/${invoiceId}`);
      setDetail(nextDetail);
      setPaymentAmount(nextDetail.outstandingAmount > 0 ? String(nextDetail.outstandingAmount) : "");
    } catch (loadError) {
      setDetailError(errorMessage(loadError));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      setError("ไม่พบรหัสลูกค้าที่ต้องการเปิด");
      setLoading(false);
      return;
    }
    setCustomerId(id);
    void loadPage(id);
  }, []);

  const openDetail = (invoiceId: number) => {
    setDetail(null);
    setPaymentMessage("");
    setPaymentReference("");
    setPaymentMethod("cash");
    void loadDetail(invoiceId);
  };

  const closeDetail = () => {
    if (paying) return;
    setDetail(null);
    setDetailError("");
    setPaymentMessage("");
  };

  const refreshPage = () => {
    if (customerId) void loadPage(customerId);
  };

  const receivePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !customerId) return;
    setPaying(true);
    setDetailError("");
    setPaymentMessage("");
    try {
      const result = await apiFetch<{ paidAmount: number; outstandingAmount: number }>(`/credit-invoices/${detail.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          referenceNumber: paymentReference,
        }),
      });
      setPaymentMessage(`รับชำระสำเร็จ ฿${money(result.paidAmount)} · คงเหลือ ฿${money(result.outstandingAmount)}`);
      setPaymentReference("");
      await Promise.all([loadPage(customerId), loadDetail(detail.id, false)]);
    } catch (paymentError) {
      setDetailError(errorMessage(paymentError));
    } finally {
      setPaying(false);
    }
  };

  const availableCredit = Math.max(0, Number(customer?.creditLimit ?? 0) - Number(customer?.balanceDue ?? 0));
  const invoices = creditData?.items ?? [];

  return <AdminShell active="customers">
    <PageTitle
      title={customer ? `ข้อมูลลูกค้า · ${customer.fullName}` : "ข้อมูลลูกค้าและบัญชีขายเชื่อ"}
      subtitle="ข้อมูลลูกค้า วงเงิน รายการบิล และสินค้าที่ซื้อในแต่ละบิลอยู่ในหน้านี้"
      action={<div className="product-page-actions"><Link className="secondary-button" href="/customers"><ArrowLeft size={16} /> กลับรายชื่อลูกค้า</Link><button className="secondary-button" disabled={loading || !customerId} onClick={refreshPage} type="button"><RefreshCw size={16} /> รีเฟรช</button></div>}
    />

    {loading && <div className="api-message">กำลังโหลดข้อมูลลูกค้าและบิลขายเชื่อ...</div>}
    {error && <div className="api-message error">{error}</div>}

    {customer && <>
      <section className="data-card customer-credit-profile">
        <div className="customer-credit-avatar">{customer.fullName.charAt(0)}</div>
        <div className="customer-credit-name"><span>{customer.customerCode}</span><h2>{customer.fullName}</h2><p><Phone size={14} /> {customer.phone ?? "ไม่ระบุเบอร์โทร"}</p></div>
        <dl><div><dt>ทะเบียนรถ</dt><dd>{customer.carPlate ?? "–"}</dd></div><div><dt>ประเภทรถ</dt><dd>{customer.carTypeName ?? "–"}</dd></div><div><dt>สถานที่</dt><dd>{customer.location || "–"}</dd></div><div><dt>สินค้าที่ซื้อบ่อย</dt><dd>{customer.favoriteProduct ?? "–"}</dd></div><div><dt>จำนวนบิลทั้งหมด</dt><dd>{Number(customer.orderCount).toLocaleString("th-TH")} บิล</dd></div><div><dt>ยอดซื้อสะสม</dt><dd>฿{money(customer.totalSpent)}</dd></div></dl>
      </section>

      <div className="stat-grid four customer-credit-stats">
        <Stat label="วงเงินขายเชื่อ" value={`฿${money(customer.creditLimit)}`} />
        <Stat label="ยอดค้างปัจจุบัน" value={`฿${money(customer.balanceDue)}`} tone={Number(customer.balanceDue) > 0 ? "orange" : "neutral"} />
        <Stat label="วงเงินคงเหลือ" value={`฿${money(availableCredit)}`} />
        <Stat label="ยอดเกินกำหนด" value={`฿${money(customer.overdueBalance)}`} tone={Number(customer.overdueBalance) > 0 ? "orange" : "neutral"} />
      </div>

      <section className="data-card customer-credit-invoices">
        <div className="customer-credit-section-heading"><div><h2>รายการบิลขายเชื่อ</h2><p>กดดูรายละเอียดเพื่อดูว่าสินค้าใดถูกซื้อในแต่ละบิล</p></div><span>{invoices.length} บิล</span></div>
        <div className="table-wrap"><table><thead><tr><th>เลขที่บิลเชื่อ</th><th>วันที่ขาย</th><th>จำนวนสินค้า</th><th>ยอดบิล</th><th>ยอดค้าง</th><th>ครบกำหนด</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>
          {invoices.map((invoice) => <tr key={invoice.id}><td><button className="credit-invoice-link" onClick={() => openDetail(invoice.id)} type="button">{invoice.invoiceNumber}</button><small>{invoice.saleNumber}</small></td><td>{date(invoice.createdAt)}</td><td>{Number(invoice.itemCount)} รายการ</td><td>฿{money(invoice.originalAmount)}</td><td><strong className={invoice.outstandingAmount > 0 ? "danger-text" : ""}>฿{money(invoice.outstandingAmount)}</strong></td><td>{date(invoice.dueDate)}</td><td><span className={`credit-status ${statusClass(invoice.status)}`}>{statusLabels[invoice.status]}</span></td><td><button aria-label={`ดูรายละเอียด ${invoice.invoiceNumber}`} className="tiny-button" onClick={() => openDetail(invoice.id)} type="button"><Eye size={16} /></button></td></tr>)}
          {invoices.length === 0 && <tr><td className="empty-cell" colSpan={8}>ลูกค้ารายนี้ยังไม่มีบิลขายเชื่อ</td></tr>}
        </tbody></table></div>
      </section>
    </>}

    {(detailLoading || detail || detailError) && <div className="modal-backdrop credit-detail-backdrop" onMouseDown={closeDetail}><section aria-label="รายละเอียดบิลขายเชื่อ" aria-modal="true" className="modal credit-detail-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="ปิด" className="modal-close" onClick={closeDetail} type="button"><X /></button>
      {detailLoading && <div className="credit-detail-loading">กำลังโหลดรายละเอียดบิล...</div>}
      {detailError && <div className="form-error">{detailError}</div>}
      {detail && <>
        <header className="credit-detail-header"><div><span>รายละเอียดบิลขายเชื่อ</span><h2>{detail.invoiceNumber}</h2><p>{detail.saleNumber} · ขายโดย {detail.cashierName}</p></div><span className={`credit-status ${statusClass(detail.status)}`}>{statusLabels[detail.status]}</span></header>
        <div className="credit-detail-customer"><div><span>ลูกค้า</span><strong>{detail.customerName}</strong></div><div><span>วันที่ขาย</span><strong>{date(detail.createdAt)}</strong></div><div><span>ครบกำหนด</span><strong>{date(detail.dueDate)}</strong></div></div>
        <div className="credit-detail-summary"><span>ยอดบิล <b>฿{money(detail.originalAmount)}</b></span><span>ชำระแล้ว <b>฿{money(detail.paidAmount)}</b></span><span className={detail.outstandingAmount > 0 ? "outstanding" : ""}>ยอดค้าง <b>฿{money(detail.outstandingAmount)}</b></span></div>

        <section className="credit-detail-section"><div className="credit-detail-section-title"><h3>สินค้าที่ซื้อในบิลนี้</h3><span>{detail.items.length} รายการ</span></div><div className="table-wrap credit-detail-items"><table><thead><tr><th>สินค้า</th><th>จำนวน</th><th>หน่วย</th><th>ราคาต่อหน่วย</th><th>ส่วนลด</th><th>รวม</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong></td><td>{quantity(item.quantity)}</td><td>{item.unitName}</td><td>฿{money(item.unitPrice)}</td><td>฿{money(item.discountAmount)}</td><td><strong>฿{money(item.lineTotal)}</strong></td></tr>)}</tbody></table></div></section>

        <section className="credit-detail-section"><div className="credit-detail-section-title"><h3>ประวัติรับชำระ</h3><span>{detail.payments.length} ครั้ง</span></div>{detail.payments.length > 0 ? <div className="table-wrap credit-detail-payments"><table><thead><tr><th>วันที่</th><th>ช่องทาง</th><th>ผู้รับเงิน</th><th>เลขอ้างอิง</th><th>ยอดรับ</th></tr></thead><tbody>{detail.payments.map((payment) => <tr key={payment.id}><td>{new Date(payment.paidAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</td><td>{paymentLabels[payment.paymentMethod]}</td><td>{payment.receivedByName}</td><td>{payment.referenceNumber ?? "–"}</td><td><strong>฿{money(payment.paidAmount)}</strong></td></tr>)}</tbody></table></div> : <p className="credit-detail-empty">ยังไม่มีประวัติรับชำระสำหรับบิลนี้</p>}</section>

        {paymentMessage && <div className="api-message success">{paymentMessage}</div>}
        {detail.outstandingAmount > 0 && <form className="credit-payment-form credit-detail-payment-form" onSubmit={receivePayment}><label>ยอดรับชำระ<input max={detail.outstandingAmount} min="0.01" onChange={(event) => setPaymentAmount(event.target.value)} required step="0.01" type="number" value={paymentAmount} /></label><label>ช่องทาง<select onChange={(event) => setPaymentMethod(event.target.value)} value={paymentMethod}><option value="cash">เงินสด</option><option value="qr">QR PromptPay</option><option value="bank_transfer">โอนธนาคาร</option></select></label><label>เลขอ้างอิง<input onChange={(event) => setPaymentReference(event.target.value)} placeholder="ไม่บังคับ" value={paymentReference} /></label><button className="primary-button" disabled={paying} type="submit"><Banknote size={16} /> {paying ? "กำลังรับชำระ..." : "ยืนยันรับชำระ"}</button></form>}
      </>}
    </section></div>}
  </AdminShell>;
}
