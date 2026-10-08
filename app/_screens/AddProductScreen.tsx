// "use client";

// import { ArrowLeft, ImagePlus, AlertCircle, Save, X, RefreshCw, Bell } from "lucide-react";
// import { useState, ChangeEvent, FormEvent, useEffect, useCallback, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import AdminShell from "../_components/AdminShell";
// import { apiFetch, errorMessage } from "../_lib/api";

// type AddProductScreenProps = {
//   parentId?: number | null;
//   onBack?: () => void;
// };

// type SubCategoryItem = {
//   id: number;
//   name: string;
// };

// type CategoryItem = {
//   id: number;
//   name: string;
//   subCategories?: SubCategoryItem[];
//   sub_categories?: SubCategoryItem[];
// };

// type SupplierItem = {
//   id: number;
//   name: string;
// };

// const generateRandomSKU = () => {
//   const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
//   let randomLetters = "";
//   for (let i = 0; i < 3; i++) {
//     randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
//   }
//   const randomNumbers = Math.floor(10000 + Math.random() * 90000);
//   return `${randomLetters}-${randomNumbers}`;
// };

// function AddProductForm({ parentId, onBack }: AddProductScreenProps) {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const editId = searchParams.get("id");

//   // --- หมวดหมู่ ---
//   const [categories, setCategories] = useState<CategoryItem[]>([]);
//   const [selectedCategoryId, setSelectedCategoryId] = useState("");
//   const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
//   const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
//   const [selectedSupplierId, setSelectedSupplierId] = useState("");

//   // --- ข้อมูลสินค้า ---
//   const [name, setName] = useState("");
//   const [sku, setSku] = useState("");
//   const [barcode, setBarcode] = useState("");
//   const [description, setDescription] = useState("");
//   const [imagePreview, setImagePreview] = useState<string | null>(null);
//   const [imageChanged, setImageChanged] = useState(false);

//   // --- ราคาและสต็อก ---
//   const [costPrice, setCostPrice] = useState("");
//   const [price, setPrice] = useState("");
//   const [unit, setUnit] = useState("ชิ้น");
//   const [stockQuantity, setStockQuantity] = useState("");
  
//   // --- การแจ้งเตือนสต็อก ---
//   const [enableNotification, setEnableNotification] = useState(true);
//   const [lowStockThreshold, setLowStockThreshold] = useState("5");

//   // State
//   const [saving, setSaving] = useState(false);
//   const [loadingData, setLoadingData] = useState(false);
//   const [error, setError] = useState("");

//   const unitOptions = [
//     "ชิ้น", "กิโลกรัม", "ถุง", "แพ็ค", "กล่อง", 
//     "โหล", "ขวด", "กระป๋อง", "ลิตร", "ตัว", "ชุด",
//   ];

//   useEffect(() => {
//     const fetchCategories = async () => {
//       try {
//         const res = await apiFetch<any>("/categories");
//         const list = Array.isArray(res) ? res : res?.data || [];
//         setCategories(list);
//       } catch (err) {
//         console.error("Failed to load categories:", err);
//       }
//     };
//     void fetchCategories();
//   }, []);

//   useEffect(() => {
//     const fetchSuppliers = async () => {
//       try {
//         const data = await apiFetch<SupplierItem[]>("/suppliers");
//         setSuppliers(data);
//       } catch (err) {
//         console.error("Failed to load suppliers:", err);
//       }
//     };
//     void fetchSuppliers();
//   }, []);

//   const handleRandomizeSKU = useCallback(() => {
//     setSku(generateRandomSKU());
//   }, []);

//   useEffect(() => {
//     if (!editId) {
//       handleRandomizeSKU();
//     }
//   }, [editId, handleRandomizeSKU]);

//   // โหลดข้อมูลสินค้าเดิมกรณีแก้ไข
//   useEffect(() => {
//     if (editId) {
//       const fetchProductDetail = async () => {
//         setLoadingData(true);
//         setError("");
//         try {
//           const res = await apiFetch<any>(`/products/${editId}`);
//           const data = res?.data || res;
          
//           if (data) {
//             // setName(data.rawName || data.product_name || data.name || "")
//             setName(data.product_name || data.name || "")
//             setSku(data.sku || "");
//             setBarcode(data.barcode || data.code || "");
//             setDescription(data.description || "");
//             setImagePreview(data.image_url || data.imageUrl || null);
//             setImageChanged(false);

