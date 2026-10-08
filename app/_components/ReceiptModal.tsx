"use client";

import { Check, Printer, Award } from "lucide-react";
import { useEffect } from "react";

export type ReceiptData = {
  orderNumber: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; lineTotal: number }>;
  subtotal: number;
  discountAmount?: number;
  total: number;
  paymentMethod: "cash" | "qr" | "credit";
  amountReceived: number;
  changeAmount: number;
  customerName?: string;
  pointsEarned?: number;
};

const paymentLabels = { cash: "เงินสด", qr: "QR PromptPay", credit: "ขายเชื่อ" } as const;

export default function ReceiptModal({ receipt, success = false, onClose }: { receipt: ReceiptData; success?: boolean; onClose: () => void }) {
  return <div className="receipt-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`receipt-modal ${success ? "receipt-success" : ""}`} aria-modal="true" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
      {success && <header className="receipt-success-head"><span><Check size={39}/></span><h2>ชำระเงินสำเร็จ</h2><p>ธุรกรรมเสร็จสิ้นเรียบร้อยแล้ว</p></header>}
      <div className="receipt-content">
        <button className="receipt-close" aria-label="ปิดใบเสร็จ" onClick={onClose}><X size={28}/></button>
        <div className="receipt-brand"><strong>CAPTAIN GAI SOD</strong><span>(Main Branch)</span></div>
        <div className="receipt-meta"><span>เลขที่อ้างอิง: #{receipt.orderNumber}</span><span>{new Date(receipt.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        <div className="receipt-items">{receipt.items.map((item, index) => <div className="receipt-item" key={`${item.productName}-${index}`}><span>{item.productName}<small>x{item.quantity}</small></span><strong>฿{item.lineTotal.toFixed(2)}</strong></div>)}</div>
        <div className="receipt-summary"><span>ยอดรวมสินค้า (Subtotal)<b>฿{receipt.subtotal.toFixed(2)}</b></span><span>ส่วนลด<b>฿0.00</b></span><strong>รวมทั้งสิ้น (Total)<b>฿{receipt.total.toFixed(2)}</b></strong></div>
        <div className="receipt-payment"><span>ช่องทางการชำระ:<b>{paymentLabels[receipt.paymentMethod]}</b></span>{receipt.paymentMethod === "credit" ? <><span>สถานะ:<b>ยังไม่ชำระ</b></span><span>ยอดค้างชำระ:<b>฿{receipt.total.toFixed(2)}</b></span></> : <><span>รับเงินมา:<b>฿{receipt.amountReceived.toFixed(2)}</b></span><span>เงินทอน:<b>฿{receipt.changeAmount.toFixed(2)}</b></span></>}</div>
        <p className="receipt-points">ได้รับคะแนนสะสม +68 คะแนน (ยอดรวม: 1,420 คะแนน)</p>
        <div className="receipt-buttons">{success && <button onClick={onClose}>เสร็จสิ้น</button>}<button className="receipt-print" onClick={() => window.print()}><Printer size={19}/> พิมพ์ใบเสร็จ</button></div>
      </div>
    </section>
  </div>;
}
type ReceiptModalProps = {
  receipt: ReceiptData;
  success?: boolean;
  autoPrint?: boolean;
  onClose: () => void;
};

export default function ReceiptModal({ receipt, success = false, autoPrint = false, onClose }: ReceiptModalProps) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="receipt-backdrop" role="presentation">
      <section className={`receipt-modal ${success ? "receipt-success" : ""}`} aria-modal="true" role="dialog">
        {success && (
          <header className="receipt-success-head no-print">
            <span><Check size={32} /></span>
            <h2>ชำระเงินสำเร็จ</h2>
            <p>ธุรกรรมเสร็จสิ้นเรียบร้อยแล้ว</p>
          </header>
        )}
        
        <div className="receipt-content" id="printable-receipt">
          <div className="receipt-brand">
            <strong>CAPTAIN GAI SOD</strong>
            <span>ใบเสร็จรับเงิน</span>
          </div>

          {/* ส่วนจัดการส่วนหัว metadata ของใบเสร็จ */}
          <div className="receipt-meta" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {/* บรรทัดที่ 1: เลขที่อ้างอิง (ซ้ายสุด) & วันเวลา (ขวาสุด) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>เลขที่อ้างอิง: {receipt.orderNumber}</span>
              <span>{new Date(receipt.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>

            {/* บรรทัดที่ 2: ชื่อลูกค้า */}
            {receipt.customerName && (
              <div style={{ fontWeight: "normal", color: "#475569" }}>
                ลูกค้า: {receipt.customerName}
              </div>
            )}
          </div>

          <div className="receipt-items">
            {receipt.items.map((item, index) => (
              <div className="receipt-item" key={`${item.productName}-${index}`}>
                <span>{item.productName}<small>{item.quantity} รายการ</small></span>
                <strong>฿{Number(item.lineTotal ?? 0).toFixed(2)}</strong>
              </div>
            ))}
          </div>

          <div className="receipt-summary">
            <span>ยอดรวมสินค้า<b>฿{Number(receipt.subtotal ?? 0).toFixed(2)}</b></span>
            <span>ส่วนลด<b>฿{(receipt.discountAmount ?? 0).toFixed(2)}</b></span>
            <strong>รวมทั้งสิ้น<b>฿{Number(receipt.total ?? 0).toFixed(2)}</b></strong>
          </div>

          <div className="receipt-payment">
            <span>ช่องทางชำระ<b>{paymentLabels[receipt.paymentMethod]}</b></span>
            <span>รับเงินมา<b>฿{Number(receipt.amountReceived ?? 0).toFixed(2)}</b></span>
            <span>เงินทอน<b>฿{Number(receipt.changeAmount ?? 0).toFixed(2)}</b></span>
          </div>

          {receipt.pointsEarned !== undefined && receipt.pointsEarned > 0 && (
            <div style={{
              marginTop: "14px",
              padding: "10px 12px",
              backgroundColor: "#f0fdf4",
              border: "1px dashed #16a34a",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}>
              <Award size={18} style={{ color: "#16a34a" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#15803d" }}>
                  คะแนนสะสมบิลนี้: +{receipt.pointsEarned} คะแนน
                </div>
                <div style={{ fontSize: "11px", color: "#166534" }}>
                  (คำนวณจากยอดสุทธิ ทุกๆ 100 บาท = 1 คะแนน)
                </div>
              </div>
            </div>
          )}

          <div className="receipt-buttons no-print" style={{ marginTop: "20px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
            <button type="button" onClick={onClose}>เสร็จสิ้น</button>
            <button className="receipt-print" type="button" onClick={() => window.print()}>
              <Printer size={18} /> พิมพ์ใบเสร็จ
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
