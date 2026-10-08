// "use client";

// import {
//   AlertTriangle,
//   CheckCircle2,
//   FolderCog,
//   MoreVertical,
//   PackagePlus,
//   Pencil,
//   Search,
//   Trash2,
//   X,
// } from "lucide-react";
// import { useRouter } from "next/navigation";
// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { createPortal } from "react-dom";
// import AdminShell from "../_components/AdminShell";
// import { PageTitle, Stat } from "../_components/PageElements";
// import { apiFetch, errorMessage } from "../_lib/api";

// type StockItem = {
//   id: number;
//   sku: string;
//   name: string;
//   categoryName?: string;
//   supplierName?: string | null;
//   stockQuantity: number;
//   unit: string;
//   lowStockThreshold: number;
//   price: number;
// };

// export default function StockScreen() {
//   const router = useRouter();
//   const [items, setItems] = useState<StockItem[]>([]);
//   const [search, setSearch] = useState("");
//   const [filterStatus, setFilterStatus] = useState<"ALL" | "NORMAL" | "LOW" | "OUT">("ALL");
//   const [filterSupplier, setFilterSupplier] = useState("ALL");
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // Portal & Position Controlled Menu Popover State
//   const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
//   const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
//   const [mounted, setMounted] = useState(false);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   // Edit Modal State
//   const [editingItem, setEditingItem] = useState<StockItem | null>(null);
//   const [editName, setEditName] = useState("");
//   const [editPrice, setEditPrice] = useState<number | "">("");
//   const [editStock, setEditStock] = useState<number | "">("");
//   const [editUnit, setEditUnit] = useState("");
//   const [saving, setSaving] = useState(false);

//   // Delete Confirm Modal State (สร้าง Popup แทน window.confirm)
//   const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
//   const [deleting, setDeleting] = useState(false);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   // โหลดข้อมูลสต็อก
//   const loadStockData = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<StockItem[]>("/products");
//       setItems(data);
//     } catch (err) {
//       setError(errorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void loadStockData();
//   }, [loadStockData]);

//   // ปิดเมนูป็อปอัพเมื่อคลิกข้างนอก หรือเมื่อมีการเลื่อนหน้าจอ (Scroll)
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
//         setActiveMenuId(null);
//         setMenuPosition(null);
//       }
//     };

//     const handleScroll = () => {
//       if (activeMenuId !== null) {
//         setActiveMenuId(null);
//         setMenuPosition(null);
//       }
//     };

//     if (activeMenuId !== null) {
//       document.addEventListener("mousedown", handleClickOutside);
//       window.addEventListener("scroll", handleScroll, true);
//     }

//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//       window.removeEventListener("scroll", handleScroll, true);
//     };
//   }, [activeMenuId]);

//   // คำนวณตำแหน่งปุ่มสำหรับเปิด Popover
//   const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
//     e.stopPropagation();
//     if (activeMenuId === id) {
//       setActiveMenuId(null);
//       setMenuPosition(null);
//     } else {
//       const rect = e.currentTarget.getBoundingClientRect();
//       const menuHeight = 90;
//       const windowHeight = window.innerHeight;

//       const spaceBelow = windowHeight - rect.bottom;
//       const isCloseToBottom = spaceBelow < menuHeight;

//       setMenuPosition({
//         top: isCloseToBottom ? rect.top - menuHeight - 4 : rect.bottom + 4,
//         left: Math.min(rect.right - 130, window.innerWidth - 140),
//       });
//       setActiveMenuId(id);
//     }
//   };

//   // สรุปสถิติ
//   const stats = useMemo(() => {
//     const total = items.length;
//     const lowStock = items.filter(
//       (item) => item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5)
//     ).length;
//     const outOfStock = items.filter((item) => item.stockQuantity <= 0).length;
//     const normal = total - lowStock - outOfStock;

//     return { total, normal, lowStock, outOfStock };
//   }, [items]);

//   const suppliers = useMemo(
//     () => Array.from(new Set(items.map((item) => item.supplierName?.trim()).filter((name): name is string => Boolean(name)))),
//     [items]
//   );

//   // กรองรายการสินค้า
//   const filteredItems = useMemo(() => {
//     return items.filter((item) => {
//       const matchesSearch =
//         !search.trim() ||
//         item.name.toLowerCase().includes(search.toLowerCase()) ||
//         item.sku?.toLowerCase().includes(search.toLowerCase());