//             if (data.category_id || data.categoryId) {
//               setSelectedCategoryId(String(data.category_id || data.categoryId));
//             }
//             if (data.sub_category_id || data.subCategoryId) {
//               setSelectedSubCategoryId(String(data.sub_category_id || data.subCategoryId));
//             }
//             setSelectedSupplierId(
//               data.supplier_id || data.supplierId ? String(data.supplier_id || data.supplierId) : ""
//             );

//             const costVal = data.cost_price ?? data.costPrice;
//             setCostPrice(costVal !== undefined && costVal !== null ? String(costVal) : "0");

//             const priceVal = data.price ?? data.sell_price;
//             setPrice(priceVal !== undefined && priceVal !== null ? String(priceVal) : "");

//             setUnit(data.base_unit || data.unit || "ชิ้น");

//             const stockVal = data.stockQuantity ?? data.stock ?? data.quantity;
//             setStockQuantity(stockVal !== undefined && stockVal !== null ? String(stockVal) : "0");

//             const reorderVal = data.reorder_point ?? data.lowStockThreshold;
//             setLowStockThreshold(reorderVal !== undefined && reorderVal !== null ? String(reorderVal) : "5");
            
//             if (data.is_notify !== undefined) setEnableNotification(Boolean(data.is_notify));
//           }
//         } catch (err) {
//           setError("ไม่สามารถดึงข้อมูลสินค้าได้: " + errorMessage(err));
//         } finally {
//           setLoadingData(false);
//         }
//       };
//       void fetchProductDetail();
//     }
//   }, [editId]);

//   const activeMainCategory = categories.find(
//     (c) => String(c.id) === selectedCategoryId
//   );
//   const availableSubCategories =
//     activeMainCategory?.subCategories || activeMainCategory?.sub_categories || [];

//   const handleMainCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
//     setSelectedCategoryId(e.target.value);
//     setSelectedSubCategoryId("");
//   };

//   const handleBack = () => {
//     if (onBack) {
//       onBack();
//     } else {
//       router.back();
//     }
//   };

