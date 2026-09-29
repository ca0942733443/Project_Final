// "use client";

// import { Download, Edit2, Lightbulb, MoreVertical, Plus, PlusSquare, Save, Trash2, Truck, X } from "lucide-react";
// import { useCallback, useEffect, useState } from "react";
// import AdminShell from "../_components/AdminShell";
// import { PageTitle, Stat } from "../_components/PageElements";
// import { apiFetch, errorMessage } from "../_lib/api";
// import SuppliersScreen from "./SuppliersScreen";
// import AddProductScreen from "./AddProductScreen";

// type InventoryItem = {
//   id: number;
//   sku: string;
//   name: string;
//   categoryName: string;
//   imageUrl: string | null;
//   stockQuantity: number;
//   lowStockThreshold: number;
//   unit: string;
//   price: number;
//   stockValue: number;
//   status: "out" | "low" | "normal";
//   lotNo: string | null;
//   expiryDate: string | null;
//   updatedAt?: string;
// };

// type InventoryData = {
//   items: InventoryItem[];
//   stats: { totalStockValue: number; productCount: number; lowStockCount: number; outOfStockCount: number };
// };

// function formatExpiryDate(value: string | null) {
//   if (!value) return "ไม่ระบุ";
//   return new Date(value).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
// }

// export default function ProductsScreen() {
//   const [search, setSearch] = useState("");
//   const [status, setStatus] = useState("");
//   const [sortBy, setSortBy] = useState("expiryAsc");
//   const [data, setData] = useState<InventoryData | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [currentPage, setCurrentPage] = useState(1);

//   // State สลับหน้าจอ (คลังสินค้า / จัดการ Supplier / เพิ่มรุ่นสินค้า)
//   const [view, setView] = useState<"inventory" | "suppliers" | "add-product">("inventory");
//   const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

//   // State สำหรับควบคุม Action Menu (สามจุด)
//   const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

//   // 🟢 State สำหรับ Popup สินค้าหลัก (ใช้ร่วมกันทั้ง เพิ่ม และ แก้ไข)
//   const [showAddProduct, setShowAddProduct] = useState(false);
//   const [newProductName, setNewProductName] = useState("");
//   const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

//   // State สำหรับ Modal ส่งออกรายงาน
//   const [showExportModal, setShowExportModal] = useState(false);

//   const loadInventory = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const queryParams = new URLSearchParams();
//       if (search) queryParams.append("search", search);
//       if (status) queryParams.append("status", status);
//       if (sortBy) queryParams.append("sortBy", sortBy);

//       const inventoryData = await apiFetch<InventoryData>(`/inventory?${queryParams.toString()}`);
//       setData(inventoryData);
//     } catch (loadError) {
//       setError(errorMessage(loadError));
//     } finally {
//       setLoading(false);
//     }
//   }, [search, status, sortBy]);

//   useEffect(() => { void loadInventory(); }, [loadInventory]);

//   useEffect(() => {
//     setCurrentPage(1);
//   }, [search, status, sortBy]);

//   // ปิดเมนูดรอปดาวน์เมื่อคลิกพื้นที่อื่น
//   useEffect(() => {
//     const handleClickOutside = () => setActiveMenuId(null);
//     window.addEventListener("click", handleClickOutside);
//     return () => window.removeEventListener("click", handleClickOutside);
//   }, []);

//   const filteredItems = (data?.items ?? []).filter((item) => {
//     if (!search.trim()) return true;
//     const keyword = search.toLowerCase();
//     return (
//       item.name.toLowerCase().includes(keyword) ||
//       item.sku.toLowerCase().includes(keyword) ||
//       item.categoryName.toLowerCase().includes(keyword)
//     );
//   });

//   const itemsPerPage = 5;
//   const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
//   const startIndex = (currentPage - 1) * itemsPerPage;
//   const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

//   // 🟢 เปิด Popup ในโหมด "เพิ่มสินค้าหลักใหม่"
//   const openCreateModal = () => {
//     setEditingItem(null);
//     setNewProductName("");
//     setShowAddProduct(true);
//   };

//   // 🟢 เปิด Popup ในโหมด "แก้ไขสินค้าหลัก"
//   const openEditModal = (item: InventoryItem) => {
//     setEditingItem(item);
//     setNewProductName(item.name);
//     setShowAddProduct(true);
//   };