//       const isLow = item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5);
//       const isOut = item.stockQuantity <= 0;

//       if (!matchesSearch) return false;
//       if (filterSupplier !== "ALL" && (item.supplierName?.trim() || "ไม่ระบุ") !== filterSupplier) return false;
//       if (filterStatus === "NORMAL") return !isLow && !isOut;
//       if (filterStatus === "LOW") return isLow;
//       if (filterStatus === "OUT") return isOut;
//       return true;
//     });
//   }, [items, search, filterStatus, filterSupplier]);

//   // เปิด Modal แก้ไข
//   const handleOpenEdit = (item: StockItem) => {
//     setEditingItem(item);
//     setEditName(item.name);
//     setEditPrice(item.price ?? 0);
//     setEditStock(item.stockQuantity ?? 0);
//     setEditUnit(item.unit || "ชิ้น");
//     setActiveMenuId(null);
//     setMenuPosition(null);
//   };

//   // บันทึกการแก้ไข
//   const handleSaveEdit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!editingItem) return;

//     setSaving(true);
//     try {
//       await apiFetch(`/products/${editingItem.id}`, {
//         method: "PATCH",
//         body: JSON.stringify({
//           name: editName,
//           price: Number(editPrice),
//           stockQuantity: Number(editStock),
//           unit: editUnit,
//         }),
//       });
//       setEditingItem(null);
//       await loadStockData();
//     } catch (err) {
//       alert(errorMessage(err));
//     } finally {
//       setSaving(false);
//     }
//   };

//   // เปิด Confirm Delete Popup
//   const handleOpenDelete = (item: StockItem) => {
//     setActiveMenuId(null);
//     setMenuPosition(null);
//     setDeletingItem(item);
//   };

//   // ยืนยันการลบสินค้า
//   const handleConfirmDelete = async () => {
//     if (!deletingItem) return;

//     setDeleting(true);
//     try {
//       await apiFetch(`/products/${deletingItem.id}`, { method: "DELETE" });
//       setDeletingItem(null);
//       await loadStockData();
//     } catch (err) {
//       alert(errorMessage(err));
//     } finally {
//       setDeleting(false);
//     }
//   };

//   const activeItem = items.find((i) => i.id === activeMenuId);

//   return (
//     <AdminShell active="stock">
//       <PageTitle
//         title="จัดการสต็อกสินค้า"
//         subtitle="ตรวจสอบยอดสินค้าคงเหลือ ปรับยอดสต็อก และติดตามการเตือนสินค้าใกล้หมด"
//         action={
//           <div style={{ display: "flex", gap: "8px" }}>
//             <button
//               className="secondary-button"
//               onClick={() => router.push("/categories")}
//               type="button"
//               style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
//             >
//               <FolderCog size={16} />
//               <span>จัดการหมวดหมู่</span>
//             </button>
//             <button
//               className="primary-button"
//               onClick={() => router.push("/productmanage")}
//               type="button"
//               style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
//             >
//               <PackagePlus size={16} />
//               <span>จัดการสินค้า</span>
//             </button>
//           </div>
//         }
//       />

//       {/* สรุปสถิติ */}
//       <div className="stat-grid four">
//         <Stat label="สินค้าทั้งหมด" value={`${stats.total} รายการ`} />
//         <Stat label="สต็อกปกติ" value={`${stats.normal} รายการ`} tone="neutral" />
//         <Stat label="สินค้าใกล้หมด" value={`${stats.lowStock} รายการ`} tone="orange" />
//         <Stat label="สินค้าหมดสต็อก" value={`${stats.outOfStock} รายการ`} tone="red" />
//       </div>

//       {error && <div className="api-message error" style={{ marginTop: "16px" }}>{error}</div>}

//       {/* ตารางสินค้า */}
//       <section className="data-card" style={{ marginTop: "16px" }}>
//         <div className="table-tools" style={{ alignItems: "center", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          
//           <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
//             <Search
//               size={18}
//               style={{
//                 position: "absolute",
//                 left: "14px",
//                 top: "50%",
//                 transform: "translateY(-50%)",
//                 color: "#94a3b8",
//               }}
//             />
//             <input
//               type="text"
//               placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด หรือ SKU..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{
//                 width: "100%",
//                 padding: "10px 14px 10px 42px",
//                 borderRadius: "10px",
//                 border: "1px solid #cbd5e1",
//                 fontSize: "14px",
//                 outline: "none",
//                 boxSizing: "border-box",
//               }}
//             />
//           </div>

