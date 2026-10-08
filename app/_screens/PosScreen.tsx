"use client";

import {
  PanelLeftClose,
  PanelLeftOpen,
  Minus,
  Plus,
  Printer,
  ShoppingCart,
  LayoutGrid,
  Filter,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import PaymentModal from "../_components/PaymentModal";
import ReceiptModal, { ReceiptData } from "../_components/ReceiptModal";
import { apiFetch, errorMessage } from "../_lib/api";

type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  description?: string | null;
  supplierName?: string | null;
  soldQuantity?: number;
  stockQuantity: number;
  barcode?: string | null;
};

type SubCategory = { id: number; name: string };
type Category = { id: number; name: string; slug: string; subCategories?: SubCategory[] };
type CreatedOrder = { 
  orderNumber: string; 
  subtotal: number; 
  discountAmount: number; 
  total: number; 
  amountReceived: number; 
  changeAmount: number; 
  paymentMethod: "cash" | "qr";
  customerName?: string;
};

type ProductSort = "best-selling" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

function packageFacet(product: Product) {
  const source = `${product.name} ${product.description ?? ""}`;
  const match = source.match(/\d+(?:[.,]\d+)?\s?(?:กก\.?|กิโลกรัม|กรัม|มล\.?|มิลลิลิตร|ลิตร|kg|g|ml|l)/iu);
  return match?.[0].replace(/\s+/g, " ").trim() ?? "ไม่ระบุขนาด";
}

function brandFacet(product: Product) {
  const source = `${product.name} ${product.description ?? ""}`;
  const labeled = source.match(/(?:แบรนด์|ยี่ห้อ|brand)\s*[:：]?\s*([^\s,;]+)/iu);
  if (labeled?.[1]) return labeled[1].trim();
  const trademark = source.match(/ตรา\s*([^\s,;]+)/u);
  return trademark?.[1] ? `ตรา${trademark[1].trim()}` : "ไม่ระบุแบรนด์";
}

