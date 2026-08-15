"use client";

import { Trash2, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type EmployeeRole = "owner" | "cashier" | "stock";
type Employee = { id: number; email: string; fullName: string; role: EmployeeRole; isActive: number; createdAt: string | null };
type EmployeeStats = { totalEmployees: number; activeEmployees: number; owners: number; cashiers: number; stockStaff: number };
const roleLabels = { owner: "เจ้าของร้าน", cashier: "แคชเชียร์", stock: "พนักงานคลัง" } as const;

export default function EmployeesScreen() {
  const [showForm, setShowForm] = useState(false);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const [employees, employeeStats] = await Promise.all([
        apiFetch<Employee[]>("/employees"),
        apiFetch<EmployeeStats>("/employees/stats"),
      ]);
      setStaff(employees);
      setStats(employeeStats);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadEmployees(); }, []);

  const createEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"), role: form.get("role") }),
      });
      setShowForm(false);
      await loadEmployees();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`ปิดใช้งานบัญชีของ ${employee.fullName} หรือไม่?`)) return;
    try {
      await apiFetch(`/employees/${employee.id}`, { method: "DELETE" });
      await loadEmployees();
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  };

  return <AdminShell active="employees">
    <PageTitle title="จัดการบัญชีพนักงาน" subtitle="จัดการสิทธิ์ บทบาท และสถานะบัญชีที่บันทึกใน MySQL" action={<button className="primary-button" onClick={() => setShowForm(true)}><UserPlus size={17} /> เพิ่มพนักงาน</button>} />
    <div className="stat-grid four"><Stat label="พนักงานทั้งหมด" value={`${stats?.totalEmployees ?? 0} คน`} /><Stat label="บัญชีที่ใช้งาน" value={`${stats?.activeEmployees ?? 0} คน`} /><Stat label="แคชเชียร์" value={`${stats?.cashiers ?? 0} คน`} tone="neutral" /><Stat label="พนักงานคลัง" value={`${stats?.stockStaff ?? 0} คน`} tone="orange" /></div>
    {loading && <div className="api-message">กำลังโหลดบัญชีพนักงาน...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card"><div className="table-wrap"><table><thead><tr>{["ชื่อพนักงาน", "อีเมล", "ตำแหน่ง", "เข้าสู่ระบบล่าสุด", "สถานะ", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{staff.map(employee => <tr key={employee.id}><td><div className="person"><span>{employee.fullName.charAt(0)}</span><strong>{employee.fullName}</strong></div></td><td>{employee.email}</td><td>{roleLabels[employee.role]}</td><td>{employee.createdAt ? new Date(employee.createdAt).toLocaleDateString("th-TH") : "—"}</td><td><span className="status-pill s-0">ใช้งาน</span></td><td><button aria-label={`ปิดใช้งาน ${employee.fullName}`} className="tiny-button" onClick={() => void removeEmployee(employee)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div></section>
    {showForm && <div className="modal-backdrop"><form className="modal" onSubmit={createEmployee}><button type="button" className="modal-close" onClick={() => setShowForm(false)}><X /></button><h2>เพิ่มบัญชีพนักงาน</h2><label>ชื่อ-นามสกุล<input name="fullName" required /></label><label>อีเมล<input name="email" type="email" required /></label><label>รหัสผ่าน<input name="password" minLength={8} type="password" required /></label><label>ตำแหน่ง<select name="role"><option value="cashier">แคชเชียร์</option><option value="stock">พนักงานคลัง</option><option value="owner">เจ้าของร้าน</option></select></label><button className="primary-button" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : "บันทึกพนักงาน"}</button></form></div>}
  </AdminShell>;
}
