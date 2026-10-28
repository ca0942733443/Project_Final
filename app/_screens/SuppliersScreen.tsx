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
        title="จัดการผู้จำหน่าย"
        subtitle="บันทึกและตรวจสอบข้อมูลบริษัทคู่ค้าและผู้จำหน่ายวัตถุดิบ"
        action={
          <button
            type="button"
            className="primary-button sup-primary-btn"
            onClick={() => router.push("?action=new")}
          >
            <Plus size={17} /> เพิ่มผู้จำหน่าย
          </button>
        }
      />

      <div className="stat-grid">
        <Stat label="ผู้จำหน่ายทั้งหมด" value={`${suppliers.length} ราย`} tone="neutral" />
      </div>

      <section className="data-card inventory-stock-card sup-card-section">
        <div className="inventory-toolbar">
          <label className="inventory-search sup-search-label">
            <Search size={16} className="sup-search-icon" />
            <input
              type="search"
              placeholder="ค้นหาชื่อผู้จำหน่าย, เบอร์โทร, LINE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sup-search-input"
              style={{ paddingLeft: "38px" }}
            />
          </label>
        </div>

        {loading && <div className="api-message">กำลังโหลดข้อมูลผู้จำหน่าย...</div>}
        {error && <div className="api-message error">{error}</div>}

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
                  <th className="sup-th-action"></th>
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
                        <div className="sup-table-cell-flex">
                          <div className="sup-icon-box">
                            <Building2 size={18} />
                          </div>
                          <strong>{nameVal}</strong>
                        </div>
                      </td>
                      <td>{phoneVal}</td>
                      <td>{lineVal}</td>
                      <td>{productVal}</td>
                      <td>{addressVal}</td>

                      <td className="sup-td-action">
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
          className="sup-popover-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <button
            type="button"
            className="menu-item-btn edit"
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
            className="menu-item-btn delete"
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
        <div className="sup-modal-overlay">
          <div className="sup-modal-box">
            <div className="sup-modal-icon-wrap">
              <AlertTriangle size={24} />
            </div>

            <h3 className="sup-modal-title">ยืนยันการลบข้อมูล</h3>
            <p className="sup-modal-desc">
              คุณต้องการลบผู้จัดจำหน่าย <strong>"{deleteModalState.name}"</strong> ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>

            <div className="sup-modal-actions">
              <button
                type="button"
                disabled={deleteModalState.isDeleting}
                onClick={() => setDeleteModalState({ isOpen: false, id: null, name: "", isDeleting: false })}
                className="sup-btn-cancel"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleteModalState.isDeleting}
                onClick={() => void confirmDelete()}
                className="sup-btn-delete"
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

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await apiFetch<any>("/products");
        const list: ProductItem[] = Array.isArray(res) ? res : res?.data || [];
        const names = list
          .map((p) => (p.product_name || p.name || "").trim())
          .filter(Boolean);
        setAvailableProducts(Array.from(new Set(names)));
      } catch (err) {
        console.error("Failed to load products list:", err);
      }
    }
    void loadProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const addProductItem = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    if (!selectedProducts.includes(trimmed)) {
      setSelectedProducts([...selectedProducts, trimmed]);
    }
    setProductInput("");
    setIsDropdownOpen(false);
  };

  const removeProductItem = (itemToRemove: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p !== itemToRemove));
  };

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

  const filteredProductOptions = availableProducts.filter((p) =>
    p.toLowerCase().includes(productInput.toLowerCase())
  );

  const isFormInvalid = !formData.name.trim() || selectedProducts.length === 0 || saving;

  return (
    <AdminShell active="suppliers">
      <div className="sup-form-wrapper">
        <div className="sup-form-header">
          <button
            type="button"
            onClick={() => router.back()}
            className="sup-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="sup-form-title">
              {supplierId ? "แก้ไขข้อมูลผู้จำหน่าย" : "เพิ่มผู้จำหน่ายใหม่"}
            </h1>
            <p className="sup-form-subtitle">
              {supplierId ? "แก้ไขรายละเอียดบริษัทคู่ค้า" : "ระบุข้อมูลบริษัทคู่ค้าสำหรับใช้ในระบบ"}
            </p>
          </div>
        </div>

        {fetching ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>กำลังโหลดข้อมูลเดิม...</div>
        ) : (
          <form onSubmit={handleSubmit} className="sup-form-container">
            <div>
              <label className="sup-form-label">
                ชื่อบริษัท / ผู้จำหน่าย <span className="sup-required">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น บริษัท สยามฟู้ดส์ จำกัด"
                className="sup-input"
              />
            </div>

            <div className="sup-grid-2col">
              <div>
                <label className="sup-form-label">เบอร์โทรศัพท์</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081-234-5678"
                    className="sup-input sup-input-icon"
                  />
                  <Phone size={18} className="sup-icon-left" />
                </div>
              </div>

              <div>
                <label className="sup-form-label">LINE ID</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={formData.lineId}
                    onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                    placeholder="@supplier"
                    className="sup-input sup-input-icon"
                  />
                  <MessageSquare size={18} className="sup-icon-left" />
                </div>
              </div>
            </div>

            {/* ส่วนของสินค้าที่จำหน่าย */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <label className="sup-form-label">
                สินค้าที่จำหน่าย <span className="sup-required">*</span>
              </label>

              <div className="sup-tag-container" onClick={() => setIsDropdownOpen(true)}>
                {selectedProducts.map((p) => (
                  <span key={p} className="sup-tag-badge">
                    {p}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProductItem(p);
                      }}
                      className="sup-tag-remove"
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
                  placeholder={selectedProducts.length === 0 ? "พิมพ์ค้นหาสินค้า หรือพิมพ์ชื่อใหม่แล้วกด Enter..." : "พิมพ์เพิ่ม..."}
                  className="sup-tag-input"
                />

                <ChevronDown size={18} style={{ color: "#94a3b8", cursor: "pointer" }} />
              </div>

              {/* Autocomplete Dropdown List */}
              {isDropdownOpen && (
                <div className="sup-autocomplete-dropdown">
                  {productInput.trim() && !availableProducts.includes(productInput.trim()) && (
                    <button
                      type="button"
                      onClick={() => addProductItem(productInput)}
                      className="sup-autocomplete-create-btn"
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
                          className={`sup-autocomplete-item ${isSelected ? "selected" : ""}`}
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
              <label className="sup-form-label">ที่อยู่</label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="ที่อยู่สำหรับออกใบเสร็จหรือจัดส่งสินค้า..."
                className="sup-textarea"
              />
            </div>

            <div className="sup-form-footer">
              <button
                type="button"
                onClick={() => router.back()}
                className="sup-btn-cancel"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isFormInvalid}
                className="sup-btn-submit"
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