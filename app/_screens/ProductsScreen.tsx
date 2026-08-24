"use client";

import { PackagePlus, Pencil, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type Product = {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string;
  supplierId: number | null;
  supplierName: string | null;
  price: number;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: number;
};

type Category = { id: number; name: string; slug: string };
type Supplier = { id: number; name: string; phone: string | null; address: string | null };
type ProductForm = {
  sku: string;
  name: string;
  categoryId: string;
  supplierId: string;
  unit: string;
  price: string;
  stockQuantity: string;
  lowStockThreshold: string;
};
type SupplierForm = { name: string; phone: string; address: string };
type StockForm = { productId: string; supplierId: string; quantity: string; unitCost: string; note: string };

function blankProductForm(categoryId = ""): ProductForm {
  return { sku: "", name: "", categoryId, supplierId: "", unit: "ชิ้น", price: "", stockQuantity: "0", lowStockThreshold: "0" };
}

const blankForm = blankProductForm();
const blankSupplierForm: SupplierForm = { name: "", phone: "", address: "" };
const blankStockForm: StockForm = { productId: "", supplierId: "", quantity: "", unitCost: "0", note: "" };

function formFromProduct(product: Product): ProductForm {
  return {
    sku: product.sku,
    name: product.name,
    categoryId: String(product.categoryId),
    supplierId: product.supplierId ? String(product.supplierId) : "",
    unit: product.unit,
    price: String(product.price),
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
  };
}

function numberText(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState("");
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(blankSupplierForm);
  const [imageData, setImageData] = useState<string | null | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockFormError, setStockFormError] = useState("");
  const [stockForm, setStockForm] = useState<StockForm>(blankStockForm);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productRows, categoryRows, supplierRows] = await Promise.all([
        apiFetch<Product[]>("/products"),
        apiFetch<Category[]>("/categories"),
        apiFetch<Supplier[]>("/suppliers"),
      ]);
      setProducts(productRows);
      setCategories(categoryRows);
      setSuppliers(supplierRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
      const matchesCategory = !category || String(product.categoryId) === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, products, search]);

  const openCreate = () => {
    setFormOpen(true);
    setEditing(null);
    setForm(blankProductForm(categories[0] ? String(categories[0].id) : ""));
    setImageData(undefined);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setFormError("");
  };

  const openEdit = (product: Product) => {
    setFormOpen(true);
    setEditing(product);
    setForm(formFromProduct(product));
    setImageData(undefined);
    setImagePreview(product.imageUrl);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setFormError("");
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  };

  const updateField = (field: keyof ProductForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setFormError("รองรับเฉพาะรูป PNG, JPG หรือ WEBP");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFormError("ขนาดรูปสินค้าต้องไม่เกิน 2 MB");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageData(reader.result);
        setImagePreview(reader.result);
        setFormError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const openSupplierForm = () => {
    setSupplierForm(blankSupplierForm);
    setSupplierFormError("");
    setSupplierFormOpen(true);
  };

  const closeSupplierForm = () => {
    if (supplierSaving) return;
    setSupplierFormOpen(false);
    setSupplierFormError("");
  };

  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSupplierSaving(true);
    setSupplierFormError("");
    try {
      if (!supplierForm.name.trim()) throw new Error("กรุณาระบุชื่อผู้จำหน่าย");
      await apiFetch("/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: supplierForm.name.trim(), phone: supplierForm.phone.trim(), address: supplierForm.address.trim() }),
      });
      setSupplierFormOpen(false);
      await loadProducts();
    } catch (saveError) {
      setSupplierFormError(errorMessage(saveError));
    } finally {
      setSupplierSaving(false);
    }
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        unit: form.unit.trim(),
        price: Number(form.price),
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        imageData,
      };
      if (!payload.sku || !payload.name || !payload.categoryId || !payload.unit) {
        throw new Error("กรุณากรอกข้อมูลสินค้าให้ครบถ้วน");
      }
      if (!Number.isFinite(payload.price) || payload.price < 0
        || !Number.isFinite(payload.stockQuantity) || payload.stockQuantity < 0
        || !Number.isFinite(payload.lowStockThreshold) || payload.lowStockThreshold < 0) {
        throw new Error("ราคาและจำนวนสต็อกต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      }
      if (editing) {
        await apiFetch(`/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/products", { method: "POST", body: JSON.stringify(payload) });
      }
      setFormOpen(false);
      setEditing(null);
      await loadProducts();
    } catch (saveError) {
      setFormError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openStockForm = (product: Product) => {
    setStockForm({ ...blankStockForm, productId: String(product.id), supplierId: product.supplierId ? String(product.supplierId) : "" });
    setStockFormError("");
    setStockFormOpen(true);
  };

  const closeStockForm = () => {
    if (stockSaving) return;
    setStockFormOpen(false);
    setStockFormError("");
  };

  const saveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStockSaving(true);
    setStockFormError("");
    try {
      const quantity = Number(stockForm.quantity);
      const unitCost = Number(stockForm.unitCost || 0);
      if (!stockForm.productId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("กรุณาระบุจำนวนเติมสต็อกที่มากกว่า 0");
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("ต้นทุนต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      await apiFetch("/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(stockForm.productId),
          movementType: "purchase",
          quantity,
          unitCost,
          supplierId: stockForm.supplierId ? Number(stockForm.supplierId) : null,
          note: stockForm.note.trim() || "รับสินค้าเข้าจากหน้าจัดการสินค้า",
        }),
      });
      setStockFormOpen(false);
      await loadProducts();
    } catch (saveError) {
      setStockFormError(errorMessage(saveError));
    } finally {
      setStockSaving(false);
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`ต้องการลบสินค้า “${product.name}” หรือไม่? สินค้าจะถูกปิดการขายและเก็บประวัติเดิมไว้`)) return;
    setError("");
    try {
      await apiFetch(`/products/${product.id}`, { method: "DELETE" });
      await loadProducts();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  const lowStockCount = products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold).length;
  const outOfStockCount = products.filter((product) => product.stockQuantity <= 0).length;

  return <AdminShell active="products">
    <PageTitle
      title="จัดการสินค้า"
      subtitle="เพิ่ม แก้ไข และปิดการใช้งานสินค้าจากฐานข้อมูล MySQL"
      action={<div className="product-page-actions"><button className="secondary-button" onClick={openSupplierForm}><Truck size={17} /> เพิ่ม Supplier</button><button className="primary-button" onClick={openCreate} disabled={!categories.length}><Plus size={17} /> เพิ่มสินค้า</button></div>}
    />
    <div className="stat-grid four product-stats">
      <Stat label="สินค้าที่เปิดขาย" value={`${products.length} รายการ`} />
      <Stat label="หมวดหมู่สินค้า" value={`${categories.length} หมวด`} tone="neutral" />
      <Stat label="สต็อกต่ำ" value={`${lowStockCount} รายการ`} tone="orange" note="ควรตรวจสอบสต็อก" />
      <Stat label="สินค้าหมด" value={`${outOfStockCount} รายการ`} tone="red" />
    </div>

    {error && <div className="api-message error">{error}</div>}
    <section className="data-card products-card">
      <div className="table-tools product-tools">
        <label className="product-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือ SKU..." /></label>
        <select aria-label="กรองตามหมวดหมู่" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </div>
      {loading && <div className="api-message">กำลังโหลดข้อมูลสินค้า...</div>}
      {!loading && <div className="table-wrap"><table>
        <thead><tr>{["สินค้า", "SKU", "หมวดหมู่", "ผู้จำหน่าย", "ราคาขาย", "คงเหลือ", "สถานะ", "จัดการ"].map((title) => <th key={title}>{title}</th>)}</tr></thead>
        <tbody>{visibleProducts.map((product) => {
          const status = product.stockQuantity <= 0 ? "out" : product.stockQuantity <= product.lowStockThreshold ? "low" : "normal";
          return <tr key={product.id}>
            <td><div className="product-table-name"><span>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : product.name.slice(0, 1)}</span><div><strong>{product.name}</strong><small>{product.unit}</small></div></div></td>
            <td>{product.sku}</td>
            <td>{product.categoryName}</td>
            <td>{product.supplierName ?? "—"}</td>
            <td>฿{product.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
            <td>{numberText(product.stockQuantity)} {product.unit}</td>
            <td><span className={`status-pill ${status === "out" ? "s-2" : status === "low" ? "s-1" : ""}`}>{status === "out" ? "หมด" : status === "low" ? "สต็อกต่ำ" : "ปกติ"}</span></td>
            <td><div className="product-actions"><button className="tiny-button stock-button" onClick={() => openStockForm(product)} aria-label={`เติมสต็อก ${product.name}`}><PackagePlus size={15} /></button><button className="tiny-button" onClick={() => openEdit(product)} aria-label={`แก้ไข ${product.name}`}><Pencil size={15} /></button><button className="tiny-button danger-button" onClick={() => void removeProduct(product)} aria-label={`ลบ ${product.name}`}><Trash2 size={15} /></button></div></td>
          </tr>;
        })}</tbody>
      </table></div>}
      {!loading && visibleProducts.length === 0 && <div className="api-message">ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>}
      <div className="pagination"><span>แสดง {visibleProducts.length} จาก {products.length} รายการ</span></div>
    </section>

    <section className="data-card supplier-card">
      <div className="card-heading"><h2><Truck size={20} /> ผู้จำหน่ายสินค้า ({suppliers.length})</h2><button onClick={openSupplierForm}><Plus size={15} /> เพิ่ม Supplier</button></div>
      {suppliers.length === 0 ? <div className="api-message">ยังไม่มีข้อมูลผู้จำหน่าย</div> : <div className="table-wrap"><table><thead><tr>{["ชื่อผู้จำหน่าย", "โทรศัพท์", "ที่อยู่"].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong></td><td>{supplier.phone ?? "—"}</td><td>{supplier.address ?? "—"}</td></tr>)}</tbody></table></div>}
    </section>

    {supplierFormOpen ? <div className="modal-backdrop" onMouseDown={closeSupplierForm}>
      <form className="modal supplier-form-modal" onSubmit={saveSupplier} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={closeSupplierForm} aria-label="ปิด"><X /></button>
        <h2>เพิ่ม Supplier</h2>
        <p className="modal-description">ข้อมูลจะถูกบันทึกลงตาราง suppliers ใน MySQL และนำไปใช้เป็นผู้จำหน่ายตอนรับสินค้าเข้า</p>
        {supplierFormError && <div className="form-error">{supplierFormError}</div>}
        <label>ชื่อผู้จำหน่าย<input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder="เช่น บริษัท วัตถุดิบไทย จำกัด" required /></label>
        <label>โทรศัพท์<input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="เช่น 081-234-5678" /></label>
        <label>ที่อยู่<textarea className="supplier-address" value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} placeholder="ที่อยู่ผู้จำหน่าย" /></label>
        <div className="product-form-actions"><button type="button" onClick={closeSupplierForm}>ยกเลิก</button><button className="primary-button" type="submit" disabled={supplierSaving}>{supplierSaving ? "กำลังบันทึก..." : "บันทึก Supplier"}</button></div>
      </form>
    </div> : null}

    {stockFormOpen ? <div className="modal-backdrop" onMouseDown={closeStockForm}>
      <form className="modal stock-form-modal" onSubmit={saveStock} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={closeStockForm} aria-label="ปิด"><X /></button>
        <h2>เติมสต็อกสินค้า</h2>
        <p className="modal-description">สร้างล็อตรับเข้าและบันทึกการเคลื่อนไหวสต็อกลง MySQL</p>
        {stockFormError && <div className="form-error">{stockFormError}</div>}
        <label>สินค้า<select value={stockForm.productId} onChange={(event) => setStockForm((current) => ({ ...current, productId: event.target.value }))} required>{products.map((product) => <option value={product.id} key={product.id}>{product.name} (คงเหลือ {numberText(product.stockQuantity)} {product.unit})</option>)}</select></label>
        <div className="product-form-grid">
          <label>จำนวนเติมเข้า<input type="number" min="0.001" step="0.001" value={stockForm.quantity} onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} required /></label>
          <label>ต้นทุนต่อหน่วย (บาท)<input type="number" min="0" step="0.01" value={stockForm.unitCost} onChange={(event) => setStockForm((current) => ({ ...current, unitCost: event.target.value }))} /></label>
          <label className="wide">Supplier<select value={stockForm.supplierId} onChange={(event) => setStockForm((current) => ({ ...current, supplierId: event.target.value }))}><option value="">ใช้ผู้จำหน่ายทั่วไป</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
          <label className="wide">หมายเหตุ<input value={stockForm.note} onChange={(event) => setStockForm((current) => ({ ...current, note: event.target.value }))} placeholder="เช่น เลขที่ใบรับสินค้า" /></label>
        </div>
        <div className="product-form-actions"><button type="button" onClick={closeStockForm}>ยกเลิก</button><button className="primary-button" type="submit" disabled={stockSaving}>{stockSaving ? "กำลังบันทึก..." : "บันทึกเติมสต็อก"}</button></div>
      </form>
    </div> : null}

    {formOpen ? <div className="modal-backdrop" onMouseDown={closeForm}>
      <form className="modal product-form-modal" onSubmit={saveProduct} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={closeForm} aria-label="ปิด"><X /></button>
        <h2>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2>
        <p className="modal-description">ข้อมูลจะถูกบันทึกลงตาราง products และ product_units ใน MySQL</p>
        {formError && <div className="form-error">{formError}</div>}
        <div className="product-form-scroll">
          <div className="product-form-grid">
            <label>SKU<input value={form.sku} onChange={(event) => updateField("sku", event.target.value)} placeholder="เช่น ING-SUGAR-01" required /></label>
            <label>ชื่อสินค้า<input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="ชื่อสินค้า" required /></label>
            <label>หมวดหมู่<select value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} required><option value="">เลือกหมวดหมู่</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Supplier<select value={form.supplierId} onChange={(event) => updateField("supplierId", event.target.value)}><option value="">ไม่ระบุ</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>หน่วยสินค้า<input value={form.unit} onChange={(event) => updateField("unit", event.target.value)} placeholder="เช่น ชิ้น, กิโลกรัม" required /></label>
            <label>ราคาขาย (บาท)<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} required /></label>
            <label>จำนวนเริ่มต้น<input type="number" min="0" step="0.001" value={form.stockQuantity} onChange={(event) => updateField("stockQuantity", event.target.value)} required /></label>
            <label>จุดแจ้งเตือนสต็อก<input type="number" min="0" step="0.001" value={form.lowStockThreshold} onChange={(event) => updateField("lowStockThreshold", event.target.value)} required /></label>
            <label className="wide">รูปสินค้า<input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /><small className="image-help">PNG, JPG หรือ WEBP ขนาดไม่เกิน 2 MB</small></label>
            {imagePreview && <div className="image-preview wide"><img src={imagePreview} alt="ตัวอย่างรูปสินค้า" /><button type="button" onClick={() => { setImageData(editing ? null : undefined); setImagePreview(null); }}>ล้างรูป</button></div>}
          </div>
        </div>
        <div className="product-form-actions"><button type="button" onClick={closeForm}>ยกเลิก</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}</button></div>
      </form>
    </div> : null}
  </AdminShell>;
}
