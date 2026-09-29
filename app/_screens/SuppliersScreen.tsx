"use client";

import { ArrowLeft, Building2, Edit, MessageSquare, MoreVertical, Phone, Plus, Save, Search, Trash2, AlertTriangle, X, Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AdminShell from "../_components/AdminShell";
import { PageTitle, Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type SupplierItem = {
  supplier_id?: number;
  id?: number;
  supplier_name?: string;
  name?: string;
  phone?: string | null;
  line_id?: string | null;
  lineId?: string | null;
  products_supplied?: string | null;
  productsSupplied?: string | null;
  address?: string | null;
};

type ProductItem = {
  id: number;
  name?: string;
  product_name?: string;
};

export default function SuppliersScreen() {
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  if (action === "new" || action === "edit") {
    return <AddSupplierScreen />;
  }

  return <SupplierListScreen />;
}

function SupplierListScreen() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // State สำหรับควบคุม Custom Delete Modal
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    id: number | null;
    name: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    id: null,
    name: "",
    isDeleting: false,
  });

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<SupplierItem[]>("/suppliers");
      setSuppliers(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

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
        left: Math.min(rect.right - 140, window.innerWidth - 150),
      });
      setActiveMenuId(id);
    }
  };

  const openDeleteModal = (id: number, name: string) => {
    setActiveMenuId(null);
    setMenuPosition(null);
    setDeleteModalState({
      isOpen: true,
      id,
      name,
      isDeleting: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteModalState.id) return;
    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));
    try {
      await apiFetch(`/suppliers/${deleteModalState.id}`, { method: "DELETE" });
      setDeleteModalState({ isOpen: false, id: null, name: "", isDeleting: false });
      await loadSuppliers();
    } catch (err) {
      alert(errorMessage(err));
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const filteredSuppliers = suppliers
    .filter((sup) => {
      if (!search.trim()) return true;
      const kw = search.toLowerCase();
      const name = sup.supplier_name || sup.name || "";
      const phone = sup.phone || "";
      const line = sup.line_id || sup.lineId || "";
      const products = sup.products_supplied || sup.productsSupplied || "";

      return (
        name.toLowerCase().includes(kw) ||
        phone.includes(kw) ||
        line.toLowerCase().includes(kw) ||
        products.toLowerCase().includes(kw)
      );
    })
    .sort((a, b) => {
      const nameA = (a.supplier_name || a.name || "").trim();
      const nameB = (b.supplier_name || b.name || "").trim();

      if (nameA === "ผู้จำหน่ายทั่วไป") return -1;
      if (nameB === "ผู้จำหน่ายทั่วไป") return 1;
      return 0;
    });

  const activeSupplier = suppliers.find(
    (s) => (s.supplier_id ?? s.id) === activeMenuId
  );

  return (
    <AdminShell active="suppliers">
      <PageTitle
        title="จัดการผู้จำหน่าย (Suppliers)"
        subtitle="บันทึกและตรวจสอบข้อมูลบริษัทคู่ค้าและผู้จำหน่ายวัตถุดิบ"
        action={
          <button
            type="button"
            className="primary-button"
            onClick={() => router.push("?action=new")}
            style={{
              backgroundColor: "#046c4e",
              color: "#ffffff",
              borderColor: "#046c4e",
              cursor: "pointer",
            }}
          >
            <Plus size={17} /> เพิ่มผู้จำหน่าย
          </button>
        }
      />

      <div className="stat-grid">
        <Stat label="ผู้จำหน่ายทั้งหมด" value={`${suppliers.length} ราย`} tone="neutral" />
      </div>

      <section className="data-card inventory-stock-card" style={{ marginTop: "20px" }}>
        <div className="inventory-toolbar">
          <label className="inventory-search" style={{ width: "100%", maxWidth: "360px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", color: "#94a3b8", pointerEvents: "none" }} />
            <input
              type="search"
              placeholder="ค้นหาชื่อผู้จำหน่าย, เบอร์โทร, LINE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: "36px" }}
            />
          </label>
        </div>

        {loading && <div className="api-message">กำลังโหลดข้อมูลผู้จำหน่าย...</div>}
        {error && <div className="api-message error">{error}</div>}

        <style jsx>{`
          .action-menu-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            border-radius: 8px;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.15s ease, color 0.15s ease;
          }
          .action-menu-btn:hover,
          .action-menu-btn.active {
            background-color: #f1f5f9;
            color: #0f172a;
          }
        `}</style>

        <div className="inventory-table inventory-table-single">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ชื่อผู้จำหน่าย / บริษัท</th>
                  <th>เบอร์โทรศัพท์</th>
                  <th>LINE ID</th>
                  <th>สินค้าที่จำหน่าย</th>
                  <th>ที่อยู่</th>
                  <th style={{ width: "50px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((sup) => {
                  const idVal = sup.supplier_id ?? sup.id ?? 0;
                  const nameVal = sup.supplier_name || sup.name || "ไม่ระบุชื่อ";
                  const phoneVal = sup.phone || "—";
                  const lineVal = sup.line_id || sup.lineId || "—";
                  const productVal = sup.products_supplied || sup.productsSupplied || "—";
                  const addressVal = sup.address || "—";

                  const isMenuOpen = activeMenuId === idVal;

                  return (
                    <tr key={idVal}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              backgroundColor: "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#046c4e",
                              flexShrink: 0,
                            }}
                          >
                            <Building2 size={18} />
                          </div>
                          <strong>{nameVal}</strong>
                        </div>
                      </td>
                      <td>{phoneVal}</td>
                      <td>{lineVal}</td>
                      <td>{productVal}</td>
                      <td>{addressVal}</td>

                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className={`action-menu-btn ${isMenuOpen ? "active" : ""}`}
                          onClick={(e) => handleToggleMenu(e, idVal)}
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
        </div>

        {!loading && filteredSuppliers.length === 0 && (
          <div className="api-message">ไม่พบข้อมูลผู้จำหน่าย</div>
        )}
      </section>

      {/* Popover Portal สำหรับ Action Menu */}
      {mounted && activeMenuId !== null && menuPosition && activeSupplier && createPortal(
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
            minWidth: "140px",
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
              gap: 10px;
              width: 100%;
              padding: 8px 12px;
              border: none;
              background: transparent;
              font-size: 14px;
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
            onClick={() => {
              const idVal = activeSupplier.supplier_id ?? activeSupplier.id;
              setActiveMenuId(null);
              setMenuPosition(null);
              router.push(`?action=edit&id=${idVal}`);
            }}
          >
            <Edit size={16} /> แก้ไข
          </button>

          <button
            type="button"
            className="menu-item-btn"
            style={{ color: "#ef4444", borderTop: "1px solid #f1f5f9" }}
            onClick={() => {
              const idVal = activeSupplier.supplier_id ?? activeSupplier.id ?? 0;
              const nameVal = activeSupplier.supplier_name || activeSupplier.name || "ไม่ระบุชื่อ";
              openDeleteModal(idVal, nameVal);
            }}
          >
            <Trash2 size={16} /> ลบข้อมูล
          </button>
        </div>,
        document.body
      )}

      {/* Custom Delete Confirmation Modal */}
      {mounted && deleteModalState.isOpen && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#0f172a", margin: "0 0 8px 0" }}>
              ยืนยันการลบข้อมูล
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              คุณต้องการลบผู้จัดจำหน่าย <strong>"{deleteModalState.name}"</strong> ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                disabled={deleteModalState.isDeleting}
                onClick={() => setDeleteModalState({ isOpen: false, id: null, name: "", isDeleting: false })}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "500",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleteModalState.isDeleting}
                onClick={() => void confirmDelete()}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontWeight: "500",
                  cursor: deleteModalState.isDeleting ? "not-allowed" : "pointer",
                  opacity: deleteModalState.isDeleting ? 0.7 : 1,
                  fontSize: "14px",
                }}
              >
                {deleteModalState.isDeleting ? "กำลังลบ..." : "ตกลงลบ"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AdminShell>
  );
}

function AddSupplierScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("id");

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // State สำหรับดึงสินค้าทั้งหมดจาก DB มาเป็นตัวเลือก
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [productInput, setProductInput] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    lineId: "",
    address: "",
  });

  // โหลดรายการสินค้าที่มีอยู่ในคลังสำหรับใช้ใน Autocomplete
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await apiFetch<any>("/products");
        const list: ProductItem[] = Array.isArray(res) ? res : res?.data || [];
        const names = list
          .map((p) => (p.product_name || p.name || "").trim())
          .filter(Boolean);
        // Deduplicate product names
        setAvailableProducts(Array.from(new Set(names)));
      } catch (err) {
        console.error("Failed to load products list:", err);
      }
    }
    void loadProducts();
  }, []);

  // ปิด Dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // โหลดรายละเอียดผู้จำหน่ายกรณีแก้ไข
  useEffect(() => {
    if (!supplierId) return;

    async function loadDetail() {
      setFetching(true);
      try {
        const res = await apiFetch<any>(`/suppliers/${supplierId}`).catch(async () => {
          const all = await apiFetch<SupplierItem[]>("/suppliers");
          return all.find((item) => String(item.supplier_id || item.id) === String(supplierId));
        });

        if (res) {
          setFormData({
            name: res.supplier_name || res.name || "",
            phone: res.phone || "",
            lineId: res.line_id || res.lineId || "",
            address: res.address || "",
          });

          const rawProducts = res.products_supplied || res.productsSupplied || "";
          if (rawProducts) {
            const list = rawProducts
              .split(",")
              .map((p: string) => p.trim())
              .filter(Boolean);
            setSelectedProducts(list);
          }
        }
      } catch (err) {
        alert(errorMessage(err));
      } finally {
        setFetching(false);
      }
    }
    void loadDetail();
  }, [supplierId]);

  // ฟังก์ชันเพิ่มรายการสินค้า
  const addProductItem = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    if (!selectedProducts.includes(trimmed)) {
      setSelectedProducts([...selectedProducts, trimmed]);
    }
    setProductInput("");
    setIsDropdownOpen(false);
  };

  // ฟังก์ชันลบรายการสินค้า
  const removeProductItem = (itemToRemove: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p !== itemToRemove));
  };

  // จัดการเมื่อกด Enter ในช่องกรอกสินค้า
  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (productInput.trim()) {
        addProductItem(productInput);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // รวมรายการสินค้าเป็น string เดียว คั่นด้วยจุลภาค
    const productsSuppliedStr = selectedProducts.join(", ");

    if (!formData.name.trim() || !productsSuppliedStr.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        lineId: formData.lineId,
        productsSupplied: productsSuppliedStr,
        address: formData.address,
      };

      await apiFetch(supplierId ? `/suppliers/${supplierId}` : "/suppliers", {
        method: supplierId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      router.push("/suppliers");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // รายการตัวเลือกสินค้าที่กรองตามคำค้นหา
  const filteredProductOptions = availableProducts.filter((p) =>
    p.toLowerCase().includes(productInput.toLowerCase())
  );

  const isFormInvalid = !formData.name.trim() || selectedProducts.length === 0 || saving;

  return (
    <AdminShell active="suppliers">
      <div style={{ width: "100%", padding: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#fff",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>
              {supplierId ? "แก้ไขข้อมูลผู้จำหน่าย" : "เพิ่มผู้จำหน่ายใหม่"}
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              {supplierId ? "แก้ไขรายละเอียดบริษัทคู่ค้า" : "ระบุข้อมูลบริษัทคู่ค้าสำหรับใช้ในระบบ"}
            </p>
          </div>
        </div>

        {fetching ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>กำลังโหลดข้อมูลเดิม...</div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "6px" }}>
                ชื่อบริษัท / ผู้จำหน่าย <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น บริษัท สยามฟู้ดส์ จำกัด"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "6px" }}>
                  เบอร์โทรศัพท์
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081-234-5678"
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 40px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                  <Phone size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "6px" }}>
                  LINE ID
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={formData.lineId}
                    onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                    placeholder="@supplier"
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 40px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                  <MessageSquare size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                </div>
              </div>
            </div>

            {/* ส่วนของสินค้าที่จำหน่าย (พิมพ์ค้นหา / เลือกจากระบบ / พิมพ์สร้างใหม่) */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "6px" }}>
                สินค้าที่จำหน่าย <span style={{ color: "#ef4444" }}>*</span>
              </label>

              {/* Tag/Badge แสดงสินค้าที่ถูกเลือก */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  minHeight: "44px",
                  alignItems: "center",
                  cursor: "text",
                }}
                onClick={() => setIsDropdownOpen(true)}
              >
                {selectedProducts.map((p) => (
                  <span
                    key={p}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: "#e6f4ea",
                      color: "#046c4e",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}
                  >
                    {p}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProductItem(p);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#046c4e",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={productInput}
                  onChange={(e) => {
                    setProductInput(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleProductKeyDown}
                  placeholder={selectedProducts.length === 0 ? "พิมพ์ค้นหาสินค้า เช่น น้ำตาลทรายขาว หรือพิมพ์ชื่อใหม่แล้วกด Enter..." : "พิมพ์เพิ่ม..."}
                  style={{
                    border: "none",
                    outline: "none",
                    flex: 1,
                    minWidth: "180px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                  }}
                />

                <ChevronDown size={18} style={{ color: "#94a3b8", cursor: "pointer" }} />
              </div>

              {/* Autocomplete Dropdown List */}
              {isDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "4px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    maxHeight: "220px",
                    overflowY: "auto",
                    zIndex: 50,
                  }}
                >
                  {/* หากพิมพ์ชื่อสินค้าที่ยังไม่มีในรายการ ให้แสดงปุ่มสร้างใหม่ */}
                  {productInput.trim() && !availableProducts.includes(productInput.trim()) && (
                    <button
                      type="button"
                      onClick={() => addProductItem(productInput)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        textAlign: "left",
                        border: "none",
                        borderBottom: "1px solid #f1f5f9",
                        backgroundColor: "#f0fdf4",
                        color: "#166534",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Plus size={16} />
                      <span>เพิ่ม "{productInput.trim()}" เป็นสินค้าใหม่</span>
                    </button>
                  )}

                  {filteredProductOptions.length > 0 ? (
                    filteredProductOptions.map((product) => {
                      const isSelected = selectedProducts.includes(product);
                      return (
                        <button
                          key={product}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              removeProductItem(product);
                            } else {
                              addProductItem(product);
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: isSelected ? "#f8fafc" : "#ffffff",
                            color: isSelected ? "#046c4e" : "#1e293b",
                            fontSize: "14px",
                            fontWeight: isSelected ? "600" : "400",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{product}</span>
                          {isSelected && <Check size={16} style={{ color: "#046c4e" }} />}
                        </button>
                      );
                    })
                  ) : (
                    !productInput.trim() && (
                      <div style={{ padding: "12px 14px", fontSize: "14px", color: "#94a3b8", textAlign: "center" }}>
                        ไม่พบรายการสินค้าในคลัง พิมพ์ชื่อสินค้าเพื่อเพิ่มได้ทันที
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "6px" }}>
                ที่อยู่
              </label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="ที่อยู่สำหรับออกใบเสร็จหรือจัดส่งสินค้า..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => router.back()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: "#475569",
                  fontWeight: "500",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isFormInvalid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  backgroundColor: "#046c4e",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "500",
                  cursor: isFormInvalid ? "not-allowed" : "pointer",
                  opacity: isFormInvalid ? 0.6 : 1,
                  fontSize: "14px",
                }}
              >
                <Save size={18} />
                <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminShell>
  );
}