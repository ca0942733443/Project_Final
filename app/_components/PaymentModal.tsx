// "use client";

// import { ArrowLeft, Banknote, CheckCircle2, CirclePlus, Delete, Info, QrCode, Search, X } from "lucide-react";
// import { useEffect, useState } from "react";
// import QRCode from "qrcode";
// import { buildPromptPayPayload, defaultPaymentSettings, loadPaymentSettings, PAYMENT_SETTINGS_CHANGED_EVENT, PaymentSettings } from "../_lib/payment";
// import { apiFetch, errorMessage } from "../_lib/api";

// type PaymentMethod = "cash" | "qr";

// type PaymentModalProps = {
//   orderNumber: string;
//   total: number;
//   onClose: () => void;
//   onConfirm: (
//     method: PaymentMethod, 
//     amountReceived: number, 
//     customerId: number | null, 
//     discountAmount: number,
//     customerName?: string
//   ) => Promise<void>;
// };

// type CustomerSearchResult = {
//   id: number;
//   customerCode: string;
//   fullName: string;
//   phone: string | null;
//   carPlate: string | null;
// };

// const cashPresets = [100, 500, 1000];
// const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];
// const discountKeypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// export default function PaymentModal({ orderNumber, total, onClose, onConfirm }: PaymentModalProps) {
//   const [method, setMethod] = useState<PaymentMethod>("cash");
//   const [receivedText, setReceivedText] = useState("0");
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");
//   const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
//   const [qrDataUrl, setQrDataUrl] = useState("");
//   const [qrError, setQrError] = useState("");
//   const [customerQuery, setCustomerQuery] = useState("");
//   const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
//   const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
//   const [customerLoading, setCustomerLoading] = useState(false);
//   const [customerSearchError, setCustomerSearchError] = useState("");
//   const [discountOpen, setDiscountOpen] = useState(false);
//   const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
//   const [discountInput, setDiscountInput] = useState("0");
//   const [discountAmount, setDiscountAmount] = useState(0);
//   const received = Number(((Number(receivedText) || 0).toFixed(2)));
//   const discountValue = Number(discountInput) || 0;
//   const appliedDiscount = Math.min(total, discountAmount);
//   const payableTotal = Math.max(0, Number((total - appliedDiscount).toFixed(2)));
//   const change = Math.max(0, Number((received - payableTotal).toFixed(2)));
//   const canConfirm = !discountOpen && (payableTotal === 0 || (method === "cash" ? received + 0.0001 >= payableTotal : paymentSettings.promptPayEnabled && Boolean(qrDataUrl)));

//   useEffect(() => {
//     const closeOnEscape = (event: KeyboardEvent) => {
//       if (event.key === "Escape") onClose();
//     };

//     window.addEventListener("keydown", closeOnEscape);
//     return () => window.removeEventListener("keydown", closeOnEscape);
//   }, [onClose]);

//   useEffect(() => {
//     const refreshPaymentSettings = () => setPaymentSettings(loadPaymentSettings());
//     refreshPaymentSettings();
//     window.addEventListener("storage", refreshPaymentSettings);
//     window.addEventListener(PAYMENT_SETTINGS_CHANGED_EVENT, refreshPaymentSettings);
//     return () => {
//       window.removeEventListener("storage", refreshPaymentSettings);
//       window.removeEventListener(PAYMENT_SETTINGS_CHANGED_EVENT, refreshPaymentSettings);
//     };
//   }, []);

//   useEffect(() => {
//     if (!paymentSettings.promptPayEnabled) {
//       setQrDataUrl("");
//       setQrError("");
//       if (method === "qr") setMethod("cash");
//       return;
//     }

