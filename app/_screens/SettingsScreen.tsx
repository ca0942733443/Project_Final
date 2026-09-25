// "use client";

// import { Barcode, Check, CreditCard, CheckCircle, Moon, Printer, Store, Sun, X } from "lucide-react";
// import { useEffect, useState } from "react";
// import AdminShell, { THEME_STORAGE_KEY } from "../_components/AdminShell";
// import { PageTitle } from "../_components/PageElements";
// import { defaultPaymentSettings, loadPaymentSettings, savePaymentSettings } from "../_lib/payment";

// export default function SettingsScreen() {
//   const [darkMode, setDarkMode] = useState(false);
//   const [promptPayEnabled, setPromptPayEnabled] = useState(defaultPaymentSettings.promptPayEnabled);
//   const [promptPayId, setPromptPayId] = useState(defaultPaymentSettings.promptPayId);
//   const [saved, setSaved] = useState(false);

//   const [showBarcodeModal, setShowBarcodeModal] = useState(false);
//   const [testResult, setTestResult] = useState("");
//   const [isScanned, setIsScanned] = useState(false);
//   const [autoAddQuantity, setAutoAddQuantity] = useState(true);
//   const [soundBeep, setSoundBeep] = useState(true);
//   const [suffixAction, setSuffixAction] = useState("enter");

//   const [showPrinterModal, setShowPrinterModal] = useState(false);
//   const [printerModel, setPrinterModel] = useState("EPSON TM-T88VI");
//   const [paperSize, setPaperSize] = useState("80mm");
//   const [autoCut, setAutoCut] = useState(true);
//   const [printCopyCount, setPrintCopyCount] = useState("1");

//   useEffect(() => {
//     const settings = loadPaymentSettings();
//     setPromptPayEnabled(settings.promptPayEnabled);
//     setPromptPayId(settings.promptPayId);
//     setDarkMode(window.localStorage.getItem(THEME_STORAGE_KEY) === "dark");
//   }, []);

//   function updateTheme(enabled: boolean) {
//     setDarkMode(enabled);
//     document.documentElement.classList.toggle("dark-mode", enabled);
//     window.localStorage.setItem(THEME_STORAGE_KEY, enabled ? "dark" : "light");
//   }

//   function saveSettings() {
//     savePaymentSettings({
//       ...defaultPaymentSettings,
//       promptPayEnabled,
//       promptPayId,
//     });
//     setSaved(true);
//     window.setTimeout(() => setSaved(false), 1800);
//   }

//   function updatePromptPayStatus(enabled: boolean) {
//     setPromptPayEnabled(enabled);
//     savePaymentSettings({ ...defaultPaymentSettings, promptPayEnabled: enabled, promptPayId });
//   }

//   function handleTestScan(e: React.KeyboardEvent<HTMLInputElement>) {
//     if (e.key === "Enter" && testResult.trim() !== "") {
//       setIsScanned(true);
//     }
//   }

//   return (
//     <AdminShell active="settings">
//       <PageTitle title="การตั้งค่าระบบ" subtitle="จัดการข้อมูลร้านค้า ฮาร์ดแวร์ และรูปแบบการชำระเงินของคุณ" />
//       <div className={`settings-grid ${darkMode ? "preview-dark" : ""}`}>
//         <section className="setting-card general">
//           <h2><Store /> ข้อมูลทั่วไป (General)</h2>
//           <div className="field-grid">
//             <label>
//               ชื่อร้านค้า
//               <input defaultValue="CAPTAIN GAI SOD" />
//             </label>

//             <label>
//               เวลาเปิด-ปิด
//               <div className="time-row">
//                 <div className="time-group">
//                   <select defaultValue="08" className="select-input">
//                     {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
//                       <option key={h} value={h}>{h}</option>
//                     ))}
//                   </select>
//                   <span className="time-separator">:</span>
//                   <select defaultValue="00" className="select-input">
//                     {["00", "15", "30", "45"].map((m) => (
//                       <option key={m} value={m}>{m}</option>
//                     ))}
//                   </select>
//                 </div>

//                 <span className="time-text-to">ถึง</span>