//   // 🟢 บันทึกข้อมูลสินค้าหลัก (รองรับทั้งสร้างใหม่ POST และ แก้ไข PATCH)
//   const handleSaveProduct = async () => {
//     if (!newProductName.trim()) return;
//     setSaving(true);
//     setError("");
//     try {
//       if (editingItem) {
//         await apiFetch(`/products/${editingItem.id}`, {
//           method: "PATCH",
//           body: JSON.stringify({ name: newProductName.trim() }),
//         });
//       } else {
//         await apiFetch("/products", {
//           method: "POST",
//           body: JSON.stringify({ name: newProductName.trim() }),
//         });
//       }
//       setShowAddProduct(false);
//       setEditingItem(null);
//       setNewProductName("");
//       await loadInventory();
//     } catch (err) {
//       setError(errorMessage(err));
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDeleteProduct = async (id: number, name: string) => {
//     if (!confirm(`คุณต้องการลบสินค้า "${name}" ใช่หรือไม่?`)) return;
//     try {
//       await apiFetch(`/products/${id}`, { method: "DELETE" });
//       await loadInventory();
//     } catch (err) {
//       alert(errorMessage(err));
//     }
//   };

//   const stats = data?.stats;

//   const exportCsv = (item?: InventoryItem) => {
//     const itemsToExport = item ? [item] : data?.items ?? [];
//     if (!itemsToExport.length) return;
//     const rows = [["SKU", "สินค้า", "หมวดหมู่", "คงเหลือ", "หน่วย", "มูลค่า"], ...itemsToExport.map((i) => [i.sku, i.name, i.categoryName, i.stockQuantity, i.unit, i.stockValue])];
//     const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
//     const link = document.createElement("a");
//     link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
//     link.download = item ? `product-${item.sku || item.id}.csv` : "inventory.csv";
//     link.click();
//     URL.revokeObjectURL(link.href);
//   };

//   const exportWord = () => {
//     if (!data) return;

//     const tableHeader = `
//       <tr style="background-color: #f1f5f9; font-weight: bold;">
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">SKU</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">สินค้า</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">หมวดหมู่</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">วันหมดอายุ</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">ราคาขาย</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">คงเหลือ</th>
//         <th style="border: 1px solid #cbd5e1; padding: 8px;">สถานะ</th>
//       </tr>
//     `;

//     const tableRows = data.items.map((item) => {
//       const statusText = item.status === "out" ? "สินค้าหมด" : item.status === "low" ? "สต็อกต่ำ" : "ปกติ";
//       return `
//         <tr>
//           <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.sku || "—"}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.name}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.categoryName}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px;">${formatExpiryDate(item.expiryDate)}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">฿${item.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${item.stockQuantity.toLocaleString("th-TH")} ${item.unit}</td>
//           <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${statusText}</td>
//         </tr>
//       `;
//     }).join("");

//     const wordContent = `
//       <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
//       <head>
//         <meta charset='utf-8'>
//         <title>รายงานคลังสินค้า</title>
//         <style>
//           body { font-family: 'Sarabun', 'Tahoma', sans-serif; }
//           table { width: 100%; border-collapse: collapse; margin-top: 16px; }
//           h2 { color: #0f172a; margin-bottom: 4px; }
//         </style>
//       </head>
//       <body>
//         <h2>รายงานข้อมูลคลังสินค้า</h2>
//         <p style="color: #64748b; font-size: 14px;">วันที่ออกรายงาน: ${new Date().toLocaleDateString("th-TH")}</p>
//         <table>
//           <thead>${tableHeader}</thead>
//           <tbody>${tableRows}</tbody>
//         </table>
//       </body>
//       </html>
//     `;

//     const blob = new Blob(["\ufeff", wordContent], { type: "application/msword" });
//     const link = document.createElement("a");
//     link.href = URL.createObjectURL(blob);
//     link.download = "รายงานคลังสินค้า.doc";
//     link.click();
//     URL.revokeObjectURL(link.href);
//   };

//   // เงื่อนไขสลับหน้าจอไป SuppliersScreen (ไม่ต้องส่ง onBack เพื่อหลีกเลี่ยง Type Error)
//   if (view === "suppliers") {
//     return <SuppliersScreen />;
//   }

//   // เงื่อนไขสลับหน้าจอไป AddProductScreen (เพิ่มรุ่นสินค้า)
//   if (view === "add-product") {
//     return (
//       <AddProductScreen
//         parentId={selectedParentId}
//         onBack={() => {
//           setView("inventory");
//           void loadInventory();
//         }}
//       />
//     );
//   }

//   return (
//     <AdminShell active="products">
//       <PageTitle 
//         title="การจัดการคลังสินค้า" 
//         subtitle="ตรวจสอบและจัดการสต็อกจากฐานข้อมูลจริง" 
//         action={
//           <div style={{ display: "flex", gap: "10px" }}>
//             <button
//               className="primary-button"
//               onClick={openCreateModal}
//               type="button"
//               style={{
//                 backgroundColor: "#046c4e",
//                 color: "#ffffff",
//                 borderColor: "#046c4e",
//               }}
//             >
//               <PlusSquare size={17} /> เพิ่มสินค้าหลักใหม่
//             </button>
//           </div>
//         } 
//       />
//       <div className="stat-grid four">
//         <Stat label="มูลค่าสินค้าในคลังทั้งหมด" value={`฿${(stats?.totalStockValue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} />
//         <Stat label="จำนวนรายการสินค้า" value={`${stats?.productCount ?? 0} รายการ`} tone="neutral" />
//         <Stat label="สินค้าสต็อกต่ำ" value={`${stats?.lowStockCount ?? 0}`} tone="orange" note="ควรเติมสินค้าทันที" />
//         <Stat label="สินค้าหมด" value={`${stats?.outOfStockCount ?? 0}`} tone="red" />
//       </div>

//       <section className="data-card inventory-stock-card">
//         <div className="inventory-toolbar">
//           <label className="inventory-search">
//             <span className="sr-only">ค้นหาสินค้า</span>
//             <input type="search" placeholder="ค้นหาชื่อสินค้า หรือ SKU..." value={search} onChange={(event) => setSearch(event.target.value)} />
//           </label>
//           <div className="inventory-toolbar-actions">
//             <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="กรองตามสถานะ">
//                 <option value="">สถานะ: ทั้งหมด</option>
//                 <option value="normal">สถานะ: ปกติ</option>
//                 <option value="low">สถานะ: สต็อกต่ำ</option>
//                 <option value="out">สถานะ: สินค้าหมด</option>
//             </select>
//             <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="เรียงลำดับสินค้า">
//                 <option value="expiryAsc">เรียงตาม: วันหมดอายุเร็วที่สุด</option>
//                 <option value="stockDesc">เรียงตาม: สต็อกคลังมากที่สุด</option>
//                 <option value="stockAsc">เรียงตาม: สต็อกคลังน้อยที่สุด</option>
//             </select>
//             <button type="button" className="inventory-export" onClick={() => setShowExportModal(true)}> <Download size={16} /> ส่งออก </button>
//           </div>
//         </div>

//         {loading && <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>}
//         {error && <div className="api-message error">{error}</div>}

//         <div className="inventory-table inventory-table-single">
//             <div className="table-wrap">
//               <table>
//                 <thead>
//                   <tr>{["สินค้า", "SKU", "หมวดหมู่", "วันหมดอายุ", "ราคาขาย", "คงเหลือ", "สถานะ", "จัดการ"].map((title) => <th key={title}>{title}</th>)}</tr>
//                 </thead>
//                 <tbody>
//                   {paginatedItems.map((item) => {
//                     const statusClass = item.status === "out" ? "out" : item.status === "low" ? "low" : "normal";

//                     return (
//                       <tr key={item.id}>
//                         <td className="inventory-product-cell">
//                           <div className="inventory-product">
//                             {item.imageUrl ? (
//                               <img src={item.imageUrl} alt={item.name} />
//                             ) : (
//                               <span className="inventory-product-fallback">{item.name ? item.name.charAt(0) : "-"}</span>
//                             )}
//                             <strong>{item.name}</strong>
//                           </div>
//                         </td>
//                         <td><code className="inventory-sku">{item.sku || "—"}</code></td>
//                         <td>{item.categoryName}</td>
//                         <td>{formatExpiryDate(item.expiryDate)}</td>
//                         <td className="inventory-price">฿{item.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
//                         <td className="inventory-quantity">{item.stockQuantity.toLocaleString("th-TH")} <small>{item.unit}</small></td>
//                         <td><span className={`inventory-status ${statusClass}`}>{item.status === "out" ? "สินค้าหมด" : item.status === "low" ? "สต็อกต่ำ" : "ปกติ"}</span></td>
                        
//                         <td style={{ position: "relative", textAlign: "center" }}>
//                           <button
//                             type="button"
//                             onClick={(e) => {
//                               e.stopPropagation();
//                               setActiveMenuId(activeMenuId === item.id ? null : item.id);
//                             }}
//                             style={{
//                               border: "none",
//                               background: "none",
//                               cursor: "pointer",
//                               padding: "6px",
//                               borderRadius: "6px",
//                               color: "#64748b",
//                             }}
//                           >
//                             <MoreVertical size={18} />
//                           </button>

//                           {activeMenuId === item.id && (
//                             <div
//                               onClick={(e) => e.stopPropagation()}
//                               style={{
//                                 position: "absolute",
//                                 right: "12px",
//                                 top: "80%",
//                                 backgroundColor: "#ffffff",
//                                 borderRadius: "12px",
//                                 boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
//                                 border: "1px solid #f1f5f9",
//                                 width: "170px",
//                                 zIndex: 100,
//                                 padding: "6px",
//                                 textAlign: "left",
//                               }}
//                             >
//                               <button
//                                 type="button"
//                                 onClick={() => {
//                                   setSelectedParentId(item.id);
//                                   setView("add-product");
//                                   setActiveMenuId(null);
//                                 }}
//                                 style={{
//                                   display: "flex",
//                                   alignItems: "center",
//                                   gap: "10px",
//                                   width: "100%",
//                                   padding: "8px 12px",
//                                   border: "none",
//                                   background: "none",
//                                   fontSize: "13px",
//                                   fontWeight: "500",
//                                   color: "#334155",
//                                   cursor: "pointer",
//                                   borderRadius: "6px",
//                                 }}
//                                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
//                                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
//                               >
//                                 <Plus size={16} style={{ color: "#3b82f6" }} />
//                                 <span>เพิ่มรุ่นสินค้า</span>
//                               </button>

//                               <button
//                                 type="button"
//                                 onClick={() => {
//                                   setActiveMenuId(null);
//                                   openEditModal(item);
//                                 }}
//                                 style={{
//                                   display: "flex",
//                                   alignItems: "center",
//                                   gap: "10px",
//                                   width: "100%",
//                                   padding: "8px 12px",
//                                   border: "none",
//                                   background: "none",
//                                   fontSize: "13px",
//                                   fontWeight: "500",
//                                   color: "#334155",
//                                   cursor: "pointer",
//                                   borderRadius: "6px",
//                                 }}
//                                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
//                                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
//                               >
//                                 <Edit2 size={15} style={{ color: "#64748b" }} />
//                                 <span>แก้ไขสินค้าหลัก</span>
//                               </button>

//                               <button
//                                 type="button"
//                                 onClick={() => {
//                                   exportCsv(item);
//                                   setActiveMenuId(null);
//                                 }}
//                                 style={{
//                                   display: "flex",
//                                   alignItems: "center",
//                                   gap: "10px",
//                                   width: "100%",
//                                   padding: "8px 12px",
//                                   border: "none",
//                                   background: "none",
//                                   fontSize: "13px",
//                                   fontWeight: "500",
//                                   color: "#334155",
//                                   cursor: "pointer",
//                                   borderRadius: "6px",
//                                 }}
//                                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
//                                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
//                               >
//                                 <Download size={15} style={{ color: "#10b981" }} />
//                                 <span>ส่งออกข้อมูล</span>
//                               </button>

//                               <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0" }} />

//                               <button
//                                 type="button"
//                                 onClick={() => {
//                                   setActiveMenuId(null);
//                                   handleDeleteProduct(item.id, item.name);
//                                 }}
//                                 style={{
//                                   display: "flex",
//                                   alignItems: "center",
//                                   gap: "10px",
//                                   width: "100%",
//                                   padding: "8px 12px",
//                                   border: "none",
//                                   background: "none",
//                                   fontSize: "13px",
//                                   fontWeight: "500",
//                                   color: "#ef4444",
//                                   cursor: "pointer",
//                                   borderRadius: "6px",
//                                 }}
//                                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
//                                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
//                               >
//                                 <Trash2 size={15} style={{ color: "#ef4444" }} />
//                                 <span>ลบสินค้าหลัก</span>
//                               </button>
//                             </div>
//                           )}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>

//             <div className="pagination inventory-pagination">
//               <span>
//                 แสดง {filteredItems.length ? startIndex + 1 : 0} ถึง {Math.min(startIndex + itemsPerPage, filteredItems.length)} จาก {filteredItems.length} รายการ
//               </span>
//               <div>
//                 <button
//                   type="button"
//                   aria-label="หน้าก่อนหน้า"
//                   disabled={currentPage === 1}
//                   onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
//                 >
//                   ‹
//                 </button>
//                 <span className="inventory-page-indicator">{currentPage} / {totalPages}</span>
//                 <button
//                   type="button"
//                   aria-label="หน้าถัดไป"
//                   disabled={currentPage >= totalPages}
//                   onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
//                 >
//                   ›
//                 </button>
//               </div>
//             </div>
//           </div>

//         {!loading && data?.items.length === 0 && <div className="api-message">ไม่พบสินค้าในสถานะที่เลือก</div>}
//       </section>

//       {/* 🟢 Popup เพิ่ม / แก้ไข สินค้าหลัก */}
//       {showAddProduct && (
//         <div
//           style={{
//             position: "fixed",
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 9999,
//             backdropFilter: "blur(2px)",
//           }}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               width: "100%",
//               maxWidth: "520px",
//               padding: "24px",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
//             }}
//           >
//             <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
//               <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
//                 <div
//                   style={{
//                     width: "44px",
//                     height: "44px",
//                     backgroundColor: "#046c4e",
//                     borderRadius: "10px",
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     color: "#fff",
//                   }}
//                 >
//                   <PlusSquare size={24} />
//                 </div>
//                 <div>
//                   <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#0f172a" }}>
//                     {editingItem ? "แก้ไขสินค้าหลัก" : "เพิ่มสินค้าหลักใหม่"}
//                   </h3>
//                   <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
//                     {editingItem ? "แก้ไขชื่อสินค้าหลักในระบบ" : "ระบบเพิ่มสินค้าหลักเบื้องต้น (ใส่ชื่อสินค้าเพื่อเริ่มสร้างรายการ)"}
//                   </p>
//                 </div>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setShowAddProduct(false);
//                   setEditingItem(null);
//                 }}
//                 style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <div style={{ marginBottom: "16px" }}>
//               <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
//                 <label style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
//                   ชื่อสินค้าหลัก <span style={{ color: "#ef4444" }}>*</span>
//                 </label>
//                 <span style={{ fontSize: "12px", color: "#94a3b8" }}>จำเป็นต้องระบุ</span>
//               </div>
//               <input
//                 type="text"
//                 value={newProductName}
//                 onChange={(e) => setNewProductName(e.target.value)}
//                 placeholder="กรอกชื่อสินค้าหลัก เช่น ซอสหอยตรานกทะเลใหญ่, ถุงหนาขุ่นดาวปีกส้ม..."
//                 autoFocus
//                 style={{
//                   width: "100%",
//                   padding: "12px 14px",
//                   borderRadius: "10px",
//                   border: "1px solid #e2e8f0",
//                   backgroundColor: "#f8fafc",
//                   fontSize: "14px",
//                   outline: "none",
//                   boxSizing: "border-box",
//                 }}
//               />
//             </div>

//             <div
//               style={{
//                 display: "flex",
//                 gap: "10px",
//                 padding: "12px 14px",
//                 backgroundColor: "#f0fdf4",
//                 borderRadius: "10px",
//                 border: "1px solid #dcfce7",
//                 marginBottom: "24px",
//               }}
//             >
//               <Lightbulb size={20} style={{ color: "#166534", flexShrink: 0, marginTop: "2px" }} />
//               <p style={{ margin: 0, fontSize: "13px", color: "#166534", lineHeight: "1.5" }}>
//                 เมื่อบันทึกสินค้าแล้ว ท่านสามารถกดปุ่มสามจุด (⋮) ที่รายการสินค้าในตาราง เพื่อเพิ่มประเภท ยี่ห้อ และรุ่นสินค้า (Variants) ได้ทันที
//               </p>
//             </div>

//             <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setShowAddProduct(false);
//                   setEditingItem(null);
//                 }}
//                 style={{
//                   padding: "10px 20px",
//                   borderRadius: "8px",
//                   border: "none",
//                   backgroundColor: "transparent",
//                   color: "#475569",
//                   fontWeight: "500",
//                   cursor: "pointer",
//                   fontSize: "14px",
//                 }}
//               >
//                 ยกเลิก
//               </button>
//               <button
//                 type="button"
//                 onClick={handleSaveProduct}
//                 disabled={!newProductName.trim() || saving}
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   gap: "8px",
//                   padding: "10px 20px",
//                   borderRadius: "10px",
//                   backgroundColor: "#046c4e",
//                   color: "#ffffff",
//                   border: "none",
//                   fontWeight: "500",
//                   cursor: !newProductName.trim() || saving ? "not-allowed" : "pointer",
//                   opacity: !newProductName.trim() || saving ? 0.6 : 1,
//                   fontSize: "14px",
//                 }}
//               >
//                 <Save size={18} />
//                 <span>{saving ? "กำลังบันทึก..." : editingItem ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}</span>
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* 🟢 Modal ส่งออกรายงาน */}
//       {showExportModal && (
//         <div
//           style={{
//             position: "fixed",
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 9999,
//             backdropFilter: "blur(2px)",
//           }}
//           onClick={() => setShowExportModal(false)}
//         >
//           <div
//             onClick={(e) => e.stopPropagation()}
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               width: "100%",
//               maxWidth: "420px",
//               padding: "24px",
//               textAlign: "center",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
//               position: "relative",
//             }}
//           >
//             <button
//               type="button"
//               onClick={() => setShowExportModal(false)}
//               style={{
//                 position: "absolute",
//                 right: "16px",
//                 top: "16px",
//                 background: "none",
//                 border: "none",
//                 cursor: "pointer",
//                 color: "#94a3b8",
//               }}
//             >
//               <X size={20} />
//             </button>
            