//     let cancelled = false;
//     setQrDataUrl("");
//     setQrError("");
//     try {
//       const payload = buildPromptPayPayload({ ...paymentSettings, amount: payableTotal });
//       QRCode.toDataURL(payload, { width: 300, margin: 2, errorCorrectionLevel: "M" })
//         .then((dataUrl) => {
//           if (!cancelled) setQrDataUrl(dataUrl);
//         })
//         .catch(() => {
//           if (!cancelled) setQrError("สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบหมายเลข PromptPay ใน Settings");
//         });
//     } catch (qrGenerationError) {
//       if (!cancelled) setQrError(qrGenerationError instanceof Error ? qrGenerationError.message : "หมายเลข PromptPay ไม่ถูกต้อง");
//     }

//     return () => { cancelled = true; };
//   }, [method, paymentSettings, payableTotal]);

//   useEffect(() => {
//     const query = customerQuery.trim();
//     if (!query) {
//       setCustomerResults([]);
//       setCustomerLoading(false);
//       setCustomerSearchError("");
//       return;
//     }

//     let cancelled = false;
//     const timer = window.setTimeout(() => {
//       setCustomerLoading(true);
//       setCustomerSearchError("");
//       void apiFetch<CustomerSearchResult[]>(`/customers?search=${encodeURIComponent(query)}`)
//         .then((rows) => {
//           if (!cancelled) setCustomerResults(rows.slice(0, 8));
//         })
//         .catch((searchError) => {
//           if (!cancelled) {
//             setCustomerResults([]);
//             setCustomerSearchError(errorMessage(searchError));
//           }
//         })
//         .finally(() => {
//           if (!cancelled) setCustomerLoading(false);
//         });
//     }, 250);

//     return () => {
//       cancelled = true;
//       window.clearTimeout(timer);
//     };
//   }, [customerQuery]);

//   const enterAmount = (value: string) => {
//     if (value === "delete") {
//       setReceivedText((current) => current.length > 1 ? current.slice(0, -1) : "0");
//       return;
//     }

//     setReceivedText((current) => {
//       if (value === "." && current.includes(".")) return current;
//       if (current === "0" && value !== ".") return value;
//       return `${current}${value}`.slice(0, 10);
//     });
//   };

//   const confirmPayment = async () => {
//     setSubmitting(true);
//     setError("");
//     try {
//       await onConfirm(
//         method, 
//         method === "cash" ? received : payableTotal, 
//         selectedCustomer?.id ?? null, 
//         appliedDiscount,
//         selectedCustomer?.fullName
//       );
//     } catch (confirmError) {
//       setError(confirmError instanceof Error ? confirmError.message : "ชำระเงินไม่สำเร็จ");
//       setSubmitting(false);
//     }
//   };

//   const openDiscount = () => {
//     setDiscountMode("amount");
//     setDiscountInput(discountAmount ? discountAmount.toFixed(2).replace(/\.00$/, "") : "0");
//     setDiscountOpen(true);
//   };

//   const enterDiscount = (digit: string) => setDiscountInput((current) => {
//     if (digit === "delete") return current.length > 1 ? current.slice(0, -1) : "0";
//     if (current === "0") return digit;
//     return `${current}${digit}`.slice(0, 7);
//   });

//   const applyDiscount = () => {
//     const amount = discountMode === "percent" ? total * Math.min(100, discountValue) / 100 : discountValue;
//     setDiscountAmount(Math.min(total, Number(amount.toFixed(2))));
//     setDiscountOpen(false);
//   };

//   return (
//     <div className="payment-modal-backdrop" onMouseDown={onClose}>
//       <section aria-labelledby="payment-modal-title" aria-modal="true" className="payment-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
//         <header className="payment-modal-header">
//           <div>
//             <h2 id="payment-modal-title">การเลือกการชำระเงิน</h2>
//             <p>หมายเลขธุรกรรม: {orderNumber}</p>
//           </div>
//           <button aria-label="ปิดหน้าต่างชำระเงิน" className="payment-modal-close" onClick={onClose} type="button"><X size={23} /></button>
//         </header>

//         <div className="payment-modal-body">
//           <div className="payment-modal-left">
//             <div className="payment-total-card">
//               <span>ยอดเงินที่ต้องชำระทั้งหมด</span>
//               <strong>฿ {payableTotal.toFixed(2)}</strong>
//             </div>

