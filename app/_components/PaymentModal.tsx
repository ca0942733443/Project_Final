"use client";

import { ArrowLeft, Banknote, CheckCircle2, CirclePlus, Delete, Info, QrCode, X } from "lucide-react";
import { useEffect, useState } from "react";

type PaymentMethod = "cash" | "qr";

type PaymentModalProps = {
  orderNumber: string;
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, amountReceived: number) => Promise<void>;
};

const cashPresets = [100, 500, 1000];
const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];

export default function PaymentModal({ orderNumber, total, onClose, onConfirm }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [receivedText, setReceivedText] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const received = Number(receivedText) || 0;
  const change = Math.max(0, received - total);
  const canConfirm = method === "qr" || received >= total;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const enterAmount = (value: string) => {
    if (value === "delete") {
      setReceivedText((current) => current.length > 1 ? current.slice(0, -1) : "0");
      return;
    }

    setReceivedText((current) => {
      if (value === "." && current.includes(".")) return current;
      if (current === "0" && value !== ".") return value;
      return `${current}${value}`.slice(0, 10);
    });
  };

  const confirmPayment = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(method, method === "cash" ? received : total);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "ชำระเงินไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="payment-modal-backdrop" onMouseDown={onClose}>
      <section aria-labelledby="payment-modal-title" aria-modal="true" className="payment-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header className="payment-modal-header">
          <div>
            <h2 id="payment-modal-title">การเลือกการชำระเงิน</h2>
            <p>หมายเลขธุรกรรม: {orderNumber}</p>
          </div>
          <button aria-label="ปิดหน้าต่างชำระเงิน" className="payment-modal-close" onClick={onClose} type="button"><X size={23} /></button>
        </header>

        <div className="payment-modal-body">
          <div className="payment-modal-left">
            <div className="payment-total-card">
              <span>ยอดเงินที่ต้องชำระทั้งหมด</span>
              <strong>฿ {total.toFixed(2)}</strong>
            </div>

            {method === "cash" && <button className="payment-discount" type="button"><CirclePlus size={19}/> เพิ่มส่วนลด</button>}

            <div className="payment-methods">
              <h3>เลือกวิธีการชำระเงิน</h3>
              <button className={method === "cash" ? "active" : ""} onClick={() => setMethod("cash")} type="button">
                <Banknote size={30} />
                <strong>เงินสด</strong>
              </button>
              <button className={method === "qr" ? "active" : ""} onClick={() => setMethod("qr")} type="button">
                <QrCode size={30} />
                <strong>QR<br />PromptPay</strong>
              </button>
            </div>

            {method === "cash" ? <input className="payment-member-search" placeholder="ค้นหาเบอร์สมาชิก" /> : <div className="payment-info"><Info size={18} /><span>สแกน QR PromptPay เพื่อชำระเงิน</span></div>}
          </div>

          <div className="payment-modal-right">
            {method === "cash" ? (
              <div className="cash-payment-panel">
                <div className="cash-summary">
                  <div><span>จำนวนเงินที่ได้รับ</span><strong>฿ {received.toFixed(2)}</strong></div>
                  <div><span>เงินทอน</span><strong>฿ {change.toFixed(2)}</strong></div>
                </div>

                <div className="cash-presets">
                  {cashPresets.map((amount) => (
                    <button className={received === amount ? "selected" : ""} key={amount} onClick={() => setReceivedText(String(amount))} type="button">฿{amount.toLocaleString("th-TH")}</button>
                  ))}
                </div>

                <div className="payment-keypad">
                  {keypad.map((key) => (
                    <button className={key === "delete" ? "delete" : ""} key={key} onClick={() => enterAmount(key)} type="button">
                      {key === "delete" ? <Delete size={21} /> : key}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="qr-payment-panel">
                <img alt={`QR PromptPay สำหรับยอด ${total.toFixed(2)} บาท`} src="/payment-qr.png" />
              </div>
            )}
          </div>
        </div>

        <footer className="payment-modal-footer">
          <button className="payment-back-button" onClick={onClose} type="button"><ArrowLeft size={22} /> กลับ</button>
          {error && <span className="form-error">{error}</span>}
          <button className="payment-confirm-button" disabled={!canConfirm || submitting} onClick={confirmPayment} type="button">
            {submitting ? "กำลังบันทึก..." : "ยืนยันการชำระเงิน"} <CheckCircle2 size={21} />
          </button>
        </footer>
      </section>
    </div>
  );
}
