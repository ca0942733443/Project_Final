"use client";

import { Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import TableActionMenu from "../_components/TableActionMenu";
import { apiFetch, errorMessage } from "../_lib/api";

type EmployeeRole = "owner" | "cashier" | "stock";
type Employee = { id: number; email: string; fullName: string; role: EmployeeRole; isActive: number; lastLoginAt: string | null };
type EmployeeStats = { totalEmployees: number; activeEmployees: number; owners: number; cashiers: number; stockStaff: number };
const roleLabels = { owner: "เจ้าของร้าน", cashier: "แคชเชียร์", stock: "พนักงานคลัง" } as const;

export default function EmployeesScreen() {
  const [staff, setStaff] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
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
    <PageTitle title="จัดการบัญชีพนักงาน" subtitle="จัดการสิทธิ์ บทบาท และสถานะบัญชีที่บันทึกใน MySQL" action={<Link className="primary-button" href="/employees/new"><UserPlus size={17} /> เพิ่มพนักงาน</Link>} />
    <div className="stat-grid four"><Stat label="พนักงานทั้งหมด" value={`${stats?.totalEmployees ?? 0} คน`} /><Stat label="บัญชีที่ใช้งาน" value={`${stats?.activeEmployees ?? 0} คน`} /><Stat label="แคชเชียร์" value={`${stats?.cashiers ?? 0} คน`} tone="neutral" /><Stat label="พนักงานคลัง" value={`${stats?.stockStaff ?? 0} คน`} tone="orange" /></div>
    {loading && <div className="api-message">กำลังโหลดบัญชีพนักงาน...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card"><div className="table-wrap"><table><thead><tr>{["ชื่อพนักงาน", "อีเมล", "ตำแหน่ง", "เข้าสู่ระบบล่าสุด", "สถานะ", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{staff.map(employee => <tr key={employee.id}><td><div className="person"><span>{employee.fullName.charAt(0)}</span><strong>{employee.fullName}</strong></div></td><td>{employee.email}</td><td>{roleLabels[employee.role]}</td><td>{employee.lastLoginAt ? new Date(employee.lastLoginAt).toLocaleDateString("th-TH") : "—"}</td><td><span className="status-pill s-0">ใช้งาน</span></td><td><TableActionMenu label={`จัดการพนักงาน ${employee.fullName}`}><Link className="table-action-menu-item" href={`/employees/${employee.id}/edit`} role="menuitem"><Pencil size={15} /> แก้ไขข้อมูล</Link><button className="table-action-menu-item danger" onClick={() => void removeEmployee(employee)} role="menuitem" type="button"><Trash2 size={15} /> ปิดใช้งานบัญชี</button></TableActionMenu></td></tr>)}</tbody></table></div></section>
  </AdminShell>;
}