//             {method === "cash" && <button className="payment-discount" type="button" onClick={openDiscount} style={{ cursor: "pointer" }}><CirclePlus size={19}/> {appliedDiscount ? `ส่วนลด ฿${appliedDiscount.toFixed(2)} · แก้ไข` : "เพิ่มส่วนลด"}</button>}

//             <div className="payment-methods">
//               <h3>เลือกวิธีการชำระเงิน</h3>
//               <button className={method === "cash" ? "active" : ""} onClick={() => setMethod("cash")} type="button">
//                 <Banknote size={30} />
//                 <strong>เงินสด</strong>
//               </button>
//               <button aria-disabled={!paymentSettings.promptPayEnabled} className={`${method === "qr" ? "active" : ""} ${!paymentSettings.promptPayEnabled ? "disabled" : ""}`} disabled={!paymentSettings.promptPayEnabled} onClick={() => setMethod("qr")} type="button">
//                 <QrCode size={30} />
//                 <strong>QR<br />PromptPay</strong>
//               </button>
//             </div>

//             <div className="payment-customer-search">
//               <label className="payment-customer-label" htmlFor="payment-customer-query">ลูกค้า (ไม่บังคับ)</label>
//               {selectedCustomer ? (
//                 <div className="payment-customer-selected">
//                   <div>
//                     <strong>{selectedCustomer.fullName}</strong>
//                     <small>{[selectedCustomer.phone, selectedCustomer.carPlate].filter(Boolean).join(" · ") || selectedCustomer.customerCode}</small>
//                   </div>
//                   <button type="button" onClick={() => setSelectedCustomer(null)}>เปลี่ยน</button>
//                 </div>
//               ) : (
//                 <div className="payment-customer-input-wrap">
//                   <Search size={18} aria-hidden="true" />
//                   <input
//                     id="payment-customer-query"
//                     className="payment-member-search"
//                     value={customerQuery}
//                     onChange={(event) => setCustomerQuery(event.target.value)}
//                     placeholder="ค้นหาชื่อ เบอร์โทร หรือทะเบียนรถ"
//                     autoComplete="off"
//                   />
//                   {(customerLoading || customerSearchError || customerResults.length > 0) && <div className="payment-customer-results" role="listbox">
//                     {customerLoading && <div className="payment-customer-empty">กำลังค้นหาลูกค้า...</div>}
//                     {!customerLoading && customerSearchError && <div className="payment-customer-empty error">{customerSearchError}</div>}
//                     {!customerLoading && !customerSearchError && customerResults.map((customer) => (
//                       <button
//                         key={customer.id}
//                         type="button"
//                         role="option"
//                         onClick={() => {
//                           setSelectedCustomer(customer);
//                           setCustomerQuery("");
//                           setCustomerResults([]);
//                         }}
//                       >
//                         <strong>{customer.fullName}</strong>
//                         <small>{[customer.phone, customer.carPlate].filter(Boolean).join(" · ") || customer.customerCode}</small>
//                       </button>
//                     ))}
//                     {!customerLoading && !customerSearchError && customerQuery.trim() && customerResults.length === 0 && <div className="payment-customer-empty">ไม่พบลูกค้าที่ตรงกับคำค้น</div>}
//                   </div>}
//                 </div>
//               )}
//             </div>
//             {method === "qr" && <div className="payment-info"><Info size={18} /><span>สแกน QR PromptPay เพื่อชำระเงิน</span></div>}
//           </div>