//   const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         setImagePreview(reader.result as string);
//         setImageChanged(true);
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (!selectedCategoryId) {
//       setError("กรุณาเลือกหมวดหมู่หลัก");
//       return;
//     }
//     if (!name.trim()) {
//       setError("กรุณากรอกชื่อสินค้า / ยี่ห้อ / รุ่น");
//       return;
//     }
//     if (!barcode.trim()) {
//       setError("กรุณากรอกบาร์โค้ดสินค้า");
//       return;
//     }
//     if (!price) {
//       setError("กรุณากรอกราคาขาย");
//       return;
//     }

//     setSaving(true);
//     setError("");

//     const payload = {
//       name: name.trim(),
//       categoryId: Number(selectedCategoryId),
//       subCategoryId: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
//       supplierId: selectedSupplierId ? Number(selectedSupplierId) : null,
//       sku: sku.trim().toUpperCase(),
//       barcode: barcode.trim(),
//       description: description.trim() || null,
//       ...(editId ? (imageChanged ? { imageData: imagePreview } : {}) : { imageData: imagePreview }),
//       costPrice: costPrice ? Number(costPrice) : 0,
//       price: Number(price),
//       unit: unit,
//       stockQuantity: Number(stockQuantity || 0),
//       lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 5,
//     };

//     try {
//       if (editId) {
//         await apiFetch(`/products/${editId}`, {
//           method: "PATCH",
//           body: JSON.stringify(payload),
//         });
//       } else {
//         await apiFetch("/products", {
//           method: "POST",
//           body: JSON.stringify(payload),
//         });
//       }

//       if (onBack) {
//        onBack();
//       } else {
//        router.replace("/productmanage");
//       }
//     } catch (err) {
//       setError(errorMessage(err));
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (loadingData) {
//     return (
//       <AdminShell active="productmanage">
//         <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
//           กำลังโหลดข้อมูลสินค้า...
//         </div>
//       </AdminShell>
//     );
//   }

//   return (
//     <AdminShell active="productmanage">
//       <div
//         style={{
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "space-between",
//           marginBottom: "24px",
//         }}
//       >
//         <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
//           <button
//             type="button"
//             onClick={handleBack}
//             style={{
//               width: "42px",
//               height: "42px",
//               borderRadius: "10px",
//               backgroundColor: "#ffffff",
//               border: "1px solid #e2e8f0",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               color: "#0f172a",
//               cursor: "pointer",
//             }}
//           >
//             <ArrowLeft size={20} />
//           </button>
//           <div>
//             <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
//               {editId ? `แก้ไขสินค้า: ${name}` : "เพิ่มสินค้าใหม่"}
//             </h1>
//             <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
//               กรอกข้อมูลสินค้า หมวดหมู่ ราคา และจำนวนสต็อก
//             </p>
//           </div>
//         </div>
//       </div>

//       <form
//         onSubmit={handleSubmit}
//         style={{
//           maxWidth: "880px",
//           display: "flex",
//           flexDirection: "column",
//           gap: "24px",
//         }}
//       >
//         {error && (
//           <div
//             style={{
//               padding: "12px 16px",
//               backgroundColor: "#fef2f2",
//               border: "1px solid #fecaca",
//               color: "#dc2626",
//               borderRadius: "10px",
//               fontSize: "14px",
//               display: "flex",
//               alignItems: "center",
//               gap: "8px",
//             }}
//           >
//             <AlertCircle size={18} />
//             <span>{error}</span>
//           </div>
//         )}

//         {/* SECTION 1: ข้อมูลสินค้า */}
//         <div
//           style={{
//             backgroundColor: "#ffffff",
//             borderRadius: "16px",
//             padding: "24px",
//             border: "1px solid #f1f5f9",
//           }}
//         >
//           <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
//             1. ข้อมูลสินค้า
//           </h3>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 หมวดหมู่หลัก <span style={{ color: "#ef4444" }}>*</span>
//               </label>
//               <select
//                 value={selectedCategoryId}
//                 onChange={handleMainCategoryChange}
//                 required
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                   backgroundColor: "#ffffff",
//                   outline: "none",
//                 }}
//               >
//                 <option value="">-- เลือกหมวดหมู่หลัก --</option>
//                 {categories.map((cat) => (
//                   <option key={cat.id} value={cat.id}>
//                     {cat.name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 หมวดหมู่ย่อย
//               </label>
//               <select
//                 value={selectedSubCategoryId}
//                 onChange={(e) => setSelectedSubCategoryId(e.target.value)}
//                 disabled={!selectedCategoryId}
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                   backgroundColor: !selectedCategoryId ? "#f8fafc" : "#ffffff",
//                   outline: "none",
//                 }}
//               >
//                 <option value="">-- เลือกหมวดหมู่ย่อย --</option>
//                 {availableSubCategories.map((sub) => (
//                   <option key={sub.id} value={sub.id}>
//                     {sub.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div style={{ marginBottom: "16px" }}>
//             <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//               ผู้จำหน่าย
//             </label>
//             <select
//               value={selectedSupplierId}
//               onChange={(e) => setSelectedSupplierId(e.target.value)}
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 borderRadius: "8px",
//                 border: "1px solid #cbd5e1",
//                 fontSize: "14px",
//                 backgroundColor: "#ffffff",
//                 outline: "none",
//               }}
//             >
//               <option value="">-- ไม่ระบุผู้จำหน่าย --</option>
//               {suppliers.map((supplier) => (
//                 <option key={supplier.id} value={supplier.id}>
//                   {supplier.name}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div style={{ marginBottom: "16px" }}>
//             <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//               ชื่อสินค้า / ยี่ห้อ / รุ่น <span style={{ color: "#ef4444" }}>*</span>
//             </label>
//             <input
//               type="text"
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               placeholder="เช่น น้ำตาลทรายแดง ตราดาว 1 กก."
//               required
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 borderRadius: "8px",
//                 border: "1px solid #cbd5e1",
//                 fontSize: "14px",
//               }}
//             />
//           </div>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 รหัส SKU
//               </label>
//               <div style={{ display: "flex", gap: "8px" }}>
//                 <input
//                   type="text"
//                   value={sku}
//                   onChange={(e) => setSku(e.target.value.toUpperCase())}
//                   placeholder="เช่น HUK-33342"
//                   style={{
//                     width: "100%",
//                     padding: "10px 12px",
//                     borderRadius: "8px",
//                     border: "1px solid #cbd5e1",
//                     fontSize: "14px",
//                     fontWeight: "600",
//                     textTransform: "uppercase",
//                     backgroundColor: "#f8fafc",
//                   }}
//                 />
//                 <button
//                   type="button"
//                   onClick={handleRandomizeSKU}
//                   title="สุ่ม SKU"
//                   style={{
//                     padding: "0 12px",
//                     backgroundColor: "#ffffff",
//                     border: "1px solid #cbd5e1",
//                     borderRadius: "8px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   <RefreshCw size={16} />
//                 </button>
//               </div>
//             </div>

//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 บาร์โค้ด <span style={{ color: "#ef4444" }}>*</span>
//               </label>
//               <input
//                 type="text"
//                 value={barcode}
//                 onChange={(e) => setBarcode(e.target.value)}
//                 placeholder="เช่น 8850123456789"
//                 required
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                 }}
//               />
//             </div>
//           </div>