//                 <div className="time-group">
//                   <select defaultValue="22" className="select-input">
//                     {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
//                       <option key={h} value={h}>{h}</option>
//                     ))}
//                   </select>
//                   <span className="time-separator">:</span>
//                   <select defaultValue="00" className="select-input">
//                     {["00", "15", "30", "45"].map((m) => (
//                       <option key={m} value={m}>{m}</option>
//                     ))}
//                   </select>
//                 </div>
//               </div>
//             </label>

//             <label className="wide">
//               ที่อยู่ร้านค้า
//               <textarea
//                 defaultValue="123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110"
//                 className="address-textarea"
//               />
//             </label>
//           </div>
//         </section>

//         <section className="setting-card">
//           <h2><Sun /> การแสดงผล</h2>
//           <p>เลือกโหมดการใช้งานที่เหมาะสมกับสภาพแสงในร้านของคุณ</p>
//           <button type="button" aria-pressed={!darkMode} className={!darkMode ? "mode-selected" : ""} onClick={() => updateTheme(false)}><Sun /> Light Mode (ค่าเริ่มต้น)</button>
//           <button type="button" aria-pressed={darkMode} className={darkMode ? "mode-selected" : ""} onClick={() => updateTheme(true)}><Moon /> Dark Mode</button>
//         </section>

//         <section className="setting-card">
//           <h2><Printer /> ฮาร์ดแวร์ (Hardware)</h2>
//           {[
//             { name: "เครื่องพิมพ์ใบเสร็จ — EPSON TM-T88VI", actionText: "ตั้งค่า", onClick: () => setShowPrinterModal(true) },
//             { name: "เครื่องชั่งน้ำหนัก — ไม่ได้เชื่อมต่อ", actionText: "ค้นหาอุปกรณ์", isDanger: true, onClick: () => {} },
//             { name: "เครื่องสแกนบาร์โค้ด — พร้อมใช้งาน", actionText: "ตั้งค่า", onClick: () => setShowBarcodeModal(true) },
//           ].map((device) => (
//             <div className="device" key={device.name}>
//               <span>{device.name}</span>
//               <b
//                 className={`device-action ${device.isDanger ? "danger-text" : ""}`}
//                 onClick={device.onClick}
//               >
//                 {device.actionText}
//               </b>
//             </div>
//           ))}
//         </section>

//         <section className="setting-card">
//           <h2><CreditCard /> ช่องทางชำระเงิน</h2>
//           <div className="toggle-row">
//             <div>
//               <strong>QR PromptPay</strong>
//               <span>สร้าง QR ตามยอดขายอัตโนมัติ</span>
//             </div>
//             <button
//               aria-label="เปิดหรือปิดการชำระเงินด้วย QR PromptPay"
//               aria-pressed={promptPayEnabled}
//               className={`toggle ${promptPayEnabled ? "on" : ""}`}
//               onClick={() => updatePromptPayStatus(!promptPayEnabled)}
//               type="button"
//             >
//               <i />
//             </button>
//           </div>

//           <label className="payment-setting-field">
//             หมายเลข PromptPay
//             <input
//               inputMode="numeric"
//               onBlur={saveSettings}
//               onChange={(event) => setPromptPayId(event.target.value)}
//               placeholder="เช่น 0969052804"
//               value={promptPayId}
//             />
//           </label>

//           <div className="merchant">
//             <span>PromptPay ID: {promptPayId || "ยังไม่ได้ตั้งค่า"}</span>
//             <span>
//               Status:{" "}
//               <b className={promptPayEnabled ? "status-online" : "status-offline"}>
//                 ● {promptPayEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
//               </b>
//             </span>
//           </div>
//         </section>
//       </div>

//       <div className="save-bar">
//         <button type="button">คืนค่า</button>
//         <button type="button" className="primary-button" onClick={saveSettings}>
//           {saved ? <><Check /> บันทึกแล้ว</> : "บันทึกการตั้งค่า"}
//         </button>
//       </div>

