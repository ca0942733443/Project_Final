"use client";

import { ArrowLeft, CarFront, Phone, Save, WalletCards } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
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
};

type CustomerOptions = {
  carTypes: Array<{ id: number; name: string | null }>;
};

export default function CustomerEditScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = Number(params.id);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [options, setOptions] = useState<CustomerOptions>({ carTypes: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(customerId) || customerId <= 0) {
      setError("รหัสลูกค้าไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    let cancelled = false;
    void Promise.all([
      apiFetch<Customer>(`/customers/${customerId}`),
      apiFetch<CustomerOptions>("/customers/options"),
    ]).then(([customerData, customerOptions]) => {
      if (cancelled) return;
      setCustomer(customerData);
      setOptions(customerOptions);
    }).catch((loadError) => {
      if (!cancelled) setError(errorMessage(loadError));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [customerId]);

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      await apiFetch(`/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          carPlate: form.get("carPlate"),
          location: form.get("location"),
          carTypeId: form.get("carTypeId") ? Number(form.get("carTypeId")) : null,
          creditLimit: Number(form.get("creditLimit")),
        }),
      });
      router.push("/customers");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return <AdminShell active="customers" contentClassName="shared-form-page">
    <div className="sup-form-wrapper">
      <div className="sup-form-header">
        <button aria-label="กลับไปรายชื่อลูกค้า" className="sup-back-btn" onClick={() => router.push("/customers")} type="button"><ArrowLeft size={20} /></button>
        <div><h1 className="sup-form-title">แก้ไขข้อมูลลูกค้า</h1><p className="sup-form-subtitle">{customer ? `${customer.customerCode} · แก้ไขข้อมูลติดต่อ การจัดส่ง และวงเงินขายเชื่อ` : "กำลังโหลดข้อมูลลูกค้า"}</p></div>
      </div>
      {loading && <div className="api-message">กำลังโหลดข้อมูลลูกค้า...</div>}
      {error && <div className="api-message error">{error}</div>}
      {customer && <form className="customer-edit-form-shell" onSubmit={saveCustomer}>
        <section className="sup-form-container customer-edit-section-card">
          <div className="shared-form-section-heading"><h2>ข้อมูลทั่วไป</h2><p>ข้อมูลสำหรับค้นหาและติดต่อกับลูกค้า</p></div>
          <div>
          <label className="sup-form-label">ชื่อ-นามสกุล <span className="sup-required">*</span></label>
          <input className="sup-input" defaultValue={customer.fullName} name="fullName" placeholder="เช่น สมชาย ใจดี" required />
          </div>
          <div className="sup-grid-2col">
            <div><label className="sup-form-label">เบอร์โทรศัพท์</label><div className="sup-input-wrap"><input className="sup-input sup-input-icon" defaultValue={customer.phone ?? ""} name="phone" placeholder="081-234-5678" type="tel" /><Phone className="sup-icon-left" size={18} /></div></div>
            <div><label className="sup-form-label">ทะเบียนรถ</label><div className="sup-input-wrap"><input className="sup-input sup-input-icon" defaultValue={customer.carPlate ?? ""} name="carPlate" placeholder="เช่น กข 1234" /><CarFront className="sup-icon-left" size={18} /></div></div>
          </div>
          <div>
            <label className="sup-form-label">สถานที่ / ที่อยู่จัดส่ง <span className="sup-required">*</span></label>
            <textarea className="sup-textarea shared-form-address" defaultValue={customer.location} name="location" placeholder="ระบุที่อยู่หรือจุดส่งสินค้าให้ชัดเจน..." required rows={3} />
          </div>
          <div><label className="sup-form-label">ประเภทรถ</label><select className="sup-input" defaultValue={customer.carTypeId ? String(customer.carTypeId) : ""} name="carTypeId"><option value="">ไม่ระบุ</option>{options.carTypes.map((option) => <option key={option.id} value={option.id}>{option.name ?? `#${option.id}`}</option>)}</select></div>
        </section>
        <section className="sup-form-container customer-edit-section-card">
          <div className="shared-form-section-heading"><h2>ข้อมูลขายเชื่อ</h2><p>กำหนดวงเงินและตรวจสอบสถานะหนี้ปัจจุบันของลูกค้า</p></div>
          <div className="customer-credit-edit-grid">
            <div className="customer-credit-limit-field"><label className="sup-form-label">วงเงินขายเชื่อ</label><div className="sup-input-wrap"><input aria-describedby="credit-limit-help" className="sup-input sup-input-icon" defaultValue={customer.creditLimit} min="0" name="creditLimit" placeholder="0.00" step="0.01" type="number" /><WalletCards className="sup-icon-left" size={18} /></div><small className="shared-form-help" id="credit-limit-help">ยอดขายเชื่อรวมต้องไม่เกินวงเงินนี้</small></div>
            <div className="customer-credit-summary"><span>ยอดค้างปัจจุบัน</span><strong>฿{Number(customer.balanceDue ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
            <div className={`customer-credit-summary ${Number(customer.overdueBalance ?? 0) > 0 ? "is-overdue" : ""}`}><span>ยอดเกินกำหนด</span><strong>฿{Number(customer.overdueBalance ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
          </div>
        </section>
        <div className="sup-form-footer customer-edit-form-footer"><button className="sup-btn-cancel" onClick={() => router.push("/customers")} type="button">ยกเลิก</button><button className="sup-btn-submit" disabled={saving} type="submit"><Save size={18} /><span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span></button></div>
      </form>}
    </div>
  </AdminShell>;
}
