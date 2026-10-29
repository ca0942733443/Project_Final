"use client";

import { ArrowLeft, LockKeyhole, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type EmployeeRole = "owner" | "cashier" | "stock";

const roleDescriptions: Record<EmployeeRole, string> = {
  cashier: "ขายสินค้า รับชำระเงิน และดูประวัติการขาย",
  stock: "จัดการสินค้า สต็อก และคำสั่งซื้อสินค้าคงคลัง",
  owner: "เข้าถึงและจัดการข้อมูลทั้งหมดของระบบ",
};

export default function EmployeeCreateScreen() {
  const router = useRouter();
  const [role, setRole] = useState<EmployeeRole>("cashier");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          password,
          role,
        }),
      });
      router.push("/employees");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return <AdminShell active="employees" contentClassName="shared-form-page">
    <div className="sup-form-wrapper">
      <div className="sup-form-header">
        <button aria-label="กลับไปหน้าพนักงาน" className="sup-back-btn" onClick={() => router.push("/employees")} type="button"><ArrowLeft size={20} /></button>
        <div><h1 className="sup-form-title">เพิ่มพนักงานใหม่</h1><p className="sup-form-subtitle">สร้างบัญชีและกำหนดสิทธิ์สำหรับเข้าใช้งานระบบ</p></div>
      </div>
      {error && <div className="api-message error employee-create-error">{error}</div>}
      <form className="sup-form-container" onSubmit={createEmployee}>
        <section className="shared-form-section">
          <div className="shared-form-section-heading"><h2>ข้อมูลบัญชีพนักงาน</h2><p>ข้อมูลสำหรับระบุตัวตนและเข้าสู่ระบบ</p></div>
          <div>
            <label className="sup-form-label">ชื่อ-นามสกุล <span className="sup-required">*</span></label>
            <div className="sup-input-wrap"><input autoComplete="name" className="sup-input sup-input-icon" name="fullName" placeholder="เช่น สมชาย ใจดี" required /><UserRound className="sup-icon-left" size={18} /></div>
          </div>
          <div className="sup-grid-2col">
            <div><label className="sup-form-label">อีเมล <span className="sup-required">*</span></label><div className="sup-input-wrap"><input autoComplete="email" className="sup-input sup-input-icon" name="email" placeholder="employee@example.com" required type="email" /><Mail className="sup-icon-left" size={18} /></div></div>
            <div><label className="sup-form-label">ตำแหน่ง / สิทธิ์การใช้งาน <span className="sup-required">*</span></label><div className="sup-input-wrap"><select className="sup-input sup-input-icon" name="role" onChange={(event) => setRole(event.target.value as EmployeeRole)} value={role}><option value="cashier">แคชเชียร์</option><option value="stock">พนักงานคลัง</option><option value="owner">เจ้าของร้าน</option></select><ShieldCheck className="sup-icon-left" size={18} /></div><small className="shared-form-help">{roleDescriptions[role]}</small></div>
          </div>
        </section>
        <section className="shared-form-section">
          <div className="shared-form-section-heading"><h2>ตั้งรหัสผ่าน</h2><p>รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p></div>
          <div className="sup-grid-2col">
            <div><label className="sup-form-label">รหัสผ่าน <span className="sup-required">*</span></label><div className="sup-input-wrap"><input autoComplete="new-password" className="sup-input sup-input-icon" minLength={8} name="password" placeholder="อย่างน้อย 8 ตัวอักษร" required type="password" /><LockKeyhole className="sup-icon-left" size={18} /></div></div>
            <div><label className="sup-form-label">ยืนยันรหัสผ่าน <span className="sup-required">*</span></label><div className="sup-input-wrap"><input autoComplete="new-password" className="sup-input sup-input-icon" minLength={8} name="confirmPassword" placeholder="กรอกรหัสผ่านอีกครั้ง" required type="password" /><LockKeyhole className="sup-icon-left" size={18} /></div></div>
          </div>
        </section>
        <div className="sup-form-footer"><button className="sup-btn-cancel" disabled={saving} onClick={() => router.push("/employees")} type="button">ยกเลิก</button><button className="sup-btn-submit" disabled={saving} type="submit"><Save size={18} /><span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span></button></div>
      </form>
    </div>
  </AdminShell>;
}