//       {/* Modal เครื่องพิมพ์ใบเสร็จ */}
//       {showPrinterModal && (
//         <div className="modal-backdrop" onClick={() => setShowPrinterModal(false)}>
//           <div className="modal modal-container" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <div className="modal-header-title">
//                 <div className="modal-icon-box printer-icon">
//                   <Printer size={22} />
//                 </div>
//                 <div>
//                   <h3>ตั้งค่าเครื่องพิมพ์ใบเสร็จ</h3>
//                   <small>Receipt Printer Settings</small>
//                 </div>
//               </div>
//               <button
//                 type="button"
//                 className="modal-close"
//                 onClick={() => setShowPrinterModal(false)}
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <div className="modal-form-body">
//               <div className="form-group">
//                 <label>รุ่นเครื่องพิมพ์ (Printer Model)</label>
//                 <select
//                   value={printerModel}
//                   onChange={(e) => setPrinterModel(e.target.value)}
//                   className="form-select"
//                 >
//                   <option value="EPSON TM-T88VI">EPSON TM-T88VI (USB / LAN)</option>
//                   <option value="EPSON TM-T82X">EPSON TM-T82X</option>
//                   <option value="XPrinter XP-58">XPrinter XP-58 (Bluetooth / USB)</option>
//                   <option value="XPrinter XP-80">XPrinter XP-80</option>
//                 </select>
//               </div>

//               <div className="form-group">
//                 <label>ขนาดกระดาษความร้อน (Paper Size)</label>
//                 <select
//                   value={paperSize}
//                   onChange={(e) => setPaperSize(e.target.value)}
//                   className="form-select"
//                 >
//                   <option value="80mm">80 มม. (มาตรฐาน ร้านค้าทั่วไป)</option>
//                   <option value="58mm">58 มม. (กระดาษขนาดเล็ก)</option>
//                 </select>
//               </div>

//               <div className="form-group">
//                 <label>จำนวนพิมพ์ต่อบิล (Copies)</label>
//                 <select
//                   value={printCopyCount}
//                   onChange={(e) => setPrintCopyCount(e.target.value)}
//                   className="form-select"
//                 >
//                   <option value="1">1 ฉบับ (ลูกค้า)</option>
//                   <option value="2">2 ฉบับ (ลูกค้า + ร้านค้า)</option>
//                 </select>
//               </div>

//               <label className="checkbox-label">
//                 <div>
//                   <div className="checkbox-title">ตัดกระดาษอัตโนมัติ (Auto Cutter)</div>
//                   <small>สั่งตัดกระดาษทันทีเมื่อพิมพ์ใบเสร็จเสร็จสิ้น</small>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={autoCut}
//                   onChange={(e) => setAutoCut(e.target.checked)}
//                   className="checkbox-input"
//                 />
//               </label>
//             </div>

//             <div className="modal-footer justify-between">
//               <button
//                 type="button"
//                 onClick={() => alert("กำลังส่งคำสั่งพิมพ์ทดสอบไปยัง " + printerModel)}
//                 className="btn-test-print"
//               >
//                 🖨️ พิมพ์ทดสอบ (Test Print)
//               </button>
              
//               <div className="footer-action-group">
//                 <button
//                   type="button"
//                   onClick={() => setShowPrinterModal(false)}
//                   className="btn-secondary"
//                 >
//                   ยกเลิก
//                 </button>
//                 <button
//                   type="button"
//                   className="primary-button btn-save"
//                   onClick={() => setShowPrinterModal(false)}
//                 >
//                   บันทึก
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Modal เครื่องสแกนบาร์โค้ด */}
//       {showBarcodeModal && (
//         <div className="modal-backdrop" onClick={() => setShowBarcodeModal(false)}>
//           <div className="modal modal-container" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <div className="modal-header-title">
//                 <div className="modal-icon-box barcode-icon">
//                   <Barcode size={22} />
//                 </div>
//                 <div>
//                   <h3>ตั้งค่าเครื่องสแกนบาร์โค้ด</h3>
//                   <small>USB HID / Plug & Play</small>
//                 </div>
//               </div>
//               <button
//                 type="button"
//                 className="modal-close"
//                 onClick={() => setShowBarcodeModal(false)}
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <div className="test-scan-box">
//               <label className="test-scan-label">
//                 ทดสอบการสแกน (Test Scan)
//               </label>
//               <input
//                 type="text"
//                 placeholder="คลิกที่นี่แล้วลองยิงบาร์โค้ด..."
//                 value={testResult}
//                 onChange={(e) => {
//                   setTestResult(e.target.value);
//                   setIsScanned(false);
//                 }}
//                 onKeyDown={handleTestScan}
//                 autoFocus
//                 className={`test-scan-input ${isScanned ? "scanned-success" : ""}`}
//               />
//               {isScanned && (
//                 <div className="scan-success-message">
//                   <CheckCircle size={16} /> อ่านค่าสำเร็จ: <strong>{testResult}</strong>
//                 </div>
//               )}
//             </div>