//             <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "bold", color: "#0f172a" }}>
//               ส่งออกรายงานคลังสินค้า
//             </h3>
//             <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "24px" }}>
//               เลือกรูปแบบไฟล์ที่คุณต้องการดาวน์โหลด
//             </p>

//             <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
//               <button
//                 type="button"
//                 onClick={() => {
//                   exportCsv();
//                   setShowExportModal(false);
//                 }}
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   gap: "10px",
//                   padding: "12px",
//                   borderRadius: "10px",
//                   border: "1px solid #e2e8f0",
//                   backgroundColor: "#f8fafc",
//                   color: "#1e293b",
//                   fontWeight: "600",
//                   cursor: "pointer",
//                   fontSize: "14px",
//                 }}
//               >
//                 <Download size={18} style={{ color: "#10b981" }} />
//                 <span>ส่งออกเป็น CSV (.csv)</span>
//               </button>

//               <button
//                 type="button"
//                 onClick={() => {
//                   exportWord();
//                   setShowExportModal(false);
//                 }}
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   gap: "10px",
//                   padding: "12px",
//                   borderRadius: "10px",
//                   border: "1px solid #e2e8f0",
//                   backgroundColor: "#f8fafc",
//                   color: "#1e293b",
//                   fontWeight: "600",
//                   cursor: "pointer",
//                   fontSize: "14px",
//                 }}
//               >
//                 <Download size={18} style={{ color: "#2563eb" }} />
//                 <span>ส่งออกเป็น Word Document (.doc)</span>
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </AdminShell>
//   );
// }




