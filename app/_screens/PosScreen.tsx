"use client";

import { Minus, Plus, Printer, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
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
  categoryName: string;
  stockQuantity: number;
};

type Category = { id: number; name: string; slug: string };
type CreatedOrder = { orderNumber: string; total: number; amountReceived: number; changeAmount: number; paymentMethod: "cash" | "qr" };

export default function PosScreen() {
  const [category, setCategory] = useState("ทั้งหมด");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState("รายการใหม่");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const visibleProducts = category === "ทั้งหมด" ? products : products.filter(product => product.categoryName === category);
  const productById = new Map(products.map((product) => [product.id, product]));
  const total = Object.entries(cart).reduce((sum, [id, quantity]) => sum + (productById.get(Number(id))?.price ?? 0) * quantity, 0);
  const changeQuantity = (product: Product, delta: number) => setCart(current => ({
    ...current,
    [product.id]: Math.min(product.stockQuantity, Math.max(0, (current[product.id] || 0) + delta)),
  }));

  useEffect(() => {
    Promise.all([apiFetch<Product[]>("/products"), apiFetch<Category[]>("/categories")])
      .then(([productRows, categoryRows]) => {
        setProducts(productRows);
        setCategories(categoryRows);
      })
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  const createOrder = async (method: "cash" | "qr", amountReceived: number) => {
    const receiptItems = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => {
      const product = productById.get(Number(productId));
      return { productName: product?.name ?? "สินค้า", quantity, lineTotal: (product?.price ?? 0) * quantity };
    });
    const order = await apiFetch<CreatedOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: method,
        amountReceived,
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
    setReceipt({ orderNumber: order.orderNumber, createdAt: new Date().toISOString(), items: receiptItems, subtotal: order.total, total: order.total, paymentMethod: order.paymentMethod, amountReceived: order.amountReceived, changeAmount: order.changeAmount });
    setCart({});
    setPaymentOpen(false);
  };

  return <><AdminShell active="pos" contentClassName="pos-page-content">
    <div className="pos-layout">
      <div className="pos-catalog">
        <PageTitle title="เลือกสินค้า" subtitle="แตะสินค้าเพื่อเพิ่มลงในรายการ" />
        <div className="chip-row">{["ทั้งหมด", ...categories.map(item => item.name)].map(item => <button className={category === item ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
        {loading && <div className="api-message">กำลังโหลดสินค้า...</div>}
        {error && <div className="api-message error">{error}</div>}
        <div className="product-grid">{visibleProducts.map(product => <button className="product-card" disabled={product.stockQuantity <= 0} key={product.id} onClick={() => changeQuantity(product, 1)}>
          <div className="product-image"><img src={product.imageUrl ?? "/products/seasoning.png"} alt={product.name} /></div>
          <strong>{product.name}</strong><span>฿{product.price.toFixed(2)} <small>/{product.unit} · เหลือ {product.stockQuantity}</small></span>
        </button>)}</div>
      </div>
      <aside className="cart-panel">
        <div className="cart-head"><div><h2>รายการสินค้า</h2><small>{lastOrderNumber}</small></div><button onClick={() => setCart({})}>ล้างตะกร้า</button></div>
        <div className="cart-list">{Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => {
          const product = productById.get(Number(key));
          if (!product) return null;
          return <div className="cart-item" key={key}><div><strong>{product.name}</strong><small>฿{product.price}/{product.unit}</small></div><div className="qty"><button onClick={() => changeQuantity(product, -1)}><Minus size={13} /></button><span>{quantity}</span><button onClick={() => changeQuantity(product, 1)}><Plus size={13} /></button></div><b>฿{(product.price * quantity).toFixed(2)}</b></div>;
        })}{total === 0 && <div className="empty-state"><ShoppingCart /><p>ยังไม่มีสินค้าในตะกร้า</p></div>}</div>
        <div className="cart-total"><span>ยอดสุทธิ:</span><strong>฿{total.toFixed(2)}</strong><button disabled={!total} onClick={() => setPaymentOpen(true)}><Printer size={20} /> ชำระเงิน</button></div>
      </aside>
    </div>
  </AdminShell>
  {paymentOpen && <PaymentModal orderNumber="ระบบจะสร้างเลขบิลอัตโนมัติ" total={total} onClose={() => setPaymentOpen(false)} onConfirm={createOrder} />}
  {receipt && <ReceiptModal receipt={receipt} success onClose={() => setReceipt(null)} />}
  </>;
}
