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
type CreateInventoryOrdersResult = {
  id: number | null;
  ids: number[];
  count: number;
};

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
      const result = await apiFetch<CreateInventoryOrdersResult>("/inventory-orders", {
        method: "POST",
        body: JSON.stringify({
          note: note.trim() || "สร้างจากรายการแนะนำการสั่งซื้อ",
          splitBySupplier: true,
          items: heldItems.map((product) => ({ productId: product.id, quantity: product.quantity })),
        }),
      });
      const orderIds = result.ids.filter((id) => Number.isInteger(id) && id > 0);
      if (orderIds.length === 0 || orderIds.length !== result.count) {
        throw new Error("ระบบสร้างใบสั่งซื้อไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง");
      }
      setHeldOrderQuantities({});
      router.replace(`/purchase-order?ids=${orderIds.join(",")}`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return <>
    <AdminShell active="inventory-orders" contentClassName="inventory-order-create-page">
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

        <form className="inventory-order-hold-panel" onSubmit={confirmOrder}><div className="inventory-order-hold-header"><div><span>Hold State</span><h2>รายการที่จะสร้าง</h2></div><button type="button" onClick={clearDraft} disabled={!heldItems.length}>ล้างทั้งหมด</button></div><p className="inventory-order-hold-helper">แก้ไขจำนวนได้ตามต้องการ ระบบจะสร้างใบคำสั่งซื้อจริงตอนกดยืนยันเท่านั้น</p>{!heldItems.length && <div className="inventory-order-hold-empty"><PackagePlus size={27} /><strong>ยังไม่มีรายการพักไว้</strong><span>เลือกสินค้าจากฝั่งซ้ายเพื่อเริ่มสร้างใบสั่งซื้อ</span></div>}{heldItems.length > 0 && <div className="inventory-order-held-groups">{supplierGroups.map((group) => <section className="inventory-order-held-group" key={group.key}><div className="inventory-order-held-group-heading"><span><Truck size={14} /> {group.supplierName}</span><small>{group.items.length} รายการ · {quantityText(group.totalQuantity)} หน่วย</small></div>{group.items.map((product) => <div className="inventory-order-held-item" key={product.id}><div><strong>{product.name}</strong><small>{product.unit} · คงเหลือ {quantityText(product.stockQuantity)}</small></div><div className="inventory-order-held-quantity"><input aria-label={`จำนวนสั่ง ${product.name}`} type="number" min="0.001" step="0.001" value={product.quantity} onChange={(event) => updateQuantity(product.id, event.target.value)} /><span title={product.unit}>{product.unit}</span><button type="button" aria-label={`ลบ ${product.name}`} onClick={() => toggleProduct(product)}><Trash2 size={14} /></button></div></div>)}</section>)}</div>}
          <label className="inventory-order-create-note"><span>หมายเหตุ</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="เช่น รอบสั่งซื้อประจำสัปดาห์" /></label><div className="inventory-order-create-footer"><span>{supplierGroups.length} ใบจะแยกสร้างตาม Supplier</span><button className="primary-button" type="submit" disabled={saving || !heldItems.length}><Save size={16} /> {saving ? "กำลังสร้าง..." : "ยืนยันสร้างใบสั่งซื้อ"}</button></div>
        </form>
      </div>
    </section>
    </AdminShell>
    <style jsx global>{`
      .inventory-order-create-page { max-width: 1440px; padding: 30px 40px 56px; }
      .inventory-order-create-page-shell { margin-top: 20px; }
      .inventory-order-create-page-toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) 180px 180px; gap: 12px; padding: 16px; border: 1px solid var(--border); border-bottom: 0; border-radius: 12px 12px 0 0; background: #f4f7ff; }
      .inventory-order-create-search { min-width: 0; height: 42px; padding: 0 12px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 7px; color: var(--muted); background: #fff; }
      .inventory-order-create-search input { min-width: 0; width: 100%; height: 100%; border: 0; outline: 0; color: var(--ink); background: transparent; }
      .inventory-order-create-page-toolbar select { min-width: 0; height: 42px; padding: 0 10px; border: 1px solid var(--border); border-radius: 7px; color: var(--ink); background: #fff; }
      .inventory-order-create-page-layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(330px, .75fr); gap: 20px; padding: 20px; border: 1px solid var(--border); border-radius: 0 0 12px 12px; background: #fff; }
      .inventory-order-product-picker, .inventory-order-hold-panel { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: #fff; box-shadow: 0 2px 8px rgba(19, 42, 30, .04); }
      .inventory-order-create-heading, .inventory-order-hold-header { min-height: 82px; padding: 17px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); }
      .inventory-order-create-heading h2, .inventory-order-hold-header h2 { margin: 0; color: var(--ink); font-size: 17px; }
      .inventory-order-create-heading p, .inventory-order-hold-header span { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
      .inventory-order-create-heading > span { flex: 0 0 auto; padding: 6px 10px; border-radius: 99px; color: var(--green); background: #e9f7ef; font-size: 11px; font-weight: 700; }
      .inventory-order-product-list { display: grid; }
      .inventory-order-product-row { min-height: 82px; padding: 12px 14px; display: grid; grid-template-columns: 42px minmax(0, 1fr) auto auto; align-items: center; gap: 11px; border-bottom: 1px solid #edf1ee; }
      .inventory-order-product-row:last-child { border-bottom: 0; }
      .inventory-order-product-row.held { background: #f5fbf7; }
      .inventory-order-product-thumb { width: 42px; height: 42px; overflow: hidden; display: grid; place-items: center; border-radius: 8px; color: var(--green); background: #e7f4ec; }
      .inventory-order-product-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .inventory-order-product-info { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .inventory-order-product-info strong { overflow: hidden; color: var(--ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
      .inventory-order-product-info > span, .inventory-order-product-info small { overflow: hidden; display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
      .inventory-order-stock-state { min-width: 42px; padding: 5px 7px; border-radius: 99px; font-size: 10px; font-weight: 700; text-align: center; }
      .inventory-order-stock-state.normal { color: #087a57; background: #daf5e9; }
      .inventory-order-stock-state.low { color: #a36200; background: #fff0ca; }
      .inventory-order-stock-state.out { color: #b83d43; background: #ffe5e5; }
      .inventory-order-add, .inventory-order-remove { min-height: 33px; padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .inventory-order-add { border: 1px solid var(--green); color: #fff; background: var(--green); }
      .inventory-order-remove { border: 1px solid #b9d8c5; color: var(--green); background: #fff; }
      .inventory-order-hold-panel { display: flex; flex-direction: column; }
      .inventory-order-hold-header { min-height: 82px; background: #fbfdfc; }
      .inventory-order-hold-header > button { min-height: 31px; padding: 0 9px; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); background: #fff; font-size: 10px; cursor: pointer; }
      .inventory-order-hold-header > button:disabled { cursor: not-allowed; opacity: .5; }
      .inventory-order-hold-helper { margin: 14px; padding: 10px 11px; border-radius: 7px; color: #466258; background: #edf8f2; font-size: 11px; line-height: 1.5; }
      .inventory-order-hold-empty, .inventory-order-create-empty { min-height: 190px; padding: 24px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--muted); text-align: center; font-size: 11px; }
      .inventory-order-hold-empty svg, .inventory-order-create-empty svg { color: #a8c0b0; }
      .inventory-order-hold-empty strong { color: var(--ink); font-size: 13px; }
      .inventory-order-held-groups { display: grid; gap: 12px; padding: 0 14px 14px; }
      .inventory-order-held-group { overflow: hidden; border: 1px solid var(--border); border-radius: 8px; }
      .inventory-order-held-group-heading { min-height: 40px; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--green); background: #f2faf5; font-size: 10px; font-weight: 700; }
      .inventory-order-held-group-heading > span { display: flex; align-items: center; gap: 5px; }
      .inventory-order-held-group-heading small { color: var(--muted); font-weight: 500; }
      .inventory-order-held-item { min-height: 58px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #edf1ee; }
      .inventory-order-held-item > div:first-child { min-width: 0; }
      .inventory-order-held-item strong, .inventory-order-held-item small { overflow: hidden; display: block; text-overflow: ellipsis; white-space: nowrap; }
      .inventory-order-held-item strong { color: var(--ink); font-size: 11px; }
      .inventory-order-held-item small { margin-top: 3px; color: var(--muted); font-size: 10px; }
      .inventory-order-held-quantity { width: 173px; display: grid; grid-template-columns: 68px 64px 29px; align-items: center; gap: 6px; flex: 0 0 173px; }
      .inventory-order-held-quantity input { width: 100%; height: 31px; padding: 0 7px; border: 1px solid var(--border); border-radius: 6px; color: var(--ink); font-size: 11px; text-align: right; box-sizing: border-box; }
      .inventory-order-held-quantity > span { width: 100%; overflow: hidden; justify-self: end; color: var(--muted); font-size: 10px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
      .inventory-order-held-quantity button { width: 29px; height: 29px; display: grid; place-items: center; border: 1px solid #efbdbd; border-radius: 6px; color: #b83d43; background: #fff; cursor: pointer; }
      .inventory-order-create-note { margin: 0 14px 14px; display: grid; gap: 7px; color: var(--muted); font-size: 10px; font-weight: 700; }
      .inventory-order-create-note textarea { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 7px; color: var(--ink); background: #fff; font: inherit; font-size: 11px; resize: vertical; box-sizing: border-box; }
      .inventory-order-create-footer { min-height: 68px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--border); background: #f7f9ff; }
      .inventory-order-create-footer > span { color: var(--muted); font-size: 10px; }
      .inventory-order-create-footer .primary-button { min-height: 38px; padding: 0 13px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
      @media (max-width: 1020px) { .inventory-order-create-page-layout { grid-template-columns: 1fr; } }
      @media (max-width: 720px) { .inventory-order-create-page { padding: 22px 16px 42px; }.inventory-order-create-page-toolbar { grid-template-columns: 1fr; }.inventory-order-product-row { grid-template-columns: 40px minmax(0, 1fr) auto; }.inventory-order-product-row > button { grid-column: 2 / -1; justify-self: start; }.inventory-order-create-footer { align-items: flex-start; flex-direction: column; }.inventory-order-create-footer .primary-button { width: 100%; } }
    `}</style>
  </>;
}