"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  X,
  AlertCircle,
  Filter,
  AlertTriangle,
} from "lucide-react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type ProductItem = {
  id: number;
  code: string;
  name: string;
  categoryId?: number;
  categoryName?: string;
  price: number;
  costPrice?: number;
  stockQuantity: number;
  minStock?: number;
  unit: string;
  status: "active" | "inactive";
};

type CategoryItem = {
  id: number;
  name: string;
};

export default function ProductManageScreen() {
  const router = useRouter();

  // State ข้อมูล
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State ฟิลเตอร์และค้นหา
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // ดึงข้อมูลสินค้าและหมวดหมู่
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prodData, catData] = await Promise.all([
        apiFetch<ProductItem[]>("/products"),
        apiFetch<CategoryItem[]>("/categories"),
      ]);
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 🟢 ย้ายหน้าไปสร้างสินค้าใหม่ (ไม่ใช้ Popup)
  const handleGoToAddProduct = () => {
    router.push("/addproduct");
  };

  // 🟢 ย้ายหน้าไปแก้ไขสินค้า
  const handleGoToEditProduct = (prodId: number) => {
    router.push(`/addproduct?id=${prodId}`);
  };

  // ยืนยันการลบสินค้า
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);

    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setAlertMessage(errorMessage(err));
    }
  };

  // กรองรายการสินค้า
  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.code && prod.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategoryFilter === "all" ||
      (prod.categoryId && String(prod.categoryId) === selectedCategoryFilter);

    return matchesSearch && matchesCategory;
  });

  return (
    <AdminShell active="productmanage">
      {/* Header พร้อมปุ่มย้อนกลับ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e293b",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            title="ย้อนกลับ"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              จัดการรายการสินค้า
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
              เพิ่ม แก้ไข และกำหนดรายละเอียดสินค้าสำหรับใช้งานในระบบ
            </p>
          </div>
        </div>

        {/* ปุ่มกดเปิดหน้า AddProductScreen */}
        <button
          type="button"
          onClick={handleGoToAddProduct}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            backgroundColor: "#046c4e",
            color: "#ffffff",
            borderRadius: "10px",
            border: "none",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          <Plus size={18} /> เพิ่มสินค้าใหม่
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#fef2f2",
            color: "#ef4444",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Control Bar: ค้นหา & กรอง */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า หรือรหัสสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 42px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Filter size={18} color="#64748b" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "#ffffff",
            }}
          >
            <option value="all">หมวดหมู่ทั้งหมด</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ตารางแสดงข้อมูลสินค้า */}
      <section className="data-card inventory-stock-card">
        <div className="inventory-table inventory-table-single">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>รหัส / รายการสินค้า</th>
                  <th style={{ textAlign: "left" }}>หมวดหมู่</th>
                  <th style={{ textAlign: "right" }}>ต้นทุน</th>
                  <th style={{ textAlign: "right" }}>ราคาขาย</th>
                  <th style={{ textAlign: "center" }}>คงเหลือ</th>
                  <th style={{ width: "120px", textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      กำลังโหลดข้อมูลสินค้า...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      ไม่พบรายการสินค้าที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const isLowStock =
                      prod.minStock !== undefined && prod.stockQuantity <= prod.minStock;

                    return (
                      <tr key={prod.id}>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "8px",
                                backgroundColor: "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#475569",
                              }}
                            >
                              <Package size={20} />
                            </div>
                            <div>
                              <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "14px" }}>
                                {prod.name}
                              </div>
                              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                {prod.code || "ไม่มีรหัส"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "left", color: "#475569", fontSize: "14px" }}>
                          {prod.categoryName || "ทั่วไป"}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b", fontSize: "14px" }}>
                          ฿{(prod.costPrice || 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "600", color: "#046c4e", fontSize: "14px" }}>
                          ฿{(prod.price || 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: isLowStock ? "#fef2f2" : "#f0fdf4",
                              color: isLowStock ? "#ef4444" : "#16a34a",
                            }}
                          >
                            {isLowStock && <AlertTriangle size={12} />}
                            {prod.stockQuantity} {prod.unit}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleGoToEditProduct(prod.id)}
                              title="แก้ไขสินค้า"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: prod.id, name: prod.name })}
                              title="ลบสินค้า"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal ยืนยันการลบ */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              textAlign: "center",
            }}
          >
            <AlertCircle size={48} color="#ef4444" style={{ margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 8px 0" }}>
              ยืนยันการลบสินค้า
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0" }}>
              คุณต้องการลบรายการสินค้า <strong>"{deleteTarget.name}"</strong> ออกจากระบบใช่หรือไม่?
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#ef4444", color: "#fff", fontWeight: "600", cursor: "pointer" }}
              >
                ลบสินค้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Error Dialog */}
      {alertMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px",
              width: "100%",
              maxWidth: "360px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "14px", color: "#0f172a", marginBottom: "16px" }}>{alertMessage}</p>
            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#0f172a", color: "#fff", cursor: "pointer" }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}