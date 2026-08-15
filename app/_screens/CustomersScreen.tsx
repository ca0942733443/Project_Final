"use client";

import { ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type Customer = {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  creditLimit: number;
  balanceDue: number;
  orderCount: number;
  totalSpent: number;
  favoriteProduct: string | null;
  lastPurchaseAt: string | null;
};

type CustomerStats = {
  totalCustomers: number;
  activeCustomers: number;
  customersWithDebt: number;
  totalBalanceDue: number;
  creditSalesThisMonth: number;
};

function memberLevel(totalSpent: number) {
  if (totalSpent >= 100000) return "VIP";
  if (totalSpent >= 50000) return "GOLD";
  if (totalSpent >= 10000) return "SILVER";
  return "ทั่วไป";
}

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const [customerRows, customerStats] = await Promise.all([
        apiFetch<Customer[]>("/customers"),
        apiFetch<CustomerStats>("/customers/stats"),
      ]);
      setCustomers(customerRows);
      setStats(customerStats);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCustomers(); }, []);

  const createCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          customerCode: form.get("customerCode"),
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          creditLimit: Number(form.get("creditLimit")),
        }),
      });
      setShowForm(false);
      await loadCustomers();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [["รหัสลูกค้า", "ชื่อ", "โทรศัพท์", "ยอดซื้อสะสม", "วงเงินเครดิต", "ยอดค้างชำระ"], ...customers.map((customer) => [customer.customerCode, customer.fullName, customer.phone ?? "", customer.totalSpent, customer.creditLimit, customer.balanceDue])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <AdminShell active="customers">
    <PageTitle title="ระบบบัญชีขายเชื่อ" subtitle={`ข้อมูลอัปเดต: ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`} />
    {loading && <div className="api-message">กำลังโหลดข้อมูลลูกค้า...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card credit-card"><div className="table-wrap"><table><thead><tr>{["ชื่อลูกค้า", "เบอร์โทรศัพท์", "สินค้าประจำ", "ยอดค้างชำระ", "สถานะ", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{customers.filter(customer => customer.creditLimit > 0 || customer.balanceDue > 0).slice(0, 4).map(customer => { const isOver = customer.creditLimit > 0 && customer.balanceDue >= customer.creditLimit; const isDue = customer.balanceDue > customer.creditLimit * .6; return <tr key={customer.id}><td><strong>{customer.fullName}</strong></td><td>{customer.phone ?? "–"}</td><td><span className="soft-tag">{customer.favoriteProduct ?? "ไม่ระบุ"}</span></td><td className={isDue ? "danger-text" : ""}><strong>฿{customer.balanceDue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></td><td><span className={`status-pill ${isOver ? "s-1" : isDue ? "s-3" : "s-0"}`}>{isOver ? "เกินกำหนด" : isDue ? "วงเงินเต็ม" : "ปกติ"}</span></td><td><div className="credit-actions"><button aria-label="ดูประวัติ"><RotateCcw size={19}/></button><button className="row-action">รับชำระ</button></div></td></tr>; })}</tbody></table></div><div className="recommendation-pagination"><span>แสดงผล 1-{Math.min(4, customers.length)} จากทั้งหมด {customers.length} รายการ</span><div><button><ChevronLeft size={17}/></button><button className="selected">1</button><button>2</button><button>3</button><button><ChevronRight size={17}/></button></div></div></section>
    {showForm && <div className="modal-backdrop"><form className="modal" onSubmit={createCustomer}><button type="button" className="modal-close" onClick={() => setShowForm(false)}><X /></button><h2>เพิ่มลูกค้าใหม่</h2><label>รหัสลูกค้า<input name="customerCode" required placeholder="เช่น CUS-0001" /></label><label>ชื่อ-นามสกุล<input name="fullName" required /></label><label>เบอร์โทรศัพท์<input name="phone" type="tel" /></label><label>วงเงินเครดิต<input name="creditLimit" min="0" step="0.01" type="number" defaultValue="0" /></label><button className="primary-button" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : "บันทึกลูกค้า"}</button></form></div>}
  </AdminShell>;
}
