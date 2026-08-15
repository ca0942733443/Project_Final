"use client";

import { Check, CreditCard, Moon, Printer, Store, Sun } from "lucide-react";
import { useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [promptPayEnabled, setPromptPayEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  function saveSettings() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <AdminShell active="settings">
    <PageTitle title="การตั้งค่าระบบ" subtitle="จัดการข้อมูลร้านค้า ฮาร์ดแวร์ และรูปแบบการชำระเงินของคุณ" />
    <div className={`settings-grid ${darkMode ? "preview-dark" : ""}`}>
      <section className="setting-card general"><h2><Store /> ข้อมูลทั่วไป (General)</h2><div className="field-grid"><label>ชื่อร้านค้า<input defaultValue="CAPTAIN GAI SOD" /></label><label>เวลาเปิด-ปิด<div className="time-row"><input defaultValue="08:00 AM" /><span>ถึง</span><input defaultValue="10:00 PM" /></div></label><label className="wide">ที่อยู่ร้านค้า<textarea defaultValue="123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110" /></label></div></section>
      <section className="setting-card"><h2><Sun /> การแสดงผล</h2><p>เลือกโหมดการใช้งานที่เหมาะสมกับสภาพแสงในร้านของคุณ</p><button className={!darkMode ? "mode-selected" : ""} onClick={() => setDarkMode(false)}><Sun /> Light Mode (ค่าเริ่มต้น)</button><button className={darkMode ? "mode-selected" : ""} onClick={() => setDarkMode(true)}><Moon /> Dark Mode</button></section>
      <section className="setting-card"><h2><Printer /> ฮาร์ดแวร์ (Hardware)</h2>{["เครื่องพิมพ์ใบเสร็จ — EPSON TM-T88VI", "เครื่องชั่งน้ำหนัก — ไม่ได้เชื่อมต่อ", "เครื่องสแกนบาร์โค้ด — พร้อมใช้งาน"].map((device, index) => <div className="device" key={device}><span>{device}</span><b className={index === 1 ? "danger-text" : ""}>{index === 1 ? "ค้นหาอุปกรณ์" : "ตั้งค่า"}</b></div>)}</section>
      <section className="setting-card"><h2><CreditCard /> ช่องทางชำระเงิน</h2><div className="toggle-row"><div><strong>QR PromptPay API</strong><span>สร้าง QR อัตโนมัติทุกยอดขาย</span></div><button className={`toggle ${promptPayEnabled ? "on" : ""}`} onClick={() => setPromptPayEnabled(!promptPayEnabled)}><i /></button></div><div className="merchant"><span>Merchant ID: FRSH_998273</span><span>Status: <b>● Online</b></span></div></section>
    </div>
    <div className="save-bar"><button>คืนค่า</button><button className="primary-button" onClick={saveSettings}>{saved ? <><Check /> บันทึกแล้ว</> : "บันทึกการตั้งค่า"}</button></div>
  </AdminShell>;
}