//             <div className="modal-form-body">
//               <label className="checkbox-label">
//                 <div>
//                   <div className="checkbox-title">สแกนซ้ำเพื่อเพิ่มจำนวนอัตโนมัติ</div>
//                   <small>เมื่อยิงบาร์โค้ดเดิม ให้เพิ่มจำนวน +1 ทันที</small>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={autoAddQuantity}
//                   onChange={(e) => setAutoAddQuantity(e.target.checked)}
//                   className="checkbox-input"
//                 />
//               </label>

//               <label className="checkbox-label">
//                 <div>
//                   <div className="checkbox-title">เสียงแจ้งเตือนสแกนสำเร็จ (Beep)</div>
//                   <small>ส่งเสียง "ติ๊ด" ผ่านลำโพงเครื่องเมื่อยิงติด</small>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={soundBeep}
//                   onChange={(e) => setSoundBeep(e.target.checked)}
//                   className="checkbox-input"
//                 />
//               </label>

//               <div className="form-row-between">
//                 <div>
//                   <div className="checkbox-title">ปุ่มส่งท้ายหลังสแกน (Suffix)</div>
//                   <small>ค่าเริ่มต้นส่วนใหญ่คือ Enter</small>
//                 </div>
//                 <select
//                   value={suffixAction}
//                   onChange={(e) => setSuffixAction(e.target.value)}
//                   className="suffix-select"
//                 >
//                   <option value="enter">Enter (แนะนำ)</option>
//                   <option value="tab">Tab</option>
//                   <option value="none">ไม่มี (None)</option>
//                 </select>
//               </div>
//             </div>

//             <div className="modal-footer justify-end">
//               <button
//                 type="button"
//                 onClick={() => setShowBarcodeModal(false)}
//                 className="btn-secondary"
//               >
//                 ยกเลิก
//               </button>
//               <button
//                 type="button"
//                 className="primary-button btn-save"
//                 onClick={() => setShowBarcodeModal(false)}
//               >
//                 บันทึกการตั้งค่า
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </AdminShell>
//   );
// }


"use client";

