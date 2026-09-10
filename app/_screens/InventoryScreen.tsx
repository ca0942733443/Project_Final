"use client";

import { PackageCheck, Plus, X, Image as ImageIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";
import Link from "next/link";

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  price: number;
  stockValue: number;
  status: "out" | "low" | "normal";
  expiryDate?: string | Date | null;
  imageUrl?: string | null; 
};

type InventoryData = {
  items: InventoryItem[];
  stats: { totalStockValue: number; productCount: number; lowStockCount: number; outOfStockCount: number };
};

type InventoryMovement = {
  id: number;
  productName: string;
  movementType: "opening" | "purchase" | "adjustment" | "return" | "sale";
  quantity: number;
  note: string | null;
  createdAt: string;
};

export default function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("expiryAsc");
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (status) queryParams.append("status", status);
      if (sortBy) queryParams.append("sortBy", sortBy);

      const [inventoryData, movementRows] = await Promise.all([
        apiFetch<InventoryData>(`/inventory?${queryParams.toString()}`),
        apiFetch<InventoryMovement[]>("/inventory/movements?limit=2"),
      ]);
      setData(inventoryData);
      setMovements(movementRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [search, status, sortBy]);

  useEffect(() => { void loadInventory(); }, [loadInventory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, sortBy]);

  const filteredItems = (data?.items ?? []).filter((item) => {
    if (!search.trim()) return true;
    const keyword = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.sku.toLowerCase().includes(keyword) ||
      item.categoryName.toLowerCase().includes(keyword)
    );
  });

  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const receiveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(form.get("productId")),
          movementType: "purchase",
          quantity: Number(form.get("quantity")),
          unitCost: Number(form.get("unitCost") || 0),
          supplierId: form.get("supplierId") ? Number(form.get("supplierId")) : null,
          note: form.get("note"),
        }),
      });
      setShowReceive(false);
      await loadInventory();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = data?.items.find((item) => item.id === (selectedProductId ?? data?.items[0]?.id));
  const stats = data?.stats;

  return (
    <AdminShell active="inventory">
      <PageTitle 
        title="การจัดการคลังสินค้า" 
        subtitle="ตรวจสอบและจัดการสต็อกจากฐานข้อมูลจริง" 
        action={
          <button className="primary-button" onClick={() => setShowReceive(true)}>
            <PackageCheck size={17} /> รับสินค้าเข้า
          </button>
        } 
      />

      <div className="stat-grid four">
        <Stat label="มูลค่าสินค้าในคลังทั้งหมด" value={`฿${(stats?.totalStockValue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} />
        <Stat label="จำนวนรายการสินค้า" value={`${stats?.productCount ?? 0} รายการ`} tone="neutral" />
        <Stat label="สินค้าสต็อกต่ำ" value={`${stats?.lowStockCount ?? 0} รายการ`} tone="orange" note="ควรตรวจสอบสต็อก" />
        <Stat label="สินค้าหมด" value={`${stats?.outOfStockCount ?? 0} รายการ`} tone="red" />
      </div>

      <section className="data-card inventory-stock-card">
        <div className="table-tools" style={{ display: "flex", gap: "12px", alignItems: "center", width: "100%" }}>
          <input
            type="text" 
            placeholder="ค้นหาชื่อสินค้า..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{
              height: "40px",
              fontSize: "13px",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              minWidth: "220px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />

          <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              style={{
                height: "40px",
                fontSize: "13px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                backgroundColor: "#fff",
                cursor: "pointer",
                boxSizing: "border-box"
              }}
            >
              <option value="">สถานะ: ทั้งหมด</option>
              <option value="normal">สถานะ: ปกติ</option>
              <option value="low">สถานะ: สต็อกต่ำ</option>
              <option value="out">สถานะ: สินค้าหมด</option>
            </select>

            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                height: "40px",
                fontSize: "13px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                outline: "none",
                backgroundColor: "#fff",
                cursor: "pointer",
                boxSizing: "border-box"
              }}
            >
              <option value="expiryAsc">เรียงตาม: วันหมดอายุเร็วที่สุด</option>
              <option value="stockDesc">เรียงตาม: สต็อกคลังมากที่สุด</option>
              <option value="stockAsc">เรียงตาม: สต็อกคลังน้อยที่สุด</option>
            </select>
          </div>
        </div>

        {loading && <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>}
        {error && <div className="api-message error">{error}</div>}

        <div className="inventory-table">
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["สินค้า", "SKU", "หมวดหมู่", "วันหมดอายุ", "ราคาขาย", "คงเหลือ", "สถานะ", "จัดการ"].map((title) => (
                    <th
                      key={title}
                      style={{
                        padding: "10px 16px",
                        fontSize: "13px",
                        fontWeight: "400",
                        color: "#475569",
                        borderBottom: "1px solid #e2e8f0",
                        textAlign: "center",
                      }}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const itemImg = item.imageUrl;

                  let statusText = "ปกติ";
                  let statusStyle: React.CSSProperties = {
                    backgroundColor: "#e6f4ea",
                    color: "#137333",
                    border: "1px solid #a8dab5",
                  };

                  if (item.stockQuantity <= 0) {
                    statusText = "สินค้าหมด";
                    statusStyle = {
                      backgroundColor: "#fce8e6",
                      color: "#c5221f",
                      border: "1px solid #f5c2c7",
                    };
                  } else if (item.stockQuantity <= (item.lowStockThreshold || 5)) {
                    statusText = "สต็อกต่ำ";
                    statusStyle = {
                      backgroundColor: "#fef7e0",
                      color: "#b06000",
                      border: "1px solid #fde293",
                    };
                  }

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      {/* 1. สินค้า (ดึง imageUrl + Fallback แสดงตัวอักษรแรกสไตล์ Customer) */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "12px",
                                objectFit: "cover",
                                border: "1px solid #e2e8f0",
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "12px",
                                backgroundColor: "#e6f4ea",
                                color: "#046c4e",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "18px",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                flexShrink: 0
                              }}
                            >
                              {item.name ? item.name.charAt(0) : "-"}
                            </div>
                          )}
                          <div>
                            <span style={{ display: "block", color: "#0f172a", fontSize: "14px", fontWeight: "normal" }}>
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. SKU */}
                      <td style={{ padding: "12px 16px", color: "#475569", fontSize: "14px", fontWeight: "normal", textAlign: "center" }}>
                        {item.sku || "-"}
                      </td>

                      {/* 3. หมวดหมู่ */}
                      <td style={{ padding: "12px 16px", color: "#475569", fontSize: "14px", fontWeight: "normal", textAlign: "center" }}>
                        {item.categoryName}
                      </td>

                      {/* 4. วันหมดอายุ */}
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "14px", fontWeight: "normal", textAlign: "center" }}>
                        {item.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString("th-TH", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            })
                          : "—"}
                      </td>

                      {/* 5. ราคาขาย */}
                      <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: "13px", fontWeight: "normal", textAlign: "center" }}>
                        ฿{item.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>

                      {/* 6. คงเหลือ */}
                      <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: "13px", fontWeight: "normal", textAlign: "center" }}>
                        {item.stockQuantity.toLocaleString("th-TH")} {item.unit}
                      </td>

                      {/* 7. สถานะ */}
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "normal",
                            lineHeight: "1.4",
                            ...statusStyle,
                          }}
                        >
                          {statusText}
                        </span>
                      </td>

                      {/* 8. จัดการ */}
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                          <button
                            className="tiny-button"
                            onClick={() => {
                              setSelectedProductId(item.id);
                              setShowReceive(true);
                            }}
                            style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                            type="button"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination UI */}
          <div 
            className="pagination" 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "12px 16px" 
            }}
          >
            <span style={{ fontSize: "12px", color: "#64748b", padding: "10px"}}>
              แสดง {filteredItems.length ? startIndex + 1 : 0} ถึง {Math.min(startIndex + itemsPerPage, filteredItems.length)} จาก {filteredItems.length} รายการ
            </span>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                aria-label="หน้าก่อนหน้า"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                style={{
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  border: "1.5px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: currentPage === 1 ? "#cbd5e1" : "#475569",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontSize: "18px",
                  fontWeight: "bold"
                }}
              >
                ‹
              </button>

              <span 
                style={{ 
                  fontSize: "14px", 
                  fontWeight: "700", 
                  color: "#064e3b", 
                  padding: "0 4px",
                  userSelect: "none"
                }}
              >
                {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                aria-label="หน้าถัดไป"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                style={{
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  border: "1.5px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: currentPage >= totalPages ? "#cbd5e1" : "#475569",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: "18px",
                  fontWeight: "bold"
                }}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบสินค้าในสถานะที่เลือก</div>}
      </section>

      {/* ประวัติการเคลื่อนย้ายสินค้า */}
      <section className="inventory-movement-card">
        <h2>ประวัติการเคลื่อนย้ายสินค้าล่าสุด</h2>
        <div className="movement-list">
          {movements.map((movement, index) => (
            <article className={`movement-item movement-${index % 2}`} key={movement.id}>
              <span className="movement-icon">⇥</span>
              <div>
                <strong>
                  {movement.movementType === "purchase" ? "รับเข้าคลัง" : movement.movementType === "sale" ? "ขายออกหน้าร้าน" : "ย้ายไปหน้าร้าน"}: {movement.productName}
                </strong>
                <small>{movement.note ?? `อัปเดตเมื่อ ${new Date(movement.createdAt).toLocaleString("th-TH")}`}</small>
              </div>
              <b className={movement.quantity < 0 ? "danger-text" : ""}>
                {movement.quantity > 0 ? "+" : ""}{movement.quantity.toLocaleString("th-TH")} หน่วย
              </b>
            </article>
          ))}
        </div>
        <Link
          href="/inven-history"
          className="movement-link"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            marginTop: "16px",
            marginLeft: "auto",
            marginRight: "auto",
            width: "fit-content"
          }}
        >
          ดูประวัติทั้งหมด
        </Link>
      </section>

      {/* Modal รับสินค้าเข้า */}
      {showReceive && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={receiveStock}>
            <button type="button" className="modal-close" onClick={() => setShowReceive(false)}>
              <X />
            </button>
            <h2>รับสินค้าเข้า</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                สินค้า
              </label>
              <select 
                name="productId" 
                required 
                value={selectedProductId ?? data?.items[0]?.id ?? ""}
                onChange={(e) => setSelectedProductId(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: "42px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              >
                {data?.items.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "12px 16px",
                margin: "16px 0",
                fontSize: "14px",
                color: "#475569"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>หมวดหมู่: <strong>{selectedProduct.categoryName}</strong></span>
                  <span>หน่วยนับ: <strong>{selectedProduct.unit}</strong></span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>สต็อกปัจจุบัน: <strong style={{ color: "#0284c7" }}>{selectedProduct.stockQuantity.toLocaleString()} {selectedProduct.unit}</strong></span>
                  <span>ราคาขาย/หน่วย: <strong>฿{selectedProduct.price.toLocaleString()}</strong></span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                จำนวนรับเข้า
              </label>
              <input 
                name="quantity" 
                type="number" 
                min="0.001" 
                step="0.001" 
                placeholder="ระบุจำนวน" 
                required 
                style={{
                  width: "100%",
                  height: "42px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <input type="hidden" name="unitCost" value="0" />
            
            <button className="primary-button" disabled={saving} type="submit" style={{ marginTop: "24px", width: "100%" }}>
              {saving ? "กำลังบันทึก..." : "บันทึกรับเข้า"}
            </button>
          </form>
        </div>
      )}
    </AdminShell>
  );
}