//           <div className="payment-modal-right">
//             {discountOpen ? (
//               <div className="discount-entry-panel">
//                 <div className="discount-entry-head">
//                   <strong>ส่วนลด</strong>
//                   <div className="discount-mode-switch" role="group" aria-label="รูปแบบส่วนลด">
//                     <button className={discountMode === "amount" ? "active" : ""} onClick={() => setDiscountMode("amount")} type="button">฿</button>
//                     <button className={discountMode === "percent" ? "active" : ""} onClick={() => setDiscountMode("percent")} type="button">%</button>
//                   </div>
//                 </div>
//                 <div className="discount-entry-value">{discountMode === "amount" ? "฿" : "%"} {discountValue.toLocaleString("th-TH")}</div>
//                 <div className="discount-keypad">
//                   {discountKeypad.map((key) => <button key={key} type="button" onClick={() => enterDiscount(key)}>{key}</button>)}
//                 </div>
//                 <div className="discount-entry-actions">
//                   <button className="delete" type="button" onClick={() => enterDiscount("delete")}><Delete size={20} /> ลบ</button>
//                   <button className="accept" type="button" onClick={applyDiscount}>ตกลง</button>
//                 </div>
//               </div>
//             ) : method === "cash" ? (
//               <div className="cash-payment-panel">
//                 <div className="cash-summary">
//                   <div><span>จำนวนเงินที่ได้รับ</span><strong>฿ {received.toFixed(2)}</strong></div>
//                   <div><span>เงินทอน</span><strong>฿ {change.toFixed(2)}</strong></div>
//                 </div>

//                 <div className="cash-presets">
//                   {cashPresets.map((amount) => (
//                     <button className={received === amount ? "selected" : ""} key={amount} onClick={() => setReceivedText(String(amount))} type="button">฿{amount.toLocaleString("th-TH")}</button>
//                   ))}
//                 </div>

//                 <div className="payment-keypad">
//                   {keypad.map((key) => (
//                     <button className={key === "delete" ? "delete" : ""} key={key} onClick={() => enterAmount(key)} type="button">
//                       {key === "delete" ? <Delete size={21} /> : key}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             ) : (
//               <div className="qr-payment-panel">
//                 {qrDataUrl ? <img alt={`QR PromptPay สำหรับยอด ${payableTotal.toFixed(2)} บาท`} src={qrDataUrl} /> : <div className="qr-payment-error"><QrCode size={42} /><span>{qrError || "กำลังสร้าง QR PromptPay..."}</span></div>}
//               </div>
//             )}
//           </div>
//         </div>

//         <footer className="payment-modal-footer">
//           <button className="payment-back-button" onClick={onClose} type="button"><ArrowLeft size={22} /> กลับ</button>
//           {error && <span className="form-error">{error}</span>}
//           <button className="payment-confirm-button" disabled={!canConfirm || submitting} onClick={confirmPayment} type="button">
//             {submitting ? "กำลังบันทึก..." : "ยืนยันการชำระเงิน"} <CheckCircle2 size={21} />
//           </button>
//         </footer>
//       </section>
//     </div>
//   );
// }



"use client";

import { ArrowLeft, Banknote, CheckCircle2, CirclePlus, CreditCard, Delete, Info, QrCode, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildPromptPayPayload, defaultPaymentSettings, loadPaymentSettings, PAYMENT_SETTINGS_CHANGED_EVENT, PaymentSettings } from "../_lib/payment";
import { apiFetch, errorMessage } from "../_lib/api";

type PaymentMethod = "cash" | "qr" | "credit";

type PaymentModalProps = {
  orderNumber: string;
  total: number;
  onClose: () => void;
  onConfirm: (
    method: PaymentMethod, 
    amountReceived: number, 
    customerId: number | null, 
    discountAmount: number,
    customerName?: string
  ) => Promise<void>;
};

type CustomerSearchResult = {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
  creditLimit: number;
  balanceDue: number;
  overdueBalance: number;
};

