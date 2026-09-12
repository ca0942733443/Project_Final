"use client";

import { ArrowLeft, Banknote, CheckCircle2, CirclePlus, Delete, Info, QrCode, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildPromptPayPayload, defaultPaymentSettings, loadPaymentSettings, PAYMENT_SETTINGS_CHANGED_EVENT, PaymentSettings } from "../_lib/payment";
import { apiFetch, errorMessage } from "../_lib/api";

type PaymentMethod = "cash" | "qr";

type PaymentModalProps = {
  orderNumber: string;
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, amountReceived: number, customerId: number | null) => Promise<void>;
};

type CustomerSearchResult = {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
};

const cashPresets = [100, 500, 1000];
const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];

export default function PaymentModal({ orderNumber, total, onClose, onConfirm }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [receivedText, setReceivedText] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const received = Number(receivedText) || 0;
  const change = Math.max(0, received - total);
  const canConfirm = method === "cash" ? received >= total : paymentSettings.promptPayEnabled && Boolean(qrDataUrl);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const refreshPaymentSettings = () => setPaymentSettings(loadPaymentSettings());
    refreshPaymentSettings();
    window.addEventListener("storage", refreshPaymentSettings);
    window.addEventListener(PAYMENT_SETTINGS_CHANGED_EVENT, refreshPaymentSettings);
    return () => {
      window.removeEventListener("storage", refreshPaymentSettings);
      window.removeEventListener(PAYMENT_SETTINGS_CHANGED_EVENT, refreshPaymentSettings);
    };
  }, []);

  useEffect(() => {
    if (!paymentSettings.promptPayEnabled) {
      setQrDataUrl("");
      setQrError("");
      if (method === "qr") setMethod("cash");
      return;
    }

    let cancelled = false;
    setQrDataUrl("");
    setQrError("");
    try {
      const payload = buildPromptPayPayload({ ...paymentSettings, amount: total });
      QRCode.toDataURL(payload, { width: 300, margin: 2, errorCorrectionLevel: "M" })
        .then((dataUrl) => {
          if (!cancelled) setQrDataUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setQrError("สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบหมายเลข PromptPay ใน Settings");
        });
    } catch (qrGenerationError) {
      if (!cancelled) setQrError(qrGenerationError instanceof Error ? qrGenerationError.message : "หมายเลข PromptPay ไม่ถูกต้อง");
    }

    return () => { cancelled = true; };
  }, [method, paymentSettings, total]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (!query) {
      setCustomerResults([]);
      setCustomerLoading(false);
      setCustomerSearchError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCustomerLoading(true);
      setCustomerSearchError("");
      void apiFetch<CustomerSearchResult[]>(`/customers?search=${encodeURIComponent(query)}`)
        .then((rows) => {
          if (!cancelled) setCustomerResults(rows.slice(0, 8));
        })
        .catch((searchError) => {
          if (!cancelled) {
            setCustomerResults([]);
            setCustomerSearchError(errorMessage(searchError));
          }
        })
        .finally(() => {
          if (!cancelled) setCustomerLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerQuery]);

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
      await onConfirm(method, method === "cash" ? received : total, selectedCustomer?.id ?? null);
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
              <button aria-disabled={!paymentSettings.promptPayEnabled} className={`${method === "qr" ? "active" : ""} ${!paymentSettings.promptPayEnabled ? "disabled" : ""}`} disabled={!paymentSettings.promptPayEnabled} onClick={() => setMethod("qr")} type="button">
                <QrCode size={30} />
                <strong>QR<br />PromptPay</strong>
              </button>
            </div>

            <div className="payment-customer-search">
              <label className="payment-customer-label" htmlFor="payment-customer-query">ลูกค้า (ไม่บังคับ)</label>
              {selectedCustomer ? (
                <div className="payment-customer-selected">
                  <div>
                    <strong>{selectedCustomer.fullName}</strong>
                    <small>{[selectedCustomer.phone, selectedCustomer.carPlate].filter(Boolean).join(" · ") || selectedCustomer.customerCode}</small>
                  </div>
                  <button type="button" onClick={() => setSelectedCustomer(null)}>เปลี่ยน</button>
                </div>
              ) : (
                <div className="payment-customer-input-wrap">
                  <Search size={18} aria-hidden="true" />
                  <input
                    id="payment-customer-query"
                    className="payment-member-search"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="ค้นหาชื่อ เบอร์โทร หรือทะเบียนรถ"
                    autoComplete="off"
                  />
                  {(customerLoading || customerSearchError || customerResults.length > 0) && <div className="payment-customer-results" role="listbox">
                    {customerLoading && <div className="payment-customer-empty">กำลังค้นหาลูกค้า...</div>}
                    {!customerLoading && customerSearchError && <div className="payment-customer-empty error">{customerSearchError}</div>}
                    {!customerLoading && !customerSearchError && customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery("");
                          setCustomerResults([]);
                        }}
                      >
                        <strong>{customer.fullName}</strong>
                        <small>{[customer.phone, customer.carPlate].filter(Boolean).join(" · ") || customer.customerCode}</small>
                      </button>
                    ))}
                    {!customerLoading && !customerSearchError && customerQuery.trim() && customerResults.length === 0 && <div className="payment-customer-empty">ไม่พบลูกค้าที่ตรงกับคำค้น</div>}
                  </div>}
                </div>
              )}
            </div>
            {method === "qr" && <div className="payment-info"><Info size={18} /><span>สแกน QR PromptPay เพื่อชำระเงิน</span></div>}
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
                {qrDataUrl ? <img alt={`QR PromptPay สำหรับยอด ${total.toFixed(2)} บาท`} src={qrDataUrl} /> : <div className="qr-payment-error"><QrCode size={42} /><span>{qrError || "กำลังสร้าง QR PromptPay..."}</span></div>}
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