//           <div style={{ marginBottom: "16px" }}>
//             <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//               รายละเอียดสินค้าเพิ่มเติม
//             </label>
//             <textarea
//               value={description}
//               onChange={(e) => setDescription(e.target.value)}
//               placeholder="กรอกรายละเอียดเพิ่มเติมเกี่ยวกับสินค้า..."
//               rows={3}
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 borderRadius: "8px",
//                 border: "1px solid #cbd5e1",
//                 fontSize: "14px",
//                 fontFamily: "inherit",
//                 resize: "vertical",
//                 boxSizing: "border-box",
//               }}
//             />
//           </div>

//           <div>
//             <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//               รูปภาพสินค้า (image_url)
//             </label>
//             {imagePreview ? (
//               <div style={{ position: "relative", width: "120px", height: "120px" }}>
//                 <img
//                   src={imagePreview}
//                   alt="Preview"
//                   style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0" }}
//                 />
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setImagePreview(null);
//                     setImageChanged(true);
//                   }}
//                   style={{
//                     position: "absolute",
//                     top: "-8px",
//                     right: "-8px",
//                     backgroundColor: "#ef4444",
//                     color: "#fff",
//                     border: "none",
//                     borderRadius: "50%",
//                     width: "24px",
//                     height: "24px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   <X size={14} />
//                 </button>
//               </div>
//             ) : (
//               <label
//                 style={{
//                   display: "flex",
//                   flexDirection: "column",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   width: "140px",
//                   height: "120px",
//                   border: "2px dashed #cbd5e1",
//                   borderRadius: "10px",
//                   backgroundColor: "#f8fafc",
//                   cursor: "pointer",
//                 }}
//               >
//                 <ImagePlus size={28} style={{ color: "#94a3b8", marginBottom: "4px" }} />
//                 <span style={{ fontSize: "12px", color: "#64748b" }}>เพิ่มรูปสินค้า</span>
//                 <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
//               </label>
//             )}
//           </div>
//         </div>

//         {/* SECTION 2: ราคาและจำนวนสต็อก */}
//         <div
//           style={{
//             backgroundColor: "#ffffff",
//             borderRadius: "16px",
//             padding: "24px",
//             border: "1px solid #f1f5f9",
//           }}
//         >
//           <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
//             2. ราคาและจำนวนสต็อก
//           </h3>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 ราคาทุน (บาท)
//               </label>
//               <input
//                 type="number"
//                 step="0.01"
//                 value={costPrice}
//                 onChange={(e) => setCostPrice(e.target.value)}
//                 placeholder="0.00"
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                 }}
//               />
//             </div>

//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 ราคาขาย (บาท) <span style={{ color: "#ef4444" }}>*</span>
//               </label>
//               <input
//                 type="number"
//                 step="0.01"
//                 value={price}
//                 onChange={(e) => setPrice(e.target.value)}
//                 placeholder="0.00"
//                 required
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                 }}
//               />
//             </div>
//           </div>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 หน่วยนับ (base_unit) <span style={{ color: "#ef4444" }}>*</span>
//               </label>
//               <select
//                 value={unit}
//                 onChange={(e) => setUnit(e.target.value)}
//                 required
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                   backgroundColor: "#fff",
//                 }}
//               >
//                 {unitOptions.map((opt) => (
//                   <option key={opt} value={opt}>
//                     {opt}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 จำนวนสต็อกเริ่มต้น
//               </label>
//               <input
//                 type="number"
//                 value={stockQuantity}
//                 onChange={(e) => setStockQuantity(e.target.value)}
//                 placeholder="0"
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                 }}
//               />
//             </div>
//           </div>
//         </div>

//         {/* SECTION 3: การจัดการแจ้งเตือนสต็อก */}
//         <div
//           style={{
//             backgroundColor: "#ffffff",
//             borderRadius: "16px",
//             padding: "24px",
//             border: "1px solid #f1f5f9",
//           }}
//         >
//           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
//             <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
//               <Bell size={18} style={{ color: "#046c4e" }} />
//               3. การจัดการแจ้งเตือนสต็อก
//             </h3>

//             <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
//               <input
//                 type="checkbox"
//                 checked={enableNotification}
//                 onChange={(e) => setEnableNotification(e.target.checked)}
//                 style={{ width: "18px", height: "18px", accentColor: "#046c4e", cursor: "pointer" }}
//               />
//               เปิดการแจ้งเตือนสินค้าใกล้หมด
//             </label>
//           </div>