import { Barcode, Check, CreditCard, CheckCircle, Moon, Printer, Store, Sun, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell, { THEME_STORAGE_KEY } from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { defaultPaymentSettings, loadPaymentSettings, savePaymentSettings } from "../_lib/payment";

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [promptPayEnabled, setPromptPayEnabled] = useState(defaultPaymentSettings.promptPayEnabled);
  const [promptPayId, setPromptPayId] = useState(defaultPaymentSettings.promptPayId);
  const [saved, setSaved] = useState(false);

  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [isScanned, setIsScanned] = useState(false);
  const [autoAddQuantity, setAutoAddQuantity] = useState(true);
  const [soundBeep, setSoundBeep] = useState(true);
  const [suffixAction, setSuffixAction] = useState("enter");

  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerModel, setPrinterModel] = useState("EPSON TM-T88VI");
  const [paperSize, setPaperSize] = useState("80mm");
  const [autoCut, setAutoCut] = useState(true);
  const [printCopyCount, setPrintCopyCount] = useState("1");

  useEffect(() => {
    const settings = loadPaymentSettings();
    setPromptPayEnabled(settings.promptPayEnabled);
    setPromptPayId(settings.promptPayId);
    setDarkMode(window.localStorage.getItem(THEME_STORAGE_KEY) === "dark");
  }, []);

  function updateTheme(enabled: boolean) {
    setDarkMode(enabled);
    document.documentElement.classList.toggle("dark-mode", enabled);
    window.localStorage.setItem(THEME_STORAGE_KEY, enabled ? "dark" : "light");
  }

  function saveSettings() {
    savePaymentSettings({
      ...defaultPaymentSettings,
      promptPayEnabled,
      promptPayId,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function updatePromptPayStatus(enabled: boolean) {
    setPromptPayEnabled(enabled);
    savePaymentSettings({ ...defaultPaymentSettings, promptPayEnabled: enabled, promptPayId });
  }

  function handleTestScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && testResult.trim() !== "") {
      setIsScanned(true);
    }
  }

  return (
    <AdminShell active="settings">
      <PageTitle title="การตั้งค่าระบบ" subtitle="จัดการข้อมูลร้านค้า ฮาร์ดแวร์ และรูปแบบการชำระเงินของคุณ" />
      <div className={`settings-grid ${darkMode ? "preview-dark" : ""}`}>
        <section className="setting-card general">
          <h2><Store /> ข้อมูลทั่วไป (General)</h2>
          <div className="field-grid">
            <label>
              ชื่อร้านค้า
              <input defaultValue="CAPTAIN GAI SOD" />
            </label>

            <label>
              เวลาเปิด-ปิด
              <div className="time-row">
                <div className="time-group">
                  <select defaultValue="08" className="select-input">
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="time-separator">:</span>
                  <select defaultValue="00" className="select-input">
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <span className="time-text-to">ถึง</span>

                <div className="time-group">
                  <select defaultValue="22" className="select-input">
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="time-separator">:</span>
                  <select defaultValue="00" className="select-input">
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </label>

            <label className="wide">
              ที่อยู่ร้านค้า
              <textarea
                defaultValue="123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110"
                className="address-textarea"
              />
            </label>
          </div>
        </section>

        <section className="setting-card">
          <h2><Sun /> การแสดงผล</h2>
          <p>เลือกโหมดการใช้งานที่เหมาะสมกับสภาพแสงในร้านของคุณ</p>
          <button type="button" aria-pressed={!darkMode} className={!darkMode ? "mode-selected" : ""} onClick={() => updateTheme(false)}><Sun /> Light Mode (ค่าเริ่มต้น)</button>
          <button type="button" aria-pressed={darkMode} className={darkMode ? "mode-selected" : ""} onClick={() => updateTheme(true)}><Moon /> Dark Mode</button>
        </section>

        <section className="setting-card">
          <h2><Printer /> ฮาร์ดแวร์ (Hardware)</h2>
          {[
            { name: "เครื่องพิมพ์ใบเสร็จ — EPSON TM-T88VI", actionText: "ตั้งค่า", onClick: () => setShowPrinterModal(true) },
            { name: "เครื่องชั่งน้ำหนัก — ไม่ได้เชื่อมต่อ", actionText: "ค้นหาอุปกรณ์", isDanger: true, onClick: () => {} },
            { name: "เครื่องสแกนบาร์โค้ด — Deli S206", actionText: "ตั้งค่า", onClick: () => setShowBarcodeModal(true) },
          ].map((device) => (
            <div className="device" key={device.name}>
              <span>{device.name}</span>
              <b
                className={`device-action ${device.isDanger ? "danger-text" : ""}`}
                onClick={device.onClick}
              >
                {device.actionText}
              </b>
            </div>
          ))}
        </section>

        <section className="setting-card">
          <h2><CreditCard /> ช่องทางชำระเงิน</h2>
          <div className="toggle-row">
            <div>
              <strong>QR PromptPay</strong>
              <span>สร้าง QR ตามยอดขายอัตโนมัติ</span>
            </div>
            <button
              aria-label="เปิดหรือปิดการชำระเงินด้วย QR PromptPay"
              aria-pressed={promptPayEnabled}
              className={`toggle ${promptPayEnabled ? "on" : ""}`}
              onClick={() => updatePromptPayStatus(!promptPayEnabled)}
              type="button"
            >
              <i />
            </button>
          </div>

          <label className="payment-setting-field">
            หมายเลข PromptPay
            <input
              inputMode="numeric"
              onBlur={saveSettings}
              onChange={(event) => setPromptPayId(event.target.value)}
              placeholder="เช่น 0969052804"
              value={promptPayId}
            />
          </label>

          <div className="merchant">
            <span>PromptPay ID: {promptPayId || "ยังไม่ได้ตั้งค่า"}</span>
            <span>
              Status:{" "}
              <b className={promptPayEnabled ? "status-online" : "status-offline"}>
                ● {promptPayEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              </b>
            </span>
          </div>
        </section>
      </div>

      <div className="save-bar">
        <button type="button">คืนค่า</button>
        <button type="button" className="primary-button" onClick={saveSettings}>
          {saved ? <><Check /> บันทึกแล้ว</> : "บันทึกการตั้งค่า"}
        </button>
      </div>

      {/* Modal เครื่องพิมพ์ใบเสร็จ */}
      {showPrinterModal && (
        <div className="modal-backdrop" onClick={() => setShowPrinterModal(false)}>
          <div className="modal modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <div className="modal-icon-box printer-icon">
                  <Printer size={22} />
                </div>
                <div>
                  <h3>ตั้งค่าเครื่องพิมพ์ใบเสร็จ</h3>
                  <small>Receipt Printer Settings</small>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowPrinterModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-form-body">
              <div className="form-group">
                <label>รุ่นเครื่องพิมพ์ (Printer Model)</label>
                <select
                  value={printerModel}
                  onChange={(e) => setPrinterModel(e.target.value)}
                  className="form-select"
                >
                  <option value="EPSON TM-T88VI">EPSON TM-T88VI (USB / LAN)</option>
                  <option value="EPSON TM-T82X">EPSON TM-T82X</option>
                  <option value="XPrinter XP-58">XPrinter XP-58 (Bluetooth / USB)</option>
                  <option value="XPrinter XP-80">XPrinter XP-80</option>
                </select>
              </div>

              <div className="form-group">
                <label>ขนาดกระดาษความร้อน (Paper Size)</label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="form-select"
                >
                  <option value="80mm">80 มม. (มาตรฐาน ร้านค้าทั่วไป)</option>
                  <option value="58mm">58 มม. (กระดาษขนาดเล็ก)</option>
                </select>
              </div>

              <div className="form-group">
                <label>จำนวนพิมพ์ต่อบิล (Copies)</label>
                <select
                  value={printCopyCount}
                  onChange={(e) => setPrintCopyCount(e.target.value)}
                  className="form-select"
                >
                  <option value="1">1 ฉบับ (ลูกค้า)</option>
                  <option value="2">2 ฉบับ (ลูกค้า + ร้านค้า)</option>
                </select>
              </div>

              <label className="checkbox-label">
                <div>
                  <div className="checkbox-title">ตัดกระดาษอัตโนมัติ (Auto Cutter)</div>
                  <small>สั่งตัดกระดาษทันทีเมื่อพิมพ์ใบเสร็จเสร็จสิ้น</small>
                </div>
                <input
                  type="checkbox"
                  checked={autoCut}
                  onChange={(e) => setAutoCut(e.target.checked)}
                  className="checkbox-input"
                />
              </label>
            </div>

            <div className="modal-footer justify-between">
              <button
                type="button"
                onClick={() => alert("กำลังส่งคำสั่งพิมพ์ทดสอบไปยัง " + printerModel)}
                className="btn-test-print"
              >
                🖨️ พิมพ์ทดสอบ (Test Print)
              </button>
              
              <div className="footer-action-group">
                <button
                  type="button"
                  onClick={() => setShowPrinterModal(false)}
                  className="btn-secondary"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="primary-button btn-save"
                  onClick={() => setShowPrinterModal(false)}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal เครื่องสแกนบาร์โค้ด */}
      {showBarcodeModal && (
        <div className="modal-backdrop">
          <div className="modal modal-container" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <div className="modal-icon-box barcode-icon">
                  <Barcode size={22} />
                </div>
                <div>
                  <h3>ตั้งค่าเครื่องสแกนบาร์โค้ด</h3>
                  <small>คู่มือสแกนตั้งค่าอุปกรณ์ (Configuration Barcodes)</small>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowBarcodeModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* ช่องทดสอบสแกนแบบ Multi-line + ปุ่ม Clear */}
            <div className="test-scan-box" style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="test-scan-label" style={{ fontWeight: "600", fontSize: "14px", color: "#1e293b" }}>
                  ทดสอบการสแกน (Test Scan)
                </label>
                
                <button
                  type="button"
                  onClick={() => {
                    setTestResult("");
                    setIsScanned(false);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  ล้างข้อมูล
                </button>
              </div>

              <textarea
                rows={3}
                placeholder="ยิงบาร์โค้ดทดสอบที่นี่ ..."
                value={testResult}
                onChange={(e) => {
                  setTestResult(e.target.value);
                  if (e.target.value.trim() !== "") setIsScanned(true);
                }}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  resize: "vertical",
                  outline: "none",
                  backgroundColor: "#ffffff"
                }}
              />

              {isScanned && (
                <div className="scan-success-message" style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", color: "#16a34a", fontSize: "13px" }}>
                  <CheckCircle size={16} /> สแกนรับค่าสำเร็จ
                </div>
              )}
            </div>

            <div className="modal-form-body" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* SECTION 1: ตั้งค่าเสียง */}
              <div>
                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "6px" }}>
                  ตั้งค่าเสียง
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  
                  {/* เปิดเสียง */}
                  <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#16a34a", marginBottom: "6px" }}>
                      เปิดเสียง
                    </div>
                    <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/turn on sound.png" 
                        alt="Turn on decoding sound" 
                        style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", maxHeight: "90px", objectFit: "contain" }}
                      />
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "6px", fontSize: "12px" }}>
                      Turn on decoding sound
                    </small>
                  </div>

                  {/* ปิดเสียง */}
                  <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#dc2626", marginBottom: "6px" }}>
                      ปิดเสียง
                    </div>
                    <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/turn off sound.png" 
                        alt="Turn off decoding sound" 
                        style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", maxHeight: "90px", objectFit: "contain" }}
                      />
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "6px", fontSize: "12px" }}>
                      Turn off decoding sound
                    </small>
                  </div>

                </div>
              </div>

              {/* 🟢 SECTION 2: การตั้งค่าโหมดการอ่าน (แทรกต่อจากตั้งค่าเสียง) */}
              <div>
                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "6px" }}>
                  การตั้งค่าโหมดการอ่าน
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  
                  {/* Manual read mode */}
                  <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "6px" }}>
                      สแกนด้วยตัวเอง
                    </div>
                    <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Manual read mode.png" 
                        alt="Manual read mode" 
                        style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", maxHeight: "90px", objectFit: "contain" }}
                      />
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "6px", fontSize: "12px" }}>
                      Manual read mode
                    </small>
                  </div>

                  {/* Automatic continuous reading */}
                  <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "6px" }}>
                      สแกนอัตโนมัติ
                    </div>
                    <div style={{ background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Automatic read mode.png" 
                        alt="Automatic read mode" 
                        style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", maxHeight: "90px", objectFit: "contain" }}
                      />
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "6px", fontSize: "12px" }}>
                      Automatic continuous reading
                    </small>
                  </div>

                </div>
              </div>

              {/* SECTION 3: การกำหนดค่าตัวลงท้ายทั่วไป */}
              <div>
                <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "6px" }}>
                  การกำหนดค่าตัวลงท้ายทั่วไป
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                  
                  {/* 1. Add carriage return terminator */}
                  <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                      Add carriage return terminator
                    </div>
                    <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Add carriage return terminator.png" 
                        alt="Add carriage return terminator" 
                        style={{ width: "100%", maxWidth: "360px", height: "auto", display: "block", margin: "0 auto", maxHeight: "120px", objectFit: "contain" }}
                      />
                    </div>
                  </div>

                  {/* 2. Add carriage return line break terminator */}
                  <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                      Add carriage return line break terminator
                    </div>
                    <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Add carriage return line break terminator.png" 
                        alt="Add carriage return line break terminator" 
                        style={{ width: "100%", maxWidth: "360px", height: "auto", display: "block", margin: "0 auto", maxHeight: "120px", objectFit: "contain" }}
                      />
                    </div>
                  </div>

                  {/* 3. Add TAB termination */}
                  <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                      Add TAB termination
                    </div>
                    <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Add TAB termination.png" 
                        alt="Add TAB termination" 
                        style={{ width: "100%", maxWidth: "360px", height: "auto", display: "block", margin: "0 auto", maxHeight: "120px", objectFit: "contain" }}
                      />
                    </div>
                  </div>

                  {/* 4. Do not add terminator */}
                  <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", marginBottom: "8px" }}>
                      Do not add terminator
                    </div>
                    <div style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <img 
                        src="/Do not add terminator.png" 
                        alt="Do not add terminator" 
                        style={{ width: "100%", maxWidth: "360px", height: "auto", display: "block", margin: "0 auto", maxHeight: "120px", objectFit: "contain" }}
                      />
                    </div>
                  </div>

                </div>
              </div>

            </div>

            <div className="modal-footer justify-end" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="primary-button btn-save"
                onClick={() => setShowBarcodeModal(false)}
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}