"use client";

import { Check, CreditCard, Moon, Printer, Store, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell, { THEME_STORAGE_KEY } from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { defaultPaymentSettings, loadPaymentSettings, savePaymentSettings } from "../_lib/payment";

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [promptPayEnabled, setPromptPayEnabled] = useState(defaultPaymentSettings.promptPayEnabled);
  const [promptPayId, setPromptPayId] = useState(defaultPaymentSettings.promptPayId);
  const [saved, setSaved] = useState(false);

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

  return <AdminShell active="settings">
    <PageTitle title="การตั้งค่าระบบ" subtitle="จัดการข้อมูลร้านค้า ฮาร์ดแวร์ และรูปแบบการชำระเงินของคุณ" />
    <div className={`settings-grid ${darkMode ? "preview-dark" : ""}`}>
      <section className="setting-card general"><h2><Store /> ข้อมูลทั่วไป (General)</h2><div className="field-grid"><label>ชื่อร้านค้า<input defaultValue="CAPTAIN GAI SOD" /></label><label>เวลาเปิด-ปิด<div className="time-row"><input defaultValue="08:00 AM" /><span>ถึง</span><input defaultValue="10:00 PM" /></div></label><label className="wide">ที่อยู่ร้านค้า<textarea defaultValue="123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110" /></label></div></section>
      <section className="setting-card"><h2><Sun /> การแสดงผล</h2><p>เลือกโหมดการใช้งานที่เหมาะสมกับสภาพแสงในร้านของคุณ</p><button type="button" aria-pressed={!darkMode} className={!darkMode ? "mode-selected" : ""} onClick={() => updateTheme(false)}><Sun /> Light Mode (ค่าเริ่มต้น)</button><button type="button" aria-pressed={darkMode} className={darkMode ? "mode-selected" : ""} onClick={() => updateTheme(true)}><Moon /> Dark Mode</button></section>
      <section className="setting-card"><h2><Printer /> ฮาร์ดแวร์ (Hardware)</h2>{["เครื่องพิมพ์ใบเสร็จ — EPSON TM-T88VI", "เครื่องชั่งน้ำหนัก — ไม่ได้เชื่อมต่อ", "เครื่องสแกนบาร์โค้ด — พร้อมใช้งาน"].map((device, index) => <div className="device" key={device}><span>{device}</span><b className={index === 1 ? "danger-text" : ""}>{index === 1 ? "ค้นหาอุปกรณ์" : "ตั้งค่า"}</b></div>)}</section>
      <section className="setting-card">
        <h2><CreditCard /> ช่องทางชำระเงิน</h2>
        <div className="toggle-row">
          <div><strong>QR PromptPay</strong><span>สร้าง QR ตามยอดขายอัตโนมัติ</span></div>
          <button aria-label="เปิดหรือปิดการชำระเงินด้วย QR PromptPay" aria-pressed={promptPayEnabled} className={`toggle ${promptPayEnabled ? "on" : ""}`} onClick={() => updatePromptPayStatus(!promptPayEnabled)} type="button"><i /></button>
        </div>
        <label className="payment-setting-field">หมายเลข PromptPay<input inputMode="numeric" onBlur={saveSettings} onChange={(event) => setPromptPayId(event.target.value)} placeholder="เช่น 0969052804" value={promptPayId} /></label>
        <div className="merchant"><span>PromptPay ID: {promptPayId || "ยังไม่ได้ตั้งค่า"}</span><span>Status: <b className={promptPayEnabled ? "status-online" : "status-offline"}>● {promptPayEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</b></span></div>
      </section>
    </div>
    <div className="save-bar"><button>คืนค่า</button><button className="primary-button" onClick={saveSettings}>{saved ? <><Check /> บันทึกแล้ว</> : "บันทึกการตั้งค่า"}</button></div>
  </AdminShell>;
}