//           {enableNotification && (
//             <div style={{ maxWidth: "400px", marginTop: "12px" }}>
//               <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
//                 จุดสั่งซื้อเติมสต็อก (reorder_point)
//               </label>
//               <input
//                 type="number"
//                 value={lowStockThreshold}
//                 onChange={(e) => setLowStockThreshold(e.target.value)}
//                 placeholder="5"
//                 style={{
//                   width: "100%",
//                   padding: "10px 12px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   fontSize: "14px",
//                 }}
//               />
//               <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
//                 ระบบจะแจ้งเตือนเมื่อสินค้าเหลือเท่ากับหรือน้อยกว่าจำนวนนี้
//               </span>
//             </div>
//           )}
//         </div>

//         {/* ปุ่มบันทึก */}
//         <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
//           <button
//             type="button"
//             onClick={handleBack}
//             style={{
//               padding: "10px 20px",
//               backgroundColor: "#ffffff",
//               color: "#475569",
//               borderRadius: "10px",
//               border: "1px solid #cbd5e1",
//               fontSize: "14px",
//               fontWeight: "600",
//               cursor: "pointer",
//             }}
//           >
//             ยกเลิก
//           </button>

//           <button
//             type="submit"
//             disabled={saving}
//             style={{
//               display: "inline-flex",
//               alignItems: "center",
//               gap: "8px",
//               padding: "10px 24px",
//               backgroundColor: "#046c4e",
//               color: "#ffffff",
//               borderRadius: "10px",
//               border: "none",
//               fontSize: "14px",
//               fontWeight: "600",
//               cursor: saving ? "not-allowed" : "pointer",
//             }}
//           >
//             <Save size={18} />
//             <span>{saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "บันทึกข้อมูลสินค้า"}</span>
//           </button>
//         </div>
//       </form>
//     </AdminShell>
//   );
// }

// export default function AddProductScreen(props: AddProductScreenProps) {
//   return (
//     <Suspense fallback={<div>Loading...</div>}>
//       <AddProductForm {...props} />
//     </Suspense>
//   );
// }





"use client";