const cashPresets = [100, 500, 1000];
const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];
const discountKeypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

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
  const customerCreditLimit = Number(selectedCustomer?.creditLimit ?? 0);
  const customerBalanceDue = Number(selectedCustomer?.balanceDue ?? 0);
  const customerOverdueBalance = Number(selectedCustomer?.overdueBalance ?? 0);
  const availableCredit = Math.max(0, customerCreditLimit - customerBalanceDue);
  const canConfirm = method === "cash"
    ? received >= total
    : method === "qr"
      ? paymentSettings.promptPayEnabled && Boolean(qrDataUrl)
      : Boolean(selectedCustomer) && customerCreditLimit > 0 && availableCredit >= total && customerOverdueBalance <= 0;
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountAmount, setDiscountAmount] = useState(0);

  const received = Number(((Number(receivedText) || 0).toFixed(2)));
  const discountValue = Number(discountInput) || 0;
  const appliedDiscount = Math.min(total, discountAmount);
  const payableTotal = Math.max(0, Number((total - appliedDiscount).toFixed(2)));
  const change = Math.max(0, Number((received - payableTotal).toFixed(2)));
  
  const canConfirm = !discountOpen && (payableTotal === 0 || (method === "cash" ? received + 0.0001 >= payableTotal : paymentSettings.promptPayEnabled && Boolean(qrDataUrl)));

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

  // 🟢 สร้าง Static QR Code (ไม่ระบุยอดเงิน) โดยใช้ไลบรารี qrcode เดิม
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
      // ไม่ใส่ amount เพื่อให้เป็น QR Code แบบไม่ระบุยอดเงิน
      const payload = buildPromptPayPayload({
        ...paymentSettings,
        amount: 0,
      });

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
  }, [method, paymentSettings]);

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
      await onConfirm(method, method === "cash" ? received : method === "qr" ? total : 0, selectedCustomer?.id ?? null);
      await onConfirm(
        method, 
        method === "cash" ? received : payableTotal, 
        selectedCustomer?.id ?? null, 
        appliedDiscount,
        selectedCustomer?.fullName
      );
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "ชำระเงินไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  const openDiscount = () => {
    setDiscountMode("amount");
    setDiscountInput(discountAmount ? discountAmount.toFixed(2).replace(/\.00$/, "") : "0");
    setDiscountOpen(true);
  };

  const enterDiscount = (digit: string) => setDiscountInput((current) => {
    if (digit === "delete") return current.length > 1 ? current.slice(0, -1) : "0";
    if (current === "0") return digit;
    return `${current}${digit}`.slice(0, 7);
  });

  const applyDiscount = () => {
    const amount = discountMode === "percent" ? total * Math.min(100, discountValue) / 100 : discountValue;
    setDiscountAmount(Math.min(total, Number(amount.toFixed(2))));
    setDiscountOpen(false);
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
              <strong>฿ {payableTotal.toFixed(2)}</strong>
            </div>

            {method === "cash" && <button className="payment-discount" type="button" onClick={openDiscount} style={{ cursor: "pointer" }}><CirclePlus size={19}/> {appliedDiscount ? `ส่วนลด ฿${appliedDiscount.toFixed(2)} · แก้ไข` : "เพิ่มส่วนลด"}</button>}

            <div className="payment-methods payment-methods-three">
              <h3>เลือกวิธีการชำระเงิน</h3>
              <button className={method === "cash" ? "active" : ""} onClick={() => setMethod("cash")} type="button">
                <Banknote size={30} />
                <strong>เงินสด</strong>
              </button>
              <button aria-disabled={!paymentSettings.promptPayEnabled} className={`${method === "qr" ? "active" : ""} ${!paymentSettings.promptPayEnabled ? "disabled" : ""}`} disabled={!paymentSettings.promptPayEnabled} onClick={() => setMethod("qr")} type="button">
                <QrCode size={30} />
                <strong>QR<br />PromptPay</strong>
              </button>
              <button
                aria-label="ขายเชื่อ"
                className={`payment-method-credit ${method === "credit" ? "active" : ""}`}
                onClick={() => setMethod("credit")}
                type="button"
              >
                <CreditCard size={30} />
                <strong>ขายเชื่อ</strong>
              </button>
            </div>

            <div className="payment-customer-search">
              <label className="payment-customer-label" htmlFor="payment-customer-query">ลูกค้า (ไม่บังคับ)</label>
              {selectedCustomer ? (
                <div className="payment-customer-selected">
                  <div>
                    <strong>{selectedCustomer.fullName}</strong>
                    <small>{[selectedCustomer.phone, selectedCustomer.carPlate].filter(Boolean).join(" · ") || selectedCustomer.customerCode}</small>
                    {method === "credit" && <small>วงเงินใช้ได้ ฿{availableCredit.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</small>}
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
            {discountOpen ? (
              <div className="discount-entry-panel">
                <div className="discount-entry-head">
                  <strong>ส่วนลด</strong>
                  <div className="discount-mode-switch" role="group" aria-label="รูปแบบส่วนลด">
                    <button className={discountMode === "amount" ? "active" : ""} onClick={() => setDiscountMode("amount")} type="button">฿</button>
                    <button className={discountMode === "percent" ? "active" : ""} onClick={() => setDiscountMode("percent")} type="button">%</button>
                  </div>
                </div>
                <div className="discount-entry-value">{discountMode === "amount" ? "฿" : "%"} {discountValue.toLocaleString("th-TH")}</div>
                <div className="discount-keypad">
                  {discountKeypad.map((key) => <button key={key} type="button" onClick={() => enterDiscount(key)}>{key}</button>)}
                </div>
                <div className="discount-entry-actions">
                  <button className="delete" type="button" onClick={() => enterDiscount("delete")}><Delete size={20} /> ลบ</button>
                  <button className="accept" type="button" onClick={applyDiscount}>ตกลง</button>
                </div>
              </div>
            ) : method === "cash" ? (
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
              method === "qr" ? <div className="qr-payment-panel">
                {qrDataUrl ? <img alt={`QR PromptPay สำหรับยอด ${total.toFixed(2)} บาท`} src={qrDataUrl} /> : <div className="qr-payment-error"><QrCode size={42} /><span>{qrError || "กำลังสร้าง QR PromptPay..."}</span></div>}
              </div> : <div className="credit-payment-panel">
                <CreditCard size={44} />
                <h3>{selectedCustomer ? selectedCustomer.fullName : "กรุณาเลือกลูกค้า"}</h3>
                {selectedCustomer ? <>
                  <div><span>วงเงินเครดิต</span><strong>฿{customerCreditLimit.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
                  <div><span>ยอดค้างปัจจุบัน</span><strong>฿{customerBalanceDue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
                  {customerOverdueBalance > 0 && <div className="credit-insufficient"><span>ยอดเกินกำหนด</span><strong>฿{customerOverdueBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>}
                  <div><span>ยอดขายเชื่อครั้งนี้</span><strong>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
                  <div className={availableCredit < total ? "credit-insufficient" : "credit-available"}><span>วงเงินคงเหลือหลังขาย</span><strong>฿{Math.max(0, availableCredit - total).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
                  <p>{customerOverdueBalance > 0 ? "ลูกค้ามีหนี้เกินกำหนด กรุณารับชำระก่อน" : availableCredit >= total && customerCreditLimit > 0 ? "ครบกำหนดชำระภายใน 7 วัน" : "วงเงินเครดิตไม่เพียงพอสำหรับรายการนี้"}</p>
                </> : <p>ค้นหาและเลือกลูกค้าทางด้านซ้ายก่อนยืนยันการขายเชื่อ</p>}
              /* 🟢 แสดงผลรูปภาพ Data URL ที่เจนขึ้นมาสดๆ */
              <div className="qr-payment-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                {qrDataUrl ? (
                  <>
                    <img 
                      src={qrDataUrl} 
                      alt="QR PromptPay" 
                      style={{ width: "220px", height: "220px", borderRadius: "12px", border: "1px solid #e2e8f0" }} 
                    />
                    <div style={{ marginTop: "14px", textAlign: "center" }}>
                      <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>
                        {paymentSettings.promptPayId}
                      </strong>
                      <span style={{ fontSize: "13px", color: "#64748b", marginTop: "2px", display: "block" }}>
                        สแกนเพื่อชำระเงิน (ระบุยอดเงิน ฿{payableTotal.toFixed(2)})
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="qr-payment-error">
                    <QrCode size={42} />
                    <span>{qrError || "กำลังสร้าง QR PromptPay..."}</span>
                  </div>
                )}
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