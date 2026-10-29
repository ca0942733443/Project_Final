"use client";

import { ArrowLeft, LockKeyhole, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type EmployeeRole = "owner" | "cashier" | "stock";
type Employee = {
  id: number;
  email: string;
  fullName: string;
  role: EmployeeRole;
  isActive: number;
  lastLoginAt: string | null;
};

const roleDescriptions: Record<EmployeeRole, string> = {
  cashier: "ขายสินค้า รับชำระเงิน และดูประวัติการขาย",
  stock: "จัดการสินค้า สต็อก และคำสั่งซื้อสินค้าคงคลัง",
  owner: "เข้าถึงและจัดการข้อมูลทั้งหมดของระบบ",
};

export default function EmployeeEditScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = Number(params.id);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [role, setRole] = useState<EmployeeRole>("cashier");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      setError("รหัสพนักงานไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadEmployee = async () => {
      try {
        return await apiFetch<Employee>(`/employees/${employeeId}`);
      } catch {
        const employees = await apiFetch<Employee[]>("/employees?includeInactive=true");
        const matchedEmployee = employees.find((item) => item.id === employeeId);
        if (!matchedEmployee) throw new Error("ไม่พบพนักงาน");
        return matchedEmployee;
      }
    };

    void loadEmployee().then((employeeData) => {
      if (cancelled) return;
      setEmployee(employeeData);
      setRole(employeeData.role);
    }).catch((loadError) => {
      if (!cancelled) setError(errorMessage(loadError));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [employeeId]);

  const updateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password && password.length < 8) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          role,
          ...(password ? { password } : {}),
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
        <div><h1 className="sup-form-title">แก้ไขข้อมูลพนักงาน</h1><p className="sup-form-subtitle">{employee ? `แก้ไขบัญชีของ ${employee.fullName}` : "กำลังโหลดข้อมูลพนักงาน"}</p></div>
      </div>
      {loading && <div className="api-message">กำลังโหลดข้อมูลพนักงาน...</div>}
      {error && <div className="api-message error employee-create-error">{error}</div>}
      {employee && <form className="sup-form-container" onSubmit={updateEmployee}>
        <section className="shared-form-section">
          <div className="shared-form-section-heading"><h2>ข้อมูลบัญชีพนักงาน</h2><p>แก้ไขข้อมูลสำหรับระบุตัวตนและสิทธิ์การเข้าใช้งาน</p></div>
          <div>
            <label className="sup-form-label">ชื่อ-นามสกุล <span className="sup-required">*</span></label>
            <div className="sup-input-wrap"><input autoComplete="name" className="sup-input sup-input-icon" defaultValue={employee.fullName} name="fullName" required /><UserRound className="sup-icon-left" size={18} /></div>
          </div>
          <div className="sup-grid-2col">
            <div><label className="sup-form-label">อีเมล <span className="sup-required">*</span></label><div className="sup-input-wrap"><input autoComplete="email" className="sup-input sup-input-icon" defaultValue={employee.email} name="email" required type="email" /><Mail className="sup-icon-left" size={18} /></div></div>
            <div><label className="sup-form-label">ตำแหน่ง / สิทธิ์การใช้งาน <span className="sup-required">*</span></label><div className="sup-input-wrap"><select className="sup-input sup-input-icon" name="role" onChange={(event) => setRole(event.target.value as EmployeeRole)} value={role}><option value="cashier">แคชเชียร์</option><option value="stock">พนักงานคลัง</option><option value="owner">เจ้าของร้าน</option></select><ShieldCheck className="sup-icon-left" size={18} /></div><small className="shared-form-help">{roleDescriptions[role]}</small></div>
          </div>
        </section>
        <section className="shared-form-section">
          <div className="shared-form-section-heading"><h2>เปลี่ยนรหัสผ่าน</h2><p>เว้นว่างทั้งสองช่องหากต้องการใช้รหัสผ่านเดิม</p></div>
          <div className="sup-grid-2col">
            <div><label className="sup-form-label">รหัสผ่านใหม่</label><div className="sup-input-wrap"><input autoComplete="new-password" className="sup-input sup-input-icon" minLength={8} name="password" placeholder="อย่างน้อย 8 ตัวอักษร" type="password" /><LockKeyhole className="sup-icon-left" size={18} /></div></div>
            <div><label className="sup-form-label">ยืนยันรหัสผ่านใหม่</label><div className="sup-input-wrap"><input autoComplete="new-password" className="sup-input sup-input-icon" minLength={8} name="confirmPassword" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" type="password" /><LockKeyhole className="sup-icon-left" size={18} /></div></div>
          </div>
        </section>
        <div className="sup-form-footer"><button className="sup-btn-cancel" disabled={saving} onClick={() => router.push("/employees")} type="button">ยกเลิก</button><button className="sup-btn-submit" disabled={saving} type="submit"><Save size={18} /><span>{saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</span></button></div>
      </form>}
    </div>
  </AdminShell>;
}
