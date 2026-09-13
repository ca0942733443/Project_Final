"use client";

import { Download, PackageCheck, Plus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  imageUrl: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  price: number;
  stockValue: number;
  status: "out" | "low" | "normal";
  lotNo: string | null;
  expiryDate: string | null;
  updatedAt?: string;
};

type InventoryData = {
  items: InventoryItem[];
  stats: { totalStockValue: number; productCount: number; lowStockCount: number; outOfStockCount: number };
};

function formatExpiryDate(value: string | null) {
  if (!value) return "ไม่ระบุ";
  return new Date(value).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("expiryAsc");
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [saving, setSaving] = useState(false);
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

      const inventoryData = await apiFetch<InventoryData>(`/inventory?${queryParams.toString()}`);
      setData(inventoryData);
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
  const exportCsv = () => {
    if (!data) return;
    const rows = [["SKU", "สินค้า", "หมวดหมู่", "คงเหลือ", "หน่วย", "มูลค่า"], ...data.items.map((item) => [item.sku, item.name, item.categoryName, item.stockQuantity, item.unit, item.stockValue])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "inventory.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const [showExportModal, setShowExportModal] = useState(false);
  const exportWord = () => {
    if (!data) return;

    const tableHeader = `
      <tr style="background-color: #f1f5f9; font-weight: bold;">
        <th style="border: 1px solid #cbd5e1; padding: 8px;">SKU</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">สินค้า</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">หมวดหมู่</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">วันหมดอายุ</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">ราคาขาย</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">คงเหลือ</th>
        <th style="border: 1px solid #cbd5e1; padding: 8px;">สถานะ</th>
      </tr>
    `;

    const tableRows = data.items.map((item) => {
      const statusText = item.status === "out" ? "สินค้าหมด" : item.status === "low" ? "สต็อกต่ำ" : "ปกติ";
      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.sku || "—"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.categoryName}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${formatExpiryDate(item.expiryDate)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">฿${item.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.stockQuantity.toLocaleString("th-TH")} ${item.unit}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${statusText}</td>
        </tr>
      `;
    }).join("");

    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>รายงานคลังสินค้า</title>
        <style>
          body { font-family: 'Sarabun', 'Tahoma', sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          h2 { color: #0f172a; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <h2>รายงานข้อมูลคลังสินค้า</h2>
        <p style="color: #64748b; font-size: 14px;">วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}</p>
        <table>
          <thead>${tableHeader}</thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", wordContent], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "รายงานคลังสินค้า.doc";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  
  return (<AdminShell active="inventory">
    <PageTitle title="การจัดการคลังสินค้า" subtitle="ตรวจสอบและจัดการสต็อกจากฐานข้อมูลจริง" action={<button className="primary-button" onClick={() => setShowReceive(true)}><PackageCheck size={17} /> รับสินค้าเข้า</button>} />
    <div className="stat-grid four"><Stat label="มูลค่าสินค้าในคลังทั้งหมด" value={`฿${(stats?.totalStockValue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} /><Stat label="จำนวนรายการสินค้า" value={`${stats?.productCount ?? 0} รายการ`} tone="neutral" /><Stat label="สินค้าสต็อกต่ำ" value={`${stats?.lowStockCount ?? 0}`} tone="orange" note="ควรเติมสินค้าทันที" /><Stat label="สินค้าหมด" value={`${stats?.outOfStockCount ?? 0}`} tone="red" /></div>
    <section className="data-card inventory-stock-card">
      <div className="inventory-toolbar">
        <label className="inventory-search">
          <span className="sr-only">ค้นหาสินค้า</span>
          <input type="search" placeholder="ค้นหาชื่อสินค้า หรือ SKU..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="inventory-toolbar-actions">
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="กรองตามสถานะ">
              <option value="">สถานะ: ทั้งหมด</option>
              <option value="normal">สถานะ: ปกติ</option>
              <option value="low">สถานะ: สต็อกต่ำ</option>
              <option value="out">สถานะ: สินค้าหมด</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="เรียงลำดับสินค้า">
              <option value="expiryAsc">เรียงตาม: วันหมดอายุเร็วที่สุด</option>
              <option value="stockDesc">เรียงตาม: สต็อกคลังมากที่สุด</option>
              <option value="stockAsc">เรียงตาม: สต็อกคลังน้อยที่สุด</option>
          </select>
          {/* <button type="button" className="inventory-export" onClick={exportCsv}><Download size={16} /> ส่งออก</button> */}
          <button type="button" className="inventory-export" onClick={() => setShowExportModal(true)}> <Download size={16} /> ส่งออก </button>
        </div>
      </div>

      {loading && <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>}
      {error && <div className="api-message error">{error}</div>}

      <div className="inventory-table inventory-table-single">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{["สินค้า", "SKU", "หมวดหมู่", "วันหมดอายุ", "ราคาขาย", "คงเหลือ", "สถานะ", "จัดการ"].map((title) => <th key={title}>{title}</th>)}</tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const statusClass = item.status === "out" ? "out" : item.status === "low" ? "low" : "normal";

                  return (
                    <tr key={item.id}>
                      <td className="inventory-product-cell">
                        <div className="inventory-product">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} />
                          ) : (
                            <span className="inventory-product-fallback">{item.name ? item.name.charAt(0) : "-"}</span>
                          )}
                          <strong>{item.name}</strong>
                        </div>
                      </td>
                      <td><code className="inventory-sku">{item.sku || "—"}</code></td>
                      <td>{item.categoryName}</td>
                      <td>{formatExpiryDate(item.expiryDate)}</td>
                      <td className="inventory-price">฿{item.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                      <td className="inventory-quantity">{item.stockQuantity.toLocaleString("th-TH")} <small>{item.unit}</small></td>
                      <td><span className={`inventory-status ${statusClass}`}>{item.status === "out" ? "สินค้าหมด" : item.status === "low" ? "สต็อกต่ำ" : "ปกติ"}</span></td>
                      <td>
                        <div className="inventory-row-actions">
                          <button
                            className="tiny-button inventory-receive-button"
                            onClick={() => {
                              setSelectedProductId(item.id);
                              setShowReceive(true);
                            }}
                            type="button"
                            aria-label={`รับสินค้า ${item.name}`}
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

          <div className="pagination inventory-pagination">
            <span>
              แสดง {filteredItems.length ? startIndex + 1 : 0} ถึง {Math.min(startIndex + itemsPerPage, filteredItems.length)} จาก {filteredItems.length} รายการ
            </span>
            <div>
              <button
                type="button"
                aria-label="หน้าก่อนหน้า"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              >
                ‹
              </button>
              <span className="inventory-page-indicator">{currentPage} / {totalPages}</span>
              <button
                type="button"
                aria-label="หน้าถัดไป"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              >
                ›
              </button>
            </div>
          </div>
        </div>

      {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบสินค้าในสถานะที่เลือก</div>}
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

      {/* 🟢 Modal สำหรับเลือกประเภทการส่งออก */}
      {showExportModal && (
        <div className="modal-backdrop" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", textAlign: "center" }}>
            <button type="button" className="modal-close" onClick={() => setShowExportModal(false)}>
              <X />
            </button>
            
            <h2 style={{ marginBottom: "8px", fontSize: "18px" }}>ส่งออกรายงานคลังสินค้า</h2>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
              เลือกรูปแบบไฟล์ที่ต้องการดาวน์โหลด
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* ตัวเลือกที่ 1: Word */}
              <button
                type="button"
                onClick={() => {
                  exportWord();
                  setShowExportModal(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                <div style={{ fontSize: "24px" }}></div>
                <div>
                  <strong style={{ display: "block", color: "#1e293b", fontSize: "15px" }}>Microsoft Word (.doc)</strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>รูปแบบตาราง สามารถเปิดอ่านหรือสั่งพิมพ์ได้</span>
                </div>
              </button>

              {/* ตัวเลือกที่ 2: CSV */}
              <button
                type="button"
                onClick={() => {
                  exportCsv();
                  setShowExportModal(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                <div style={{ fontSize: "24px" }}></div>
                <div>
                  <strong style={{ display: "block", color: "#1e293b", fontSize: "15px" }}>CSV File (.csv)</strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>สำหรับนำไปวิเคราะห์ข้อมูลต่อใน Excel หรือระบบอื่น</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
