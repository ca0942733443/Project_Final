"use client";

import { Check, Printer, X } from "lucide-react";

export type ReceiptData = {
  orderNumber: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; lineTotal: number }>;
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "qr" | "credit";
  amountReceived: number;
  changeAmount: number;
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
        <div className="receipt-payment"><span>ช่องทางการชำระ:<b>{paymentLabels[receipt.paymentMethod]}</b></span><span>รับเงินมา:<b>฿{receipt.amountReceived.toFixed(2)}</b></span><span>เงินทอน:<b>฿{receipt.changeAmount.toFixed(2)}</b></span></div>
        <p className="receipt-points">ได้รับคะแนนสะสม +68 คะแนน (ยอดรวม: 1,420 คะแนน)</p>
        <div className="receipt-buttons">{success && <button onClick={onClose}>เสร็จสิ้น</button>}<button className="receipt-print" onClick={() => window.print()}><Printer size={19}/> พิมพ์ใบเสร็จ</button></div>
      </div>
    </section>
  </div>;
}
