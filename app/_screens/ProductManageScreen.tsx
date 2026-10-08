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
  AlertCircle,
  Filter,
  AlertTriangle,
} from "lucide-react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type ProductItem = {
  id: number;
  product_id?: number;
  code?: string;
  sku?: string;
  barcode?: string;
  name: string;
  product_name?: string;
  size?: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
  
  // หมวดหมู่
  categoryId?: number;
  category_id?: number;
  categoryName?: string;
  category_name?: string;
  subCategoryId?: number;
  sub_category_id?: number;
  subCategoryName?: string;
  sub_category_name?: string;

  // ราคาและสต็อก
  price: number;
  costPrice?: number;
  cost_price?: number;
  stockQuantity: number;
  stock?: number;
  minStock?: number;
  lowStockThreshold?: number;
  reorder_point?: number;
  unit: string;
  base_unit?: string;
  status?: "active" | "inactive";
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
      const [prodRes, catRes] = await Promise.all([
        apiFetch<any>("/products"),
        apiFetch<any>("/categories"),
      ]);

      // 🟢 แกะข้อมูลไม่ว่า Response จะส่งมาแบบ Array ตรงๆ หรืออยู่ใน key data / items
      const rawProducts = Array.isArray(prodRes)
        ? prodRes
        : prodRes?.data || prodRes?.items || [];
      const rawCategories = Array.isArray(catRes)
        ? catRes
        : catRes?.data || catRes?.items || [];

      // Map ข้อมูลรองรับทั้ง camelCase และ snake_case
      const normalizedProducts: ProductItem[] = rawProducts.map((item: any) => ({
        ...item,
        id: item.id || item.product_id || 0,
        name: item.name || item.product_name || "",
        code: item.code || item.barcode || item.sku || "",
        barcode: item.barcode || item.code || "",
        sku: item.sku || item.code || "",
        costPrice: item.costPrice ?? item.cost_price ?? 0,
        price: item.price ?? item.sell_price ?? 0,
        stockQuantity: item.stockQuantity ?? item.stock ?? item.quantity ?? 0,
        unit: item.unit || item.base_unit || "ชิ้น",
        categoryId: item.categoryId || item.category_id,
        categoryName: item.categoryName || item.category_name || "",
        subCategoryId: item.subCategoryId || item.sub_category_id,
        subCategoryName: item.subCategoryName || item.sub_category_name || "",
        imageUrl: item.imageUrl || item.image_url || "",
        description: item.description || "",
        minStock: item.minStock ?? item.lowStockThreshold ?? item.reorder_point ?? 5,
      }));

      setProducts(normalizedProducts);
      setCategories(rawCategories);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ย้ายหน้าไปสร้างสินค้าใหม่
  const handleGoToAddProduct = () => {
    router.push("/addproduct");
  };

  // ย้ายหน้าไปแก้ไขสินค้า
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

  // หน้ารายการแสดงเฉพาะชื่อสินค้า ส่วนหมวดหมู่ย่อยยังเก็บไว้สำหรับฟอร์มแก้ไข
  const getDisplayProductName = (prod: ProductItem) => {
    return prod.name || "";
  };

  // กรองรายการสินค้า
  const filteredProducts = products.filter((prod) => {
    const fullName = getDisplayProductName(prod).toLowerCase();
    const barcode = (prod.barcode || "").toLowerCase();
    const sku = (prod.sku || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      fullName.includes(search) || barcode.includes(search) || sku.includes(search);

    const matchesCategory =
      selectedCategoryFilter === "all" ||
      (prod.categoryId && String(prod.categoryId) === selectedCategoryFilter);

    return matchesSearch && matchesCategory;
  });

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
            placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด หรือ SKU..."
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
                  <th style={{ textAlign: "left" }}>บาร์โค้ด / SKU / รูป</th>
                  <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                  <th style={{ textAlign: "left" }}>หมวดหมู่</th>
                  <th style={{ textAlign: "right" }}>ราคาทุน</th>
                  <th style={{ textAlign: "right" }}>ราคาขาย</th>
                  <th style={{ textAlign: "center" }}>คงเหลือ</th>
                  <th style={{ width: "120px", textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      กำลังโหลดข้อมูลสินค้า...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      ไม่พบรายการสินค้าที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const isLowStock =
                      prod.minStock !== undefined && prod.stockQuantity <= prod.minStock;
                    const displayName = getDisplayProductName(prod);

                    return (
                      <tr key={prod.id}>
                        <td style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {prod.imageUrl ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                  border: "1px solid #e2e8f0",
                                }}
                              />
                            ) : (
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
                            )}
                            <div>
                              <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "13px" }}>
                                {prod.barcode || "-"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                SKU: {prod.sku || "-"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "left", fontWeight: "600", color: "#0f172a", fontSize: "14px" }}>
                          {displayName}
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