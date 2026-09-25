"use client";

import { ArrowLeft, Boxes, Check, PackagePlus, Save, Search, Trash2, Truck, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
};

type Category = { id: number; name: string };
type Supplier = { id: number; name: string };
type HeldOrderQuantities = Record<number, number>;
type HeldProduct = Product & { quantity: number };

const recommendationOrderDraftKey = "recommendation-order-draft";

function quantityText(value: number) {
  return Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });
}

function suggestedQuantity(product: Product) {
  return Math.max(1, Math.ceil(product.lowStockThreshold * 2 - product.stockQuantity));
}

function stockState(product: Product) {
  if (product.stockQuantity <= 0) return "out" as const;
  if (product.stockQuantity <= product.lowStockThreshold) return "low" as const;
  return "normal" as const;
}

export default function InventoryOrderCreateScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [heldOrderQuantities, setHeldOrderQuantities] = useState<HeldOrderQuantities>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("สร้างจากรายการแนะนำการสั่งซื้อ");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
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
  };

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    try {
      const savedDraft = window.sessionStorage.getItem(recommendationOrderDraftKey);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft) as Record<string, unknown>;
        const validDraft: HeldOrderQuantities = {};
        Object.entries(parsedDraft).forEach(([productIdText, quantityValue]) => {
          const productId = Number(productIdText);
          const quantity = Number(quantityValue);
          if (Number.isInteger(productId) && productId > 0 && quantity > 0) validDraft[productId] = quantity;
        });
        setHeldOrderQuantities(validDraft);
      }
    } catch {
      window.sessionStorage.removeItem(recommendationOrderDraftKey);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    if (Object.keys(heldOrderQuantities).length > 0) window.sessionStorage.setItem(recommendationOrderDraftKey, JSON.stringify(heldOrderQuantities));
    else window.sessionStorage.removeItem(recommendationOrderDraftKey);
  }, [draftLoaded, heldOrderQuantities]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
      const matchesCategory = !category || String(product.categoryId) === category;
      const matchesSupplier = !supplier || String(product.supplierId) === supplier;
      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [category, products, search, supplier]);

  const heldItems = useMemo(() => products
    .filter((product) => Number(heldOrderQuantities[product.id] ?? 0) > 0)
    .map((product) => ({ ...product, quantity: Number(heldOrderQuantities[product.id]) })), [heldOrderQuantities, products]);

  const supplierGroups = useMemo(() => Array.from(heldItems.reduce((groups, product) => {
    const key = product.supplierId === null ? "general" : String(product.supplierId);
    const group = groups.get(key) ?? { key, supplierName: product.supplierName ?? "ผู้จำหน่ายทั่วไป", items: [] as HeldProduct[], totalQuantity: 0 };
    group.items.push(product);
    group.totalQuantity += product.quantity;
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; supplierName: string; items: HeldProduct[]; totalQuantity: number }>()).values()), [heldItems]);

  const totalQuantity = heldItems.reduce((total, product) => total + product.quantity, 0);

  const toggleProduct = (product: Product) => {
    setHeldOrderQuantities((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = suggestedQuantity(product);
      return next;
    });
  };

  const updateQuantity = (productId: number, value: string) => {
    const quantity = Number(value);
    setHeldOrderQuantities((current) => ({ ...current, [productId]: Number.isFinite(quantity) && quantity > 0 ? quantity : 0 }));
  };

  const clearDraft = () => setHeldOrderQuantities({});

  const confirmOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!heldItems.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ count: number; ids: number[] }>("/inventory-orders", {
        method: "POST",
        body: JSON.stringify({
          note: note.trim() || "สร้างจากรายการแนะนำการสั่งซื้อ",
          splitBySupplier: true,
          items: heldItems.map((product) => ({ productId: product.id, quantity: product.quantity })),
        }),
      });
      setHeldOrderQuantities({});
      router.push(`/purchase-order?ids=${result.ids.join(",")}`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return <AdminShell active="inventory-orders" contentClassName="inventory-order-create-page">
    <PageTitle
      title="สร้างใบคำสั่งซื้อ"
      subtitle="ตรวจสอบรายการที่พักไว้ แก้ไขจำนวน และสร้างใบสั่งซื้อแยกตาม Supplier เมื่อยืนยัน"
      action={<Link className="secondary-button" href="/recommendations"><ArrowLeft size={16} /> กลับหน้าแนะนำ</Link>}
    />

    <div className="stat-grid four inventory-order-create-stats">
      <Stat label="สินค้าที่พักไว้" value={`${heldItems.length} รายการ`} />
      <Stat label="Supplier" value={`${supplierGroups.length} ราย`} tone="neutral" />
      <Stat label="จำนวนรวม" value={`${quantityText(totalQuantity)} หน่วย`} tone="orange" />
      <Stat label="สถานะ" value="ยังไม่สร้างจริง" tone="red" note="รอยืนยัน" />
    </div>

    {error && <div className="api-message error">{error}</div>}
    <section className="inventory-order-create-page-shell">
      <div className="inventory-order-create-page-toolbar"><label className="inventory-order-create-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาสินค้า หรือ SKU..." /></label><select aria-label="กรองหมวดหมู่" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">ทุกหมวดหมู่</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="กรอง Supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="">ทุก Supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="inventory-order-create-page-layout">
        <div className="inventory-order-product-picker"><div className="inventory-order-create-heading"><div><h2>เลือกสินค้า</h2><p>รายการที่กดเลือกจะถูกพักไว้ด้านขวา และยังไม่ถูกสร้างในฐานข้อมูล</p></div><span>{visibleProducts.length} รายการ</span></div>{loading && <div className="inventory-order-create-empty"><Boxes size={24} />กำลังโหลดสินค้า...</div>}{!loading && visibleProducts.length === 0 && <div className="inventory-order-create-empty"><PackagePlus size={24} />ไม่พบสินค้า</div>}{!loading && visibleProducts.length > 0 && <div className="inventory-order-product-list">{visibleProducts.map((product) => { const isHeld = Number(heldOrderQuantities[product.id] ?? 0) > 0; const state = stockState(product); return <article className={`inventory-order-product-row ${isHeld ? "held" : ""}`} key={product.id}><div className="inventory-order-product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Boxes size={21} />}</div><div className="inventory-order-product-info"><strong>{product.name}</strong><span>{product.sku} · คงเหลือ {quantityText(product.stockQuantity)} {product.unit}</span><small><Truck size={12} /> {product.supplierName ?? "ผู้จำหน่ายทั่วไป"}</small></div><span className={`inventory-order-stock-state ${state}`}>{state === "out" ? "หมด" : state === "low" ? "ต่ำ" : "ปกติ"}</span><button className={isHeld ? "inventory-order-remove" : "inventory-order-add"} type="button" onClick={() => toggleProduct(product)}>{isHeld ? <><Check size={14} /> พักแล้ว</> : <><PackagePlus size={14} /> พักรายการ</>}</button></article>; })}</div>}</div>

        <form className="inventory-order-hold-panel" onSubmit={confirmOrder}><div className="inventory-order-hold-header"><div><span>Hold State</span><h2>รายการที่จะสร้าง</h2></div><button type="button" onClick={clearDraft} disabled={!heldItems.length}>ล้างทั้งหมด</button></div><p className="inventory-order-hold-helper">แก้ไขจำนวนได้ตามต้องการ ระบบจะสร้างใบคำสั่งซื้อจริงตอนกดยืนยันเท่านั้น</p>{!heldItems.length && <div className="inventory-order-hold-empty"><PackagePlus size={27} /><strong>ยังไม่มีรายการพักไว้</strong><span>เลือกสินค้าจากฝั่งซ้ายเพื่อเริ่มสร้างใบสั่งซื้อ</span></div>}{heldItems.length > 0 && <div className="inventory-order-held-groups">{supplierGroups.map((group) => <section className="inventory-order-held-group" key={group.key}><div className="inventory-order-held-group-heading"><span><Truck size={14} /> {group.supplierName}</span><small>{group.items.length} รายการ · {quantityText(group.totalQuantity)} หน่วย</small></div>{group.items.map((product) => <div className="inventory-order-held-item" key={product.id}><div><strong>{product.name}</strong><small>{product.unit} · คงเหลือ {quantityText(product.stockQuantity)}</small></div><div className="inventory-order-held-quantity"><input aria-label={`จำนวนสั่ง ${product.name}`} type="number" min="0.001" step="0.001" value={product.quantity} onChange={(event) => updateQuantity(product.id, event.target.value)} /><span>{product.unit}</span><button type="button" aria-label={`ลบ ${product.name}`} onClick={() => toggleProduct(product)}><Trash2 size={14} /></button></div></div>)}</section>)}</div>}
          <label className="inventory-order-create-note"><span>หมายเหตุ</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="เช่น รอบสั่งซื้อประจำสัปดาห์" /></label><div className="inventory-order-create-footer"><span>{supplierGroups.length} ใบจะแยกสร้างตาม Supplier</span><button className="primary-button" type="submit" disabled={saving || !heldItems.length}><Save size={16} /> {saving ? "กำลังสร้าง..." : "ยืนยันสร้างใบสั่งซื้อ"}</button></div>
        </form>
      </div>
    </section>
  </AdminShell>;
}
