"use client";

import { Download, Eye, Pencil, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import TableActionMenu from "../_components/TableActionMenu";
import { apiFetch, errorMessage } from "../_lib/api";

type Customer = {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
  location: string;
  carTypeId: number | null;
  carTypeName: string | null;
  creditLimit: number;
  balanceDue: number;
  overdueBalance: number;
  orderCount: number;
  totalSpent: number;
  favoriteProduct: string | null;
  lastPurchaseAt: string | null;
};

type CustomerOptions = {
  carTypes: Array<{ id: number; name: string | null }>;
};

type CustomerStats = {
  totalCustomers: number;
  activeCustomers: number;
  customersWithDebt: number;
  totalBalanceDue: number;
};

function memberLevel(totalSpent: number) {
  if (totalSpent >= 100000) return "VIP";
  if (totalSpent >= 50000) return "GOLD";
  if (totalSpent >= 10000) return "SILVER";
  return "ทั่วไป";
}

function money(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [options, setOptions] = useState<CustomerOptions>({ carTypes: [] });
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const [customerRows, customerStats, customerOptions] = await Promise.all([
        apiFetch<Customer[]>("/customers"),
        apiFetch<CustomerStats>("/customers/stats"),
        apiFetch<CustomerOptions>("/customers/options"),
      ]);
      setCustomers(customerRows);
      setStats(customerStats);
      setOptions(customerOptions);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCustomers(); }, []);

  const openCreateForm = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: form.get("fullName"),
      phone: form.get("phone"),
      carPlate: form.get("carPlate"),
      location: form.get("location"),
      carTypeId: form.get("carTypeId") ? Number(form.get("carTypeId")) : null,
      creditLimit: Number(form.get("creditLimit")),
    };

    try {
      await apiFetch(editingCustomer ? `/customers/${editingCustomer.id}` : "/customers", {
        method: editingCustomer ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      closeForm();
      await loadCustomers();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (customer: Customer) => {
    if (!window.confirm(`ปิดใช้งานลูกค้า ${customer.fullName} หรือไม่? ประวัติการซื้อและการขายเชื่อจะยังคงอยู่`)) return;
    setDeletingId(customer.id);
    setError("");
    try {
      await apiFetch(`/customers/${customer.id}`, { method: "DELETE" });
      await loadCustomers();
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["รหัสลูกค้า", "ชื่อ-นามสกุล", "โทรศัพท์", "ทะเบียนรถ", "สถานที่", "ประเภทรถ", "วงเงินขายเชื่อ", "จำนวนบิล", "ยอดซื้อสะสม"],
      ...customers.map((customer) => [
        customer.customerCode,
        customer.fullName,
        customer.phone ?? "",
        customer.carPlate ?? "",
        customer.location,
        customer.carTypeName ?? "",
        customer.creditLimit,
        customer.orderCount,
        customer.totalSpent,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalOrders = customers.reduce((sum, customer) => sum + Number(customer.orderCount), 0);

  return <AdminShell active="customers">
    <PageTitle
      title="ลูกค้าและบัญชีขายเชื่อ"
      subtitle="เลือกลูกค้าเพื่อดูข้อมูล วงเงิน บิลขายเชื่อ และสินค้าที่ซื้อในแต่ละบิล"
      action={<div className="product-page-actions"><button className="secondary-button" onClick={exportCsv} type="button"><Download size={16} /> ส่งออก CSV</button><button className="primary-button" onClick={openCreateForm} type="button"><UserPlus size={17} /> เพิ่มลูกค้า</button></div>}
    />
    <div className="stat-grid four">
      <Stat label="ลูกค้าทั้งหมด" value={`${stats?.totalCustomers ?? 0} ราย`} />
      <Stat label="ลูกค้าที่มีหนี้" value={`${stats?.customersWithDebt ?? 0} ราย`} tone="orange" />
      <Stat label="ยอดค้างรวม" value={`฿${money(stats?.totalBalanceDue ?? 0)}`} tone="orange" />
      <Stat label="จำนวนบิลทั้งหมด" value={`${totalOrders.toLocaleString("th-TH")} บิล`} tone="neutral" />
    </div>
    {loading && <div className="api-message">กำลังโหลดข้อมูลลูกค้า...</div>}
    {error && <div className="api-message error">{error}</div>}
    <section className="data-card credit-card">
      <div className="table-wrap"><table><thead><tr>{["ลูกค้า", "เบอร์โทรศัพท์", "ทะเบียนรถ", "วงเงินขายเชื่อ", "ยอดค้าง", "เกินกำหนด", "ระดับสมาชิก", "ยอดซื้อสะสม", "จัดการ"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
        {customers.map((customer) => <tr key={customer.id}>
          <td><div className="person"><span>{customer.fullName.charAt(0)}</span><div><strong>{customer.fullName}</strong><small>{customer.customerCode}</small></div></div></td>
          <td>{customer.phone ?? "–"}</td>
          <td>{customer.carPlate ?? "–"}</td>
          <td>฿{money(customer.creditLimit)}</td>
          <td><strong className={Number(customer.balanceDue) > 0 ? "danger-text" : ""}>฿{money(customer.balanceDue)}</strong></td>
          <td className={Number(customer.overdueBalance) > 0 ? "danger-text" : ""}>฿{money(customer.overdueBalance)}</td>
          <td><span className="soft-tag">{memberLevel(Number(customer.totalSpent))}</span></td>
          <td>฿{money(customer.totalSpent)}</td>
          <td><TableActionMenu label={`จัดการลูกค้า ${customer.fullName}`}><Link className="table-action-menu-item" href={`/customer-credit?id=${customer.id}`} role="menuitem"><Eye size={15} /> ดูข้อมูลและบิลขายเชื่อ</Link><button className="table-action-menu-item" onClick={() => openEditForm(customer)} role="menuitem" type="button"><Pencil size={15} /> แก้ไขข้อมูล</button><button className="table-action-menu-item danger" disabled={deletingId === customer.id} onClick={() => void removeCustomer(customer)} role="menuitem" type="button"><Trash2 size={15} /> ลบลูกค้า</button></TableActionMenu></td>
        </tr>)}
        {!loading && customers.length === 0 && <tr><td className="empty-cell" colSpan={9}>ยังไม่มีลูกค้าในระบบ</td></tr>}
      </tbody></table></div>
      <div className="recommendation-pagination"><span>แสดงลูกค้าที่ใช้งานอยู่ทั้งหมด {customers.length} รายการ</span></div>
    </section>
    {showForm && <div className="modal-backdrop"><form key={editingCustomer?.id ?? "new"} className="modal customer-form-modal" onSubmit={saveCustomer}><button type="button" className="modal-close" onClick={closeForm}><X /></button><h2>{editingCustomer ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}</h2><p className="modal-description">ข้อมูลทั่วไปและวงเงินขายเชื่อของลูกค้า ส่วนรายการบิลและการรับชำระจัดการได้ที่หน้าบัญชีขายเชื่อ</p><div className="product-form-grid"><label className="wide">ชื่อ-นามสกุล<input defaultValue={editingCustomer?.fullName ?? ""} name="fullName" required /></label><label>เบอร์โทรศัพท์<input defaultValue={editingCustomer?.phone ?? ""} name="phone" type="tel" /></label><label>ทะเบียนรถ<input defaultValue={editingCustomer?.carPlate ?? ""} name="carPlate" /></label><label>สถานที่<input defaultValue={editingCustomer?.location ?? ""} name="location" required /></label><label>ประเภทรถ<select defaultValue={editingCustomer?.carTypeId ? String(editingCustomer.carTypeId) : ""} name="carTypeId"><option value="">ไม่ระบุ</option>{options.carTypes.map((option) => <option key={option.id} value={option.id}>{option.name ?? `#${option.id}`}</option>)}</select></label><label>วงเงินขายเชื่อ<input defaultValue={editingCustomer?.creditLimit ?? 0} min="0" name="creditLimit" step="0.01" type="number" /></label></div><div className="product-form-actions"><button onClick={closeForm} type="button">ยกเลิก</button><button className="primary-button" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : editingCustomer ? "บันทึกการแก้ไข" : "บันทึกลูกค้า"}</button></div></form></div>}
  </AdminShell>;
}