//           <div>
//             <select
//               aria-label="กรองผู้จำหน่าย"
//               value={filterSupplier}
//               onChange={(e) => setFilterSupplier(e.target.value)}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: "8px",
//                 fontSize: "14px",
//                 border: "1px solid #cbd5e1",
//                 backgroundColor: "#ffffff",
//                 color: "#334155",
//                 cursor: "pointer",
//               }}
//             >
//               <option value="ALL">ผู้จำหน่ายทั้งหมด</option>
//               {suppliers.map((supplier) => (
//                 <option key={supplier} value={supplier}>{supplier}</option>
//               ))}
//             </select>
//           </div>

//           <div style={{ marginLeft: "auto" }}>
//             <select
//               aria-label="กรองสถานะสต็อก"
//               value={filterStatus}
//               onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: "8px",
//                 fontSize: "14px",
//                 border: "1px solid #cbd5e1",
//                 backgroundColor: "#ffffff",
//                 color: "#334155",
//                 cursor: "pointer",
//               }}
//             >
//               <option value="ALL">สถานะทั้งหมด </option>
//               <option value="NORMAL">ปกติ </option>
//               <option value="LOW">ใกล้หมด </option>
//               <option value="OUT">หมดสต็อก </option>
//             </select>
//           </div>
//         </div>

//         {loading ? (
//           <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>
//         ) : (
//           <div className="table-wrap">
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
//               <thead>
//                 <tr>
//                   <th style={{ textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#475569" }}>สินค้า / SKU</th>
//                   <th style={{ textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#475569" }}>ผู้จำหน่าย</th>
//                   <th style={{ textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#475569" }}>ราคาขาย</th>
//                   <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>คงเหลือ</th>
//                   <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>จุดแจ้งเตือน</th>
//                   <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>สถานะสต็อก</th>
//                   <th style={{ textAlign: "center", width: "50px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>จัดการ</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredItems.map((item) => {
//                   const isLow = item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5);
//                   const isOut = item.stockQuantity <= 0;
//                   const isMenuOpen = activeMenuId === item.id;

//                   return (
//                     <tr key={item.id}>
//                       <td style={{ textAlign: "left", fontSize: "14px" }}>
//                         <div style={{ fontWeight: "600", color: "#0f172a" }}>{item.name}</div>
//                         <div style={{ color: "#64748b", fontSize: "13px" }}>SKU: {item.sku || "-"}</div>
//                       </td>
//                       <td style={{ textAlign: "left", fontSize: "14px", color: "#475569" }}>
//                         {item.supplierName || "ไม่ระบุ"}
//                       </td>
//                       <td style={{ textAlign: "right", fontWeight: "500", fontSize: "14px" }}>
//                         ฿{Number(item.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
//                       </td>

//                       <td style={{ textAlign: "center", fontSize: "14px", fontWeight: 600 }}>
//                         <span
//                           style={{
//                             fontSize: "14px",
//                             fontWeight: 600,
//                             color: isOut ? "#dc2626" : isLow ? "#d97706" : "#0f172a",
//                             display: "inline-block",
//                           }}
//                         >
//                           {item.stockQuantity} {item.unit || "ชิ้น"}
//                         </span>
//                       </td>

//                       <td style={{ textAlign: "center", color: "#64748b", fontSize: "14px", fontWeight: 500 }}>
//                         {item.lowStockThreshold || 5} {item.unit || "ชิ้น"}
//                       </td>

//                       <td style={{ textAlign: "center" }}>
//                         {isOut ? (
//                           <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "600" }}>
//                             <AlertTriangle size={13} /> หมดสต็อก
//                           </span>
//                         ) : isLow ? (
//                           <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#fffbe8", color: "#d97706", fontSize: "13px", fontWeight: "600" }}>
//                             <AlertTriangle size={13} /> สต็อกต่ำ
//                           </span>
//                         ) : (
//                           <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: "13px", fontWeight: "600" }}>
//                             <CheckCircle2 size={13} /> ปกติ
//                           </span>
//                         )}
//                       </td>