import { ArrowLeft, ImagePlus, AlertCircle, Save, X, RefreshCw, Bell } from "lucide-react";
import { useState, ChangeEvent, FormEvent, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type AddProductScreenProps = {
  parentId?: number | null;
  onBack?: () => void;
};

type SubCategoryItem = {
  id: number;
  name: string;
};

type CategoryItem = {
  id: number;
  name: string;
  subCategories?: SubCategoryItem[];
  sub_categories?: SubCategoryItem[];
};

type SupplierItem = {
  id: number;
  name: string;
};

const generateRandomSKU = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomLetters = "";
  for (let i = 0; i < 3; i++) {
    randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  const randomNumbers = Math.floor(10000 + Math.random() * 90000);
  return `${randomLetters}-${randomNumbers}`;
};

function AddProductForm({ parentId, onBack }: AddProductScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  // --- หมวดหมู่ ---
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  // --- ข้อมูลสินค้า ---
  const [name, setName] = useState("");

  // --- ข้อมูลสินค้า (แยก ชื่อสินค้า/ยี่ห้อ กับ ขนาดบรรจุ) ---
  const [productBrandName, setProductBrandName] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);

  // --- ราคาและสต็อก ---
  const [costPrice, setCostPrice] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [stockQuantity, setStockQuantity] = useState("");
  
  // --- การแจ้งเตือนสต็อก ---
  const [enableNotification, setEnableNotification] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  // State
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  const unitOptions = [
    "ชิ้น", "กิโลกรัม", "ถุง", "แพ็ค", "กล่อง", 
    "โหล", "ขวด", "กระป๋อง", "ลิตร", "ตัว", "ชุด",
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiFetch<any>("/categories");
        const list = Array.isArray(res) ? res : res?.data || [];
        setCategories(list);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    void fetchCategories();
  }, []);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const data = await apiFetch<SupplierItem[]>("/suppliers");
        setSuppliers(data);
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    };
    void fetchSuppliers();
  }, []);

  const handleRandomizeSKU = useCallback(() => {
    setSku(generateRandomSKU());
  }, []);

  useEffect(() => {
    if (!editId) {
      handleRandomizeSKU();
    }
  }, [editId, handleRandomizeSKU]);

  // โหลดข้อมูลสินค้าเดิมกรณีแก้ไข
  useEffect(() => {
    if (editId) {
      const fetchProductDetail = async () => {
        setLoadingData(true);
        setError("");
        try {
          const res = await apiFetch<any>(`/products/${editId}`);
          const data = res?.data || res;
          
          if (data) {
            setName(data.product_name || data.name || "");
            const rawName = data.product_name || data.name || "";
            // แยกชื่อสินค้าและขนาดบรรจุ หากมีระบุในชื่อเดิม
            const packageMatch = rawName.match(/(.*?)\s*(\d+(?:[.,]\d+)?\s?(?:กก\.?|กิโลกรัม|กรัม|มล\.?|มิลลิลิตร|ลิตร|kg|g|ml|l).*)$/i);
            if (packageMatch) {
              setProductBrandName(packageMatch[1].trim());
              setPackageSize(packageMatch[2].trim());
            } else {
              setProductBrandName(rawName);
              setPackageSize("");
            }

            setSku(data.sku || "");
            setBarcode(data.barcode || data.code || "");
            setDescription(data.description || "");
            setImagePreview(data.image_url || data.imageUrl || null);
            setImageChanged(false);

            if (data.category_id || data.categoryId) {
              setSelectedCategoryId(String(data.category_id || data.categoryId));
            }
            if (data.sub_category_id || data.subCategoryId) {
              setSelectedSubCategoryId(String(data.sub_category_id || data.subCategoryId));
            }
            
            // หากมี supplier_id ให้ใส่ค่านั้น หากไม่มี ให้หา ID ของ "ผู้จำหน่ายทั่วไป"
            const currentSupplierId = data.supplier_id || data.supplierId;
            if (currentSupplierId) {
              setSelectedSupplierId(String(currentSupplierId));
            } else {
              const defaultSupplier = suppliers.find((s) => s.name.includes("ทั่วไป"));
              if (defaultSupplier) {
                setSelectedSupplierId(String(defaultSupplier.id));
              }
            }

            const costVal = data.cost_price ?? data.costPrice;
            setCostPrice(costVal !== undefined && costVal !== null ? String(costVal) : "0");

            const priceVal = data.price ?? data.sell_price;
            setPrice(priceVal !== undefined && priceVal !== null ? String(priceVal) : "");

            setUnit(data.base_unit || data.unit || "ชิ้น");

            const stockVal = data.stockQuantity ?? data.stock ?? data.quantity;
            setStockQuantity(stockVal !== undefined && stockVal !== null ? String(stockVal) : "0");

            const reorderVal = data.reorder_point ?? data.lowStockThreshold;
            setLowStockThreshold(reorderVal !== undefined && reorderVal !== null ? String(reorderVal) : "5");
            
            if (data.is_notify !== undefined) setEnableNotification(Boolean(data.is_notify));
          }
        } catch (err) {
          setError("ไม่สามารถดึงข้อมูลสินค้าได้: " + errorMessage(err));
        } finally {
          setLoadingData(false);
        }
      };
      void fetchProductDetail();
    }
  }, [editId, suppliers]);
  }, [editId]);

  const activeMainCategory = categories.find(
    (c) => String(c.id) === selectedCategoryId
  );
  const availableSubCategories =
    activeMainCategory?.subCategories || activeMainCategory?.sub_categories || [];

  const handleMainCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryId(e.target.value);
    setSelectedSubCategoryId("");
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setImageChanged(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      setError("กรุณาเลือกหมวดหมู่หลัก");
      return;
    }
    if (!name.trim()) {
      setError("กรุณากรอกชื่อสินค้า / ยี่ห้อ / รุ่น");
    if (!productBrandName.trim()) {
      setError("กรุณากรอกชื่อสินค้า / ยี่ห้อ");
      return;
    }
    if (!barcode.trim()) {
      setError("กรุณากรอกบาร์โค้ดสินค้า");
      return;
    }
    if (!price) {
      setError("กรุณากรอกราคาขาย");
      return;
    }

    setSaving(true);
    setError("");

    // หา ID ของผู้จำหน่ายทั่วไป กรณีที่ไม่ได้เลือกผู้จำหน่ายเจาะจง
    const defaultSupplier = suppliers.find((s) => s.name.includes("ทั่วไป"));
    const finalSupplierId = selectedSupplierId
      ? Number(selectedSupplierId)
      : defaultSupplier
      ? defaultSupplier.id
      : null;

    const payload = {
      name: name.trim(),
      categoryId: Number(selectedCategoryId),
      subCategoryId: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
      supplierId: finalSupplierId,
    // รวมชื่อสินค้าและขนาดบรรจุเข้าด้วยกัน
    const fullName = packageSize.trim()
      ? `${productBrandName.trim()} ${packageSize.trim()}`
      : productBrandName.trim();

    const payload = {
      name: fullName,
      categoryId: Number(selectedCategoryId),
      subCategoryId: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
      supplierId: null,
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim(),
      description: description.trim() || null,
      ...(editId ? (imageChanged ? { imageData: imagePreview } : {}) : { imageData: imagePreview }),
      costPrice: costPrice ? Number(costPrice) : 0,
      price: Number(price),
      unit: unit,
      stockQuantity: Number(stockQuantity || 0),
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 5,
    };

    try {
      if (editId) {
        await apiFetch(`/products/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (onBack) {
        onBack();
      } else {
        router.replace("/productmanage");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <AdminShell active="productmanage">
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
        <div className="ap-loading-container">
          กำลังโหลดข้อมูลสินค้า...
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="productmanage">
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
            onClick={handleBack}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {editId ? `แก้ไขสินค้า: ${name}` : "เพิ่มสินค้าใหม่"}
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
      <div className="ap-header">
        <div className="ap-header-left">
          <button type="button" onClick={handleBack} className="ap-back-button">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="ap-title">
              {editId ? `แก้ไขสินค้า: ${productBrandName}` : "เพิ่มสินค้าใหม่"}
            </h1>
            <p className="ap-subtitle">
              กรอกข้อมูลสินค้า หมวดหมู่ ราคา และจำนวนสต็อก
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "880px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {error && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: "10px",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
      <form onSubmit={handleSubmit} className="ap-form">
        {error && (
          <div className="ap-alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1: ข้อมูลสินค้า */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
            1. ข้อมูลสินค้า
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                หมวดหมู่หลัก <span style={{ color: "#ef4444" }}>*</span>
        <div className="ap-section-card">
          <h3 className="ap-section-title">
            1. ข้อมูลสินค้า
          </h3>

          <div className="ap-grid-2col">
            <div>
              <label className="ap-label">
                หมวดหมู่หลัก <span className="ap-required">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={handleMainCategoryChange}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  backgroundColor: "#ffffff",
                  outline: "none",
                }}
                className="ap-select"
              >
                <option value="">-- เลือกหมวดหมู่หลัก --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              <label className="ap-label">
                หมวดหมู่ย่อย
              </label>
              <select
                value={selectedSubCategoryId}
                onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                disabled={!selectedCategoryId}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  backgroundColor: !selectedCategoryId ? "#f8fafc" : "#ffffff",
                  outline: "none",
                }}
                className="ap-select"
              >
                <option value="">-- เลือกหมวดหมู่ย่อย --</option>
                {availableSubCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              ผู้จำหน่าย
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                backgroundColor: "#ffffff",
                outline: "none",
              }}
            >
              {/* ตัวเลือกเริ่มต้นแบบไม่มีเครื่องหมายขีด */}
              <option value="">ผู้จำหน่ายทั่วไป</option>
              
              {/* กรอง "ผู้จำหน่ายทั่วไป" ออกเพื่อไม่ให้แสดงซ้ำข้างล่าง */}
              {suppliers
                .filter((supplier) => !supplier.name.includes("ผู้จำหน่ายทั่วไป"))
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              ชื่อสินค้า / ยี่ห้อ / รุ่น <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น น้ำตาลทรายแดง ตราดาว 1 กก."
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                รหัส SKU
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
          {/* ช่องกรอกชื่อสินค้า / ยี่ห้อ และ ขนาดบรรจุ แยกจากกัน */}
          <div className="ap-grid-2col">
            <div>
              <label className="ap-label">
                ชื่อสินค้า / ยี่ห้อ <span className="ap-required">*</span>
              </label>
              <input
                type="text"
                value={productBrandName}
                onChange={(e) => setProductBrandName(e.target.value)}
                placeholder="เช่น น้ำตาลทรายแดง ตราดาว"
                required
                className="ap-input"
              />
            </div>

            <div>
              <label className="ap-label">
                ขนาดบรรจุ
              </label>
              <input
                type="text"
                value={packageSize}
                onChange={(e) => setPackageSize(e.target.value)}
                placeholder="เช่น 1 กก. หรือ 72 กรัม"
                className="ap-input"
              />
            </div>
          </div>

          <div className="ap-grid-2col">
            <div>
              <label className="ap-label">
                รหัส SKU
              </label>
              <div className="ap-sku-wrapper">
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="เช่น HUK-33342"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    backgroundColor: "#f8fafc",
                  }}
                  className="ap-input ap-input-sku"
                />
                <button
                  type="button"
                  onClick={handleRandomizeSKU}
                  title="สุ่ม SKU"
                  style={{
                    padding: "0 12px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                  className="ap-btn-random-sku"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                บาร์โค้ด <span style={{ color: "#ef4444" }}>*</span>
              <label className="ap-label">
                บาร์โค้ด <span className="ap-required">*</span>
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="เช่น 8850123456789"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
                className="ap-input"
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
          <div className="ap-field-group">
            <label className="ap-label">
              รายละเอียดสินค้าเพิ่มเติม
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="กรอกรายละเอียดเพิ่มเติมเกี่ยวกับสินค้า..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              className="ap-textarea"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              รูปภาพสินค้า (image_url)
            </label>
            {imagePreview ? (
              <div style={{ position: "relative", width: "120px", height: "120px" }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0" }}
            <label className="ap-label">
              รูปภาพสินค้า (image_url)
            </label>
            {imagePreview ? (
              <div className="ap-image-preview-container">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="ap-image-preview-img"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageChanged(true);
                  }}
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                  }}
                  className="ap-btn-remove-image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "140px",
                  height: "120px",
                  border: "2px dashed #cbd5e1",
                  borderRadius: "10px",
                  backgroundColor: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                <ImagePlus size={28} style={{ color: "#94a3b8", marginBottom: "4px" }} />
                <span style={{ fontSize: "12px", color: "#64748b" }}>เพิ่มรูปสินค้า</span>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
              <label className="ap-image-upload-label">
                <ImagePlus size={28} className="ap-image-upload-icon" />
                <span className="ap-image-upload-text">เพิ่มรูปสินค้า</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="ap-hidden-file-input" />
              </label>
            )}
          </div>
        </div>

        {/* SECTION 2: ราคาและจำนวนสต็อก */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
            2. ราคาและจำนวนสต็อก
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
        <div className="ap-section-card">
          <h3 className="ap-section-title">
            2. ราคาและจำนวนสต็อก
          </h3>

          <div className="ap-grid-2col">
            <div>
              <label className="ap-label">
                ราคาทุน (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
                className="ap-input"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                ราคาขาย (บาท) <span style={{ color: "#ef4444" }}>*</span>
              <label className="ap-label">
                ราคาขาย (บาท) <span className="ap-required">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
                className="ap-input"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                หน่วยนับ (base_unit) <span style={{ color: "#ef4444" }}>*</span>
          <div className="ap-grid-2col" style={{ marginBottom: 0 }}>
            <div>
              <label className="ap-label">
                หน่วยนับ (base_unit) <span className="ap-required">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                }}
                className="ap-select"
              >
                {unitOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              <label className="ap-label">
                จำนวนสต็อกเริ่มต้น
              </label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
                className="ap-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: การจัดการแจ้งเตือนสต็อก */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            border: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={18} style={{ color: "#046c4e" }} />
              3. การจัดการแจ้งเตือนสต็อก
            </h3>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
        <div className="ap-section-card">
          <div className="ap-notification-header">
            <h3 className="ap-section-title" style={{ margin: 0 }}>
              <Bell size={18} className="ap-bell-icon" />
              3. การจัดการแจ้งเตือนสต็อก
            </h3>

            <label className="ap-checkbox-label">
              <input
                type="checkbox"
                checked={enableNotification}
                onChange={(e) => setEnableNotification(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#046c4e", cursor: "pointer" }}
                className="ap-checkbox"
              />
              เปิดการแจ้งเตือนสินค้าใกล้หมด
            </label>
          </div>

          {enableNotification && (
            <div style={{ maxWidth: "400px", marginTop: "12px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
            <div className="ap-reorder-container">
              <label className="ap-label">
                จุดสั่งซื้อเติมสต็อก (reorder_point)
              </label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="5"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
              />
              <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
                className="ap-input"
              />
              <span className="ap-field-note">
                ระบบจะแจ้งเตือนเมื่อสินค้าเหลือเท่ากับหรือน้อยกว่าจำนวนนี้
              </span>
            </div>
          )}
        </div>

        {/* ปุ่มบันทึก */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ffffff",
              color: "#475569",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
        <div className="ap-form-actions">
          <button
            type="button"
            onClick={handleBack}
            className="ap-btn-cancel"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 24px",
              backgroundColor: "#046c4e",
              color: "#ffffff",
              borderRadius: "10px",
              border: "none",
              fontSize: "14px",
              fontWeight: "600",
              cursor: saving ? "not-allowed" : "pointer",
            }}
            className="ap-btn-submit"
          >
            <Save size={18} />
            <span>{saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "บันทึกข้อมูลสินค้า"}</span>
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

export default function AddProductScreen(props: AddProductScreenProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AddProductForm {...props} />
    </Suspense>
  );
}