export default function PosScreen() {
  const [category, setCategory] = useState("ALL");
  const [subCategory, setSubCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<ProductSort>("best-selling");

  // Single Select สำหรับ Dropdowns
  const [selectedBrand, setSelectedBrand] = useState("ALL");
  const [selectedPackage, setSelectedPackage] = useState("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState("รายการใหม่");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // State & Ref สำหรับระบบสแกนบาร์โค้ด
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((item) => String(item.id) === category);

  // 1. กรองสินค้าตามหมวดหมู่หลักและหมวดหมู่ย่อยก่อน
  const categoryFilteredProducts = products.filter((product) => {
    const matchesCategory = category === "ALL" || String(product.categoryId) === category;
    const matchesSubCategory = subCategory === "ALL" || String(product.subCategoryId ?? "") === subCategory;
    return matchesCategory && matchesSubCategory;
  });

  // 2. คำนวณแบรนด์, ขนาดบรรจุ, ผู้จำหน่าย dynamic ตามสินค้าในหมวดหมู่ที่เลือก
  const packageOptions = Array.from(new Set(categoryFilteredProducts.map(packageFacet)))
    .filter(p => p !== "ไม่ระบุขนาด")
    .sort((a, b) => a.localeCompare(b, "th", { numeric: true }));

  const brandOptions = Array.from(new Set(categoryFilteredProducts.map(brandFacet)))
    .filter(b => b !== "ไม่ระบุแบรนด์")
    .sort((a, b) => a.localeCompare(b, "th"));

  const supplierOptions = Array.from(new Set(categoryFilteredProducts.map((product) => product.supplierName?.trim() || "ไม่ระบุผู้จำหน่าย")))
    .filter(s => s !== "ไม่ระบุผู้จำหน่าย")
    .sort((a, b) => a.localeCompare(b, "th"));

  // รวบรวมตัวเลือกที่ถูกเลือกอยู่เพื่อนำมาแสดงเป็น Quick Filter Chips
  const activeSelectedFilters = [
    { type: "brand", value: selectedBrand, clear: () => setSelectedBrand("ALL") },
    { type: "package", value: selectedPackage, clear: () => setSelectedPackage("ALL") },
    { type: "supplier", value: selectedSupplier, clear: () => setSelectedSupplier("ALL") },
  ].filter(f => f.value !== "ALL");

  // สแกนและกรองสินค้าเรียบร้อยแล้ว -> จัดเรียงสินค้า
  const visibleProducts = categoryFilteredProducts.filter((product) => {
    const matchesBrand = selectedBrand === "ALL" || brandFacet(product) === selectedBrand;
    const matchesPackage = selectedPackage === "ALL" || packageFacet(product) === selectedPackage;
    const matchesSupplier = selectedSupplier === "ALL" || (product.supplierName?.trim() || "ไม่ระบุผู้จำหน่าย") === selectedSupplier;
    
    return matchesBrand && matchesPackage && matchesSupplier;
  }).slice().sort((a, b) => {
    // 🟢 1. เช็คสต็อกก่อนเลย: สินค้าหมด (<= 0) ให้ไปอยู่ท้ายสุดเสมอ
    const aOut = a.stockQuantity <= 0;
    const bOut = b.stockQuantity <= 0;
    if (aOut && !bOut) return 1;  // a หมด -> ย้ายไปหลัง
    if (!aOut && bOut) return -1; // b หมด -> b ย้ายไปหลัง

    // 2. ถ้าสต็อกมีทั้งคู่ (หรือหมดทั้งคู่) ค่อยเรียงตามตัวเลือก SortBy
    if (sortBy === "best-selling") {
      const salesDifference = Number(b.soldQuantity ?? 0) - Number(a.soldQuantity ?? 0);
      if (salesDifference !== 0) return salesDifference;
    }
    if (sortBy === "name-asc") return a.name.localeCompare(b.name, "th");
    if (sortBy === "name-desc") return b.name.localeCompare(a.name, "th");
    if (sortBy === "price-asc") return a.price - b.price || a.name.localeCompare(b.name, "th");
    if (sortBy === "price-desc") return b.price - a.price || a.name.localeCompare(b.name, "th");

    return a.name.localeCompare(b.name, "th");
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const total = Object.entries(cart).reduce((sum, [id, quantity]) => sum + (productById.get(Number(id))?.price ?? 0) * quantity, 0);

  const changeQuantity = (product: Product, delta: number) => setCart(current => ({
    ...current,
    [product.id]: Math.min(product.stockQuantity, Math.max(0, (current[product.id] || 0) + delta)),
  }));

  const resetFilters = () => {
    setSelectedBrand("ALL");
    setSelectedPackage("ALL");
    setSelectedSupplier("ALL");
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategory(newCatId);
    setSubCategory("ALL");
    resetFilters();
  };

  const handleSubCategoryChange = (newSubCatId: string) => {
    setSubCategory(newSubCatId);
    resetFilters();
  };

  // ตรวจสอบรหัสทันทีที่มีการเปลี่ยนแปลงในช่องพิมพ์ (ไม่ต้องกด Enter)
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);

    const query = value.trim().toLowerCase();
    if (!query) return;

    const matchedProduct = products.find(
      (p) => p.barcode?.toLowerCase() === query
    );

    if (matchedProduct) {
      if (matchedProduct.stockQuantity > (cart[matchedProduct.id] || 0)) {
        changeQuantity(matchedProduct, 1);
      } else {
        alert(`สินค้า "${matchedProduct.name}" สต็อกไม่พอ`);
      }
      setBarcodeInput(""); // เคลียร์ช่องป้อนข้อมูลทันทีที่เจอ
    }
  };

  // สำรองสำหรับการกด Enter ค้นหาจากชื่อสินค้า
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim().toLowerCase();
    if (!query) return;

    const matchedProduct = products.find(
      (p) => p.barcode?.toLowerCase() === query || p.name.toLowerCase().includes(query)
    );

    if (matchedProduct) {
      if (matchedProduct.stockQuantity > (cart[matchedProduct.id] || 0)) {
        changeQuantity(matchedProduct, 1);
      } else {
        alert(`สินค้า "${matchedProduct.name}" สต็อกไม่พอ`);
      }
    } else {
      alert("ไม่พบสินค้าตามบาร์โค้ดหรือชื่อที่ระบุ");
    }

    setBarcodeInput("");
    barcodeInputRef.current?.focus();
  };

  useEffect(() => {
    Promise.all([apiFetch<Product[]>("/products"), apiFetch<Category[]>("/categories")])
      .then(([productRows, categoryRows]) => {
        setProducts(productRows);
        setCategories(categoryRows);
      })
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  const createOrder = async (
    method: "cash" | "qr", 
    amountReceived: number, 
    customerId: number | null, 
    discountAmount: number,
    customerName?: string // รองรับชื่อลูกค้าจาก PaymentModal
  ) => {
    const receiptItems = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = productById.get(Number(productId));
        return { 
          productName: product?.name ?? "สินค้า", 
          quantity, 
          lineTotal: (product?.price ?? 0) * quantity
        };
      });

    const finalTotal = Math.max(0, total - discountAmount);

    // คำนวณคะแนนสะสม (ทุก 100 บาท = 1 คะแนน เฉพาะบิลนี้ ไม่สะสมเศษ)
    const pointsEarned = customerId ? Math.floor(finalTotal / 100) : 0;

    const order = await apiFetch<CreatedOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: method,
        amountReceived,
        discountAmount,
        customerId,
        pointsEarned, // ส่งคะแนนที่ได้รับไปบันทึกใน DB
        items: Object.entries(cart)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
      }),
    });

    setProducts((current) => current.map((product) => ({
      ...product,
      stockQuantity: product.stockQuantity - (cart[product.id] ?? 0),
    })));

    setLastOrderNumber(order.orderNumber);

    // ส่งข้อมูลครบถ้วนไปยังใบเสร็จ
    setReceipt({ 
      orderNumber: order.orderNumber, 
      createdAt: new Date().toISOString(), 
      items: receiptItems, 
      subtotal: Number(order.subtotal ?? total), 
      discountAmount: Number(order.discountAmount ?? discountAmount), 
      total: Number(order.total ?? finalTotal), 
      paymentMethod: method,
      amountReceived: order.amountReceived, 
      changeAmount: order.changeAmount,
      customerName: customerName || order.customerName || (customerId ? "ลูกค้าสมาชิก" : "ลูกค้าทั่วไป"),
      pointsEarned: pointsEarned
    });

    setCart({});
    setPaymentOpen(false);
  };

  return (
    <>
      <AdminShell active="pos" contentClassName="pos-page-content" shellClassName={sidebarHidden ? "pos-sidebar-hidden" : ""}>
        <div className="pos-workspace">
          <div className="pos-layout">
            
            {/* ---------------- ฝั่งซ้าย: Catalog & Filters ---------------- */}
            <div className="pos-catalog">
              
              {/* Header บนสุด: ชื่อหน้า + ปุ่มขวา */}
              <div className="pos-header">
                <PageTitle
                  title="เลือกสินค้า"
                  subtitle="แตะสินค้าเพื่อเพิ่มลงในรายการ"
                />

                <button 
                  type="button" 
                  className="pos-sidebar-toggle pos-btn-toggle-sidebar"
                  onClick={() => setSidebarHidden((hidden) => !hidden)}
                >
                  {sidebarHidden ? (
                    <>
                      <PanelLeftOpen size={16} />
                      <span>แสดงเมนูด้านซ้าย</span>
                    </>
                  ) : (
                    <>
                      <PanelLeftClose size={16} />
                      <span>ซ่อนเมนูด้านซ้าย</span>
                    </>
                  )}
                </button>
              </div>

              {/* แถบหมวดหมู่หลัก + ดรอปดาวน์เรียงลำดับสินค้า */}
              <div className="pos-category-row">
                
                {/* ฝั่งซ้าย: หมวดหมู่หลัก */}
                <div className="pos-category-scroll">
                  <button 
                    type="button"
                    className={`pos-btn-category ${category === "ALL" ? "selected" : ""}`}
                    onClick={() => handleCategoryChange("ALL")}
                  >
                    <LayoutGrid size={16} />
                    <span>หมวดหมู่ทั้งหมด</span>
                  </button>

                  {categories.map((item) => (
                    <button 
                      type="button"
                      className={`pos-btn-category ${category === String(item.id) ? "selected" : ""}`}
                      onClick={() => handleCategoryChange(String(item.id))} 
                      key={item.id}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>

                {/* ฝั่งขวา: ดรอปดาวน์จัดเรียงสินค้า */}
                <select 
                  value={sortBy} 
                  onChange={(event) => setSortBy(event.target.value as ProductSort)}
                  className="pos-select-sort"
                >
                  <option value="best-selling">สินค้าขายดี</option>
                  <option value="name-asc">ชื่อสินค้า (ก-ฮ)</option>
                  <option value="name-desc">ชื่อสินค้า (ฮ-ก)</option>
                  <option value="price-asc">ราคาสินค้า (ต่ำ-สูง)</option>
                  <option value="price-desc">ราคาสินค้า (สูง-ต่ำ)</option>
                </select>
              </div>

              {/* หมวดหมู่อย่อย (ถ้ามี) */}
              {category !== "ALL" && (selectedCategory?.subCategories?.length ?? 0) > 0 && (
                <div className="pos-subcategory-scroll">
                  {[{ id: "ALL", name: "ทุกหมวดย่อย" }, ...(selectedCategory?.subCategories ?? []).map((item) => ({ id: String(item.id), name: item.name }))].map((item) => (
                    <button
                      type="button"
                      className={`pos-btn-subcategory ${subCategory === item.id ? "selected" : ""}`}
                      onClick={() => handleSubCategoryChange(item.id)}
                      key={item.id}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {/* แถบตัวเลือก Dropdowns Dynamic ตามหมวดหมู่ที่เลือก */}
              <div className="pos-filter-bar">
                
                <div className="pos-filter-group">
                  <div className="pos-filter-label">
                    <Filter size={14} />
                    <span>ตัวเลือก:</span>
                  </div>

                  {/* แบรนด์ */}
                  <select 
                    value={selectedBrand} 
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="pos-filter-select"
                  >
                    <option value="ALL">แบรนด์: ทั้งหมด</option>
                    {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>

                  {/* ขนาดบรรจุ */}
                  <select 
                    value={selectedPackage} 
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="pos-filter-select"
                  >
                    <option value="ALL">ขนาดบรรจุ: ทั้งหมด</option>
                    {packageOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* แสดง Quick Filter Chips */}
                {activeSelectedFilters.length > 0 && (
                  <div className="pos-quick-filter-group">
                    <span className="pos-quick-filter-label">ตัวกรองด่วน:</span>
                    
                    {activeSelectedFilters.map((filter) => (
                      <button
                        key={filter.type}
                        type="button"
                        onClick={filter.clear}
                        className="pos-chip-filter"
                      >
                        <span>{filter.value}</span>
                        <X size={14} style={{ color: "#94a3b8" }} />
                      </button>
                    ))}

                    <button 
                      type="button" 
                      onClick={resetFilters}
                      className="pos-btn-reset-filter"
                    >
                      <RotateCcw size={13} />
                      ล้างตัวกรอง
                    </button>
                  </div>
                )}
              </div>

              {loading && <div className="api-message">กำลังโหลดสินค้า...</div>}
              {error && <div className="api-message error">{error}</div>}

              {/* รายการสินค้า */}
              <div className="product-grid pos-product-grid">
                {visibleProducts.map(product => {
                  const isOutOfStock = product.stockQuantity <= 0;
                  const packageLabel = packageFacet(product);
                  const brandLabel = brandFacet(product);
                  return (
                    <button 
                      className="product-card pos-product-card" 
                      disabled={isOutOfStock} 
                      key={product.id} 
                      onClick={() => changeQuantity(product, 1)}
                    >
                      <div className="product-image pos-product-image-wrap">
                        <img 
                          src={product.imageUrl ?? "/products/seasoning.png"} 
                          alt={product.name} 
                        />
                      </div>
                      <strong className="pos-product-name">{product.name}</strong>
                      {(brandLabel !== "ไม่ระบุแบรนด์" || packageLabel !== "ไม่ระบุขนาด") && <small className="pos-product-meta">{[brandLabel !== "ไม่ระบุแบรนด์" ? brandLabel : "", packageLabel !== "ไม่ระบุขนาด" ? packageLabel : ""].filter(Boolean).join(" · ")}</small>}
                      <span className="pos-product-price-info">฿{product.price.toFixed(2)} <small>/{product.unit} · เหลือ {product.stockQuantity}</small></span>
                    </button>
                  );
                })}
              </div>
              {!loading && !error && visibleProducts.length === 0 && <div className="pos-empty-products">ไม่พบสินค้าที่ตรงกับตัวกรองที่เลือก</div>}
            </div>

            {/* ---------------- ฝั่งขวา: ตะกร้าสินค้า + ช่องสแกนบาร์โค้ด ---------------- */}
            <aside className="cart-panel">
              <div className="cart-head">
                <div>
                  <h2>รายการสินค้า</h2>
                  <small>{lastOrderNumber}</small>
                </div>
                <button onClick={() => setCart({})}>ล้างตะกร้า</button>
              </div>

              {/* ช่องยิงบาร์โค้ด (แมตช์รหัสปุ๊บขึ้นปั๊บ ไม่ต้อง Enter) */}
              <form onSubmit={handleBarcodeSubmit} className="cart-barcode-scanner">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="สแกนบาร์โค้ด / ยิงรหัสสินค้า..."
                  value={barcodeInput}
                  onChange={handleBarcodeChange}
                  autoFocus
                />
              </form>

              <div className="cart-list">
                {Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => {
                  const product = productById.get(Number(key));
                  if (!product) return null;
                  return (
                    <div className="cart-item" key={key}>
                      <div>
                        <strong>{product.name}</strong>
                        <small>฿{product.price}/{product.unit}</small>
                      </div>
                      <div className="qty">
                        <button onClick={() => changeQuantity(product, -1)}><Minus size={13} /></button>
                        <span>{quantity}</span>
                        <button onClick={() => changeQuantity(product, 1)}><Plus size={13} /></button>
                      </div>
                      <b>฿{(product.price * quantity).toFixed(2)}</b>
                    </div>
                  );
                })}
                {total === 0 && (
                  <div className="empty-state">
                    <ShoppingCart />
                    <p>ยังไม่มีสินค้าในตะกร้า</p>
                  </div>
                )}
              </div>

              <div className="cart-total">
                <span>ยอดสุทธิ:</span>
                <strong>฿{total.toFixed(2)}</strong>
                <button disabled={!total} onClick={() => setPaymentOpen(true)}>
                  <Printer size={20} /> ชำระเงิน
                </button>
              </div>
            </aside>
          </div>
        </div>
      </AdminShell>

      {paymentOpen && (
        <PaymentModal 
          orderNumber="ระบบจะสร้างเลขบิลอัตโนมัติ" 
          total={total} 
          onClose={() => setPaymentOpen(false)} 
          onConfirm={createOrder} 
        />
      )}

      {receipt && (
        <ReceiptModal 
          receipt={receipt} 
          success
          onClose={() => setReceipt(null)} 
        />
      )}
    </>
  );
}