//                       <td style={{ textAlign: "center" }}>
//                         <button
//                           type="button"
//                           onClick={(e) => handleToggleMenu(e, item.id)}
//                           style={{
//                             background: isMenuOpen ? "#f1f5f9" : "transparent",
//                             border: "none",
//                             padding: "6px",
//                             cursor: "pointer",
//                             color: isMenuOpen ? "#0f172a" : "#64748b",
//                             borderRadius: "8px",
//                             display: "inline-flex",
//                             alignItems: "center",
//                             justifyContent: "center",
//                             transition: "background-color 0.15s ease",
//                           }}
//                         >
//                           <MoreVertical size={18} />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}

//         {!loading && filteredItems.length === 0 && (
//           <div className="api-message">ไม่พบข้อมูลสต็อกสินค้า</div>
//         )}
//       </section>

//       {/* Popover Menu ลอยตัวด้วย Portal */}
//       {mounted && activeMenuId !== null && menuPosition && activeItem && createPortal(
//         <div
//           ref={menuRef}
//           style={{
//             position: "fixed",
//             top: `${menuPosition.top}px`,
//             left: `${menuPosition.left}px`,
//             backgroundColor: "#ffffff",
//             borderRadius: "12px",
//             boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
//             border: "1px solid #e2e8f0",
//             zIndex: 9999,
//             minWidth: "130px",
//             padding: "6px",
//             display: "flex",
//             flexDirection: "column",
//             gap: "2px",
//           }}
//         >
//           <style jsx>{`
//             .menu-item-btn {
//               display: flex;
//               align-items: center;
//               gap: 8px;
//               width: 100%;
//               padding: 8px 12px;
//               border: none;
//               background: transparent;
//               font-size: 13px;
//               font-weight: 500;
//               cursor: pointer;
//               border-radius: 6px;
//               transition: background-color 0.15s ease;
//             }
//             .menu-item-btn:hover {
//               background-color: #f1f5f9;
//             }
//           `}</style>

//           <button
//             type="button"
//             className="menu-item-btn"
//             style={{ color: "#334155" }}
//             onClick={() => handleOpenEdit(activeItem)}
//           >
//             <Pencil size={15} style={{ color: "#2563eb" }} /> แก้ไข
//           </button>

//           <button
//             type="button"
//             className="menu-item-btn"
//             style={{ color: "#ef4444", borderTop: "1px solid #f1f5f9" }}
//             onClick={() => handleOpenDelete(activeItem)}
//           >
//             <Trash2 size={15} /> ลบสินค้า
//           </button>
//         </div>,
//         document.body
//       )}

//       {/* Modal ยืนยันการลบสินค้า (Popup แบบ Custom) */}
//       {deletingItem && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 10000,
//           }}
//           onClick={() => !deleting && setDeletingItem(null)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "12px",
//               padding: "24px",
//               maxWidth: "380px",
//               width: "90%",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
//               textAlign: "center",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div
//               style={{
//                 width: "48px",
//                 height: "48px",
//                 borderRadius: "50%",
//                 backgroundColor: "#fef2f2",
//                 color: "#ef4444",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 margin: "0 auto 16px auto",
//               }}
//             >
//               <Trash2 size={24} />
//             </div>

//             <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
//               ยืนยันการลบสินค้า
//             </h3>

//             <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
//               คุณต้องการลบสินค้า <strong style={{ color: "#0f172a" }}>"{deletingItem.name}"</strong> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้
//             </p>

//             <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
//               <button
//                 type="button"
//                 disabled={deleting}
//                 onClick={() => setDeletingItem(null)}
//                 style={{
//                   flex: 1,
//                   padding: "10px 16px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   backgroundColor: "#ffffff",
//                   color: "#475569",
//                   fontSize: "14px",
//                   fontWeight: 600,
//                   cursor: deleting ? "not-allowed" : "pointer",
//                 }}
//               >
//                 ยกเลิก
//               </button>
//               <button
//                 type="button"
//                 disabled={deleting}
//                 onClick={() => void handleConfirmDelete()}
//                 style={{
//                   flex: 1,
//                   padding: "10px 16px",
//                   borderRadius: "8px",
//                   border: "none",
//                   backgroundColor: "#ef4444",
//                   color: "#ffffff",
//                   fontSize: "14px",
//                   fontWeight: 600,
//                   cursor: deleting ? "not-allowed" : "pointer",
//                 }}
//               >
//                 {deleting ? "กำลังลบ..." : "ลบสินค้า"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Modal แก้ไขข้อมูลสินค้า */}
//       {editingItem && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 10000,
//           }}
//           onClick={() => setEditingItem(null)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "12px",
//               padding: "20px 24px",
//               maxWidth: "420px",
//               width: "100%",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
//               position: "relative",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
//               <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
//                 แก้ไขข้อมูลสินค้า
//               </h3>
//               <button
//                 type="button"
//                 onClick={() => setEditingItem(null)}
//                 style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
//               >
//                 <X size={18} />
//               </button>
//             </div>

