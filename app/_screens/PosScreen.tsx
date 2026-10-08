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
  paymentMethod: "cash" | "qr" | "credit";
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
    method: "cash" | "qr" | "credit",
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
      <AdminShell active="pos" contentClassName="pos-page-content">
        <div className="pos-layout">
          <div className="pos-catalog">
            <PageTitle title="เลือกสินค้า" subtitle="แตะสินค้าเพื่อเพิ่มลงในรายการ" />
            <div className="chip-row">
              {["ทั้งหมด", ...categories.map(item => item.name)].map(item => (
                <button
                  className={category === item ? "selected" : ""}
                  onClick={() => setCategory(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>

            {loading && <div className="api-message">กำลังโหลดสินค้า...</div>}
            {error && <div className="api-message error">{error}</div>}

            <div className="product-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
              {visibleProducts.map(product => {
                const isOutOfStock = product.stockQuantity <= 0;
                return (
                  <button
                    className="product-card"
                    disabled={isOutOfStock}
                    key={product.id}
                    onClick={() => changeQuantity(product, 1)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      opacity: isOutOfStock ? 0.6 : 1,
                      backgroundColor: isOutOfStock ? "#f1f5f9" : undefined,
                      cursor: isOutOfStock ? "not-allowed" : "pointer"
                    }}
                  >
                    <div className="product-image" style={{ width: "100%", height: "180px", overflow: "hidden", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img
                        src={product.imageUrl ?? "/products/seasoning.png"}
                        alt={product.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          filter: isOutOfStock ? "grayscale(80%)" : "none",
                          opacity: isOutOfStock ? 0.7 : 1
                        }}
                      />
                    </div>
                    <strong>{product.name}</strong>
                    <span>฿{product.price.toFixed(2)} <small>/{product.unit} · เหลือ {product.stockQuantity}</small></span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="cart-panel">
            <div className="cart-head">
              <div>
                <h2>รายการสินค้า</h2>
                <small>{lastOrderNumber}</small>
              </div>
              <button onClick={() => setCart({})}>ล้างตะกร้า</button>
            </div>

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