//             <form onSubmit={handleSaveEdit}>
//               <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
//                 <div>
//                   <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
//                     ชื่อสินค้า
//                   </label>
//                   <input
//                     type="text"
//                     value={editName}
//                     onChange={(e) => setEditName(e.target.value)}
//                     required
//                     style={{
//                       width: "100%",
//                       padding: "8px 10px",
//                       borderRadius: "6px",
//                       border: "1px solid #cbd5e1",
//                       fontSize: "13px",
//                       boxSizing: "border-box",
//                     }}
//                   />
//                 </div>

//                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
//                   <div>
//                     <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
//                       ราคาขาย (บาท)
//                     </label>
//                     <input
//                       type="number"
//                       value={editPrice}
//                       onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
//                       style={{
//                         width: "100%",
//                         padding: "8px 10px",
//                         borderRadius: "6px",
//                         border: "1px solid #cbd5e1",
//                         fontSize: "13px",
//                         boxSizing: "border-box",
//                       }}
//                     />
//                   </div>

//                   <div>
//                     <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
//                       จำนวนสต็อก
//                     </label>
//                     <input
//                       type="number"
//                       value={editStock}
//                       onChange={(e) => setEditStock(e.target.value === "" ? "" : Number(e.target.value))}
//                       style={{
//                         width: "100%",
//                         padding: "8px 10px",
//                         borderRadius: "6px",
//                         border: "1px solid #cbd5e1",
//                         fontSize: "13px",
//                         boxSizing: "border-box",
//                       }}
//                     />
//                   </div>
//                 </div>

//                 <div>
//                   <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
//                     หน่วยนับ
//                   </label>
//                   <input
//                     type="text"
//                     value={editUnit}
//                     onChange={(e) => setEditUnit(e.target.value)}
//                     placeholder="เช่น ชิ้น, แพ็ค, ถุง"
//                     style={{
//                       width: "100%",
//                       padding: "8px 10px",
//                       borderRadius: "6px",
//                       border: "1px solid #cbd5e1",
//                       fontSize: "13px",
//                       boxSizing: "border-box",
//                     }}
//                   />
//                 </div>
//               </div>

//               <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
//                 <button
//                   type="button"
//                   onClick={() => setEditingItem(null)}
//                   style={{
//                     padding: "6px 14px",
//                     borderRadius: "6px",
//                     border: "1px solid #cbd5e1",
//                     backgroundColor: "#ffffff",
//                     color: "#475569",
//                     fontSize: "13px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ยกเลิก
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={saving}
//                   style={{
//                     padding: "6px 14px",
//                     borderRadius: "6px",
//                     border: "none",
//                     backgroundColor: "#007A4D",
//                     color: "#ffffff",
//                     fontSize: "13px",
//                     fontWeight: 600,
//                     cursor: "pointer",
//                   }}
//                 >
//                   {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </AdminShell>
//   );
// }





"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FolderCog,
  MoreVertical,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type StockItem = {
  id: number;
  sku: string;
  name: string;
  categoryName?: string;
  supplierName?: string | null;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  price: number;
};

export default function StockScreen() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "NORMAL" | "LOW" | "OUT">("ALL");
  const [filterSupplier, setFilterSupplier] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editStock, setEditStock] = useState<number | "">("");
  const [editUnit, setEditUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // โหลดข้อมูลสต็อก
  const loadStockData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<StockItem[]>("/products");
      setItems(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStockData();
  }, [loadStockData]);

  // ปิดเมนูป็อปอัพเมื่อคลิกข้างนอก หรือเมื่อมีการเลื่อนหน้าจอ (Scroll)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
        setMenuPosition(null);
      }
    };

    const handleScroll = () => {
      if (activeMenuId !== null) {
        setActiveMenuId(null);
        setMenuPosition(null);
      }
    };

    if (activeMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeMenuId]);

  // คำนวณตำแหน่งปุ่มสำหรับเปิด Popover
  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
    e.stopPropagation();
    if (activeMenuId === id) {
      setActiveMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 90;
      const windowHeight = window.innerHeight;

      const spaceBelow = windowHeight - rect.bottom;
      const isCloseToBottom = spaceBelow < menuHeight;

      setMenuPosition({
        top: isCloseToBottom ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.min(rect.right - 130, window.innerWidth - 140),
      });
      setActiveMenuId(id);
    }
  };

  // สรุปสถิติ
  const stats = useMemo(() => {
    const total = items.length;
    const lowStock = items.filter(
      (item) => item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5)
    ).length;
    const outOfStock = items.filter((item) => item.stockQuantity <= 0).length;
    const normal = total - lowStock - outOfStock;

    return { total, normal, lowStock, outOfStock };
  }, [items]);

  const suppliers = useMemo(
    () => Array.from(new Set(items.map((item) => item.supplierName?.trim()).filter((name): name is string => Boolean(name)))),
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(search.toLowerCase());

      const isLow = item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5);
      const isOut = item.stockQuantity <= 0;

      if (!matchesSearch) return false;
      if (filterSupplier !== "ALL" && (item.supplierName?.trim() || "ไม่ระบุ") !== filterSupplier) return false;
      if (filterStatus === "NORMAL") return !isLow && !isOut;
      if (filterStatus === "LOW") return isLow;
      if (filterStatus === "OUT") return isOut;
      return true;
    });
  }, [items, search, filterStatus, filterSupplier]);

  const handleOpenEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(item.price ?? 0);
    setEditStock(item.stockQuantity ?? 0);
    setEditUnit(item.unit || "ชิ้น");
    setActiveMenuId(null);
    setMenuPosition(null);
  };

  // บันทึกการแก้ไข
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      await apiFetch(`/products/${editingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          price: Number(editPrice),
          stockQuantity: Number(editStock),
          unit: editUnit,
        }),
      });
      setEditingItem(null);
      await loadStockData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ลบสินค้า
  const handleDelete = async (item: StockItem) => {
    setActiveMenuId(null);
    setMenuPosition(null);
    if (!window.confirm(`คุณต้องการลบสินค้า "${item.name}" ใช่หรือไม่?`)) return;

    try {
      await apiFetch(`/products/${item.id}`, { method: "DELETE" });
      await loadStockData();
    } catch (err) {
      alert(errorMessage(err));
  const handleOpenDelete = (item: StockItem) => {
    setActiveMenuId(null);
    setMenuPosition(null);
    setDeletingItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    setDeleting(true);
    try {
      await apiFetch(`/products/${deletingItem.id}`, { method: "DELETE" });
      setDeletingItem(null);
      await loadStockData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const activeItem = items.find((i) => i.id === activeMenuId);

  return (
    <AdminShell active="stock">
      <PageTitle
        title="จัดการสต็อกสินค้า"
        subtitle="ตรวจสอบยอดสินค้าคงเหลือ ปรับยอดสต็อก และติดตามการเตือนสินค้าใกล้หมด"
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary-button"
              onClick={() => router.push("/categories")}
              type="button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FolderCog size={16} />
              <span>จัดการหมวดหมู่</span>
            </button>
            <button
              className="primary-button"
              onClick={() => router.push("/productmanage")}
              type="button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <PackagePlus size={16} />
              <span>จัดการสินค้า</span>
            </button>
          </div>
        }
      />

      {/* สรุปสถิติ */}
      <div className="stat-grid four">
        <Stat label="สินค้าทั้งหมด" value={`${stats.total} รายการ`} />
        <Stat label="สต็อกปกติ" value={`${stats.normal} รายการ`} tone="neutral" />
        <Stat label="สินค้าใกล้หมด" value={`${stats.lowStock} รายการ`} tone="orange" />
        <Stat label="สินค้าหมดสต็อก" value={`${stats.outOfStock} รายการ`} tone="red" />
      </div>

      {error && <div className="api-message error" style={{ marginTop: "16px" }}>{error}</div>}

      {/* ตารางสินค้า */}
      <section className="data-card" style={{ marginTop: "16px" }}>
        <div className="table-tools" style={{ alignItems: "center", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          
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
              placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด หรือ SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="stock-search-input"
            />
          </div>

          <div>
            <select
              aria-label="กรองผู้จำหน่าย"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="stock-filter-select"
            >
              <option value="ALL">ผู้จำหน่ายทั้งหมด</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>

          <div className="stock-status-filter-wrap">
            <select
              aria-label="กรองสถานะสต็อก"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <option value="ALL">ทั้งหมด ({stats.total})</option>
              <option value="NORMAL">ปกติ ({stats.normal})</option>
              <option value="LOW">ใกล้หมด ({stats.lowStock})</option>
              <option value="OUT">หมดแล้ว ({stats.outOfStock})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#475569" }}>สินค้า / SKU</th>
                  <th style={{ textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#475569" }}>ผู้จำหน่าย</th>
                  <th style={{ textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#475569" }}>ราคาขาย</th>
                  <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>คงเหลือ</th>
                  <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>จุดแจ้งเตือน</th>
                  <th style={{ textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#475569" }}>สถานะสต็อก</th>
                  <th style={{ textAlign: "center", width: "50px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLow = item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5);
                  const isOut = item.stockQuantity <= 0;
                  const isMenuOpen = activeMenuId === item.id;

                  return (
                    <tr key={item.id}>
                      <td style={{ textAlign: "left", fontSize: "14px" }}>
                        <div style={{ fontWeight: "600", color: "#0f172a" }}>{item.name}</div>
                        <div style={{ color: "#64748b", fontSize: "13px" }}>SKU: {item.sku || "-"}</div>
                      </td>
                      <td style={{ textAlign: "left", fontSize: "14px", color: "#475569" }}>
                        {item.supplierName || "ไม่ระบุ"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "500", fontSize: "14px" }}>
                        ฿{Number(item.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>

                      <td style={{ textAlign: "center", fontSize: "14px", fontWeight: 600 }}>
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: isOut ? "#dc2626" : isLow ? "#d97706" : "#0f172a",
                            display: "inline-block",
                          }}
                        >
                          {item.stockQuantity} {item.unit || "ชิ้น"}
                        </span>
                      </td>

                      <td style={{ textAlign: "center", color: "#64748b", fontSize: "14px", fontWeight: 500 }}>
                        {item.lowStockThreshold || 5} {item.unit || "ชิ้น"}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        {isOut ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "600" }}>
                            <AlertTriangle size={13} /> หมดสต็อก
                          </span>
                        ) : isLow ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#fffbe8", color: "#d97706", fontSize: "13px", fontWeight: "600" }}>
                            <AlertTriangle size={13} /> สต็อกต่ำ
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: "13px", fontWeight: "600" }}>
                            <CheckCircle2 size={13} /> ปกติ
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleMenu(e, item.id)}
                          style={{
                            background: isMenuOpen ? "#f1f5f9" : "transparent",
                            border: "none",
                            padding: "6px",
                            cursor: "pointer",
                            color: isMenuOpen ? "#0f172a" : "#64748b",
                            borderRadius: "8px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.15s ease",
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="api-message">ไม่พบข้อมูลสต็อกสินค้า</div>
        )}
      </section>

      {/* Popover Menu ลอยตัวด้วย Portal เหมือน SupplierScreen */}
      {mounted && activeMenuId !== null && menuPosition && activeItem && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            zIndex: 9999,
            minWidth: "130px",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <style jsx>{`
            .menu-item-btn {
              display: flex;
              align-items: center;
              gap: 8px;
              width: 100%;
              padding: 8px 12px;
              border: none;
              background: transparent;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              border-radius: 6px;
              transition: background-color 0.15s ease;
            }
            .menu-item-btn:hover {
              background-color: #f1f5f9;
            }
          `}</style>

          <button
            type="button"
            className="menu-item-btn"
            style={{ color: "#334155" }}
            onClick={() => handleOpenEdit(activeItem)}
          >
            <Pencil size={15} style={{ color: "#2563eb" }} /> แก้ไข
          </button>

          <button
            type="button"
            className="stock-menu-item-delete-btn"
            onClick={() => handleOpenDelete(activeItem)}
          >
            <Trash2 size={15} /> ลบสินค้า
          </button>
        </div>,
        document.body
      )}

      {/* Modal แก้ไขข้อมูลสินค้า */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px 24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                แก้ไขข้อมูลสินค้า
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    ชื่อสินค้า
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      ราคาขาย (บาท)
                    </label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      จำนวนสต็อก
                    </label>
                    <input
                      type="number"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    หน่วยนับ
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="เช่น ชิ้น, แพ็ค, ถุง"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#007A4D",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}