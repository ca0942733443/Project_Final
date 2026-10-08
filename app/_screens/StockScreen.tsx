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
        left: Math.min(rect.right - 130, window.innerWidth - 140),
      });
      setActiveMenuId(id);
    }
  };

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
          <div className="stock-header-action">
            <button
              className="secondary-button"
              onClick={() => router.push("/categories")}
              type="button"
            >
              <div className="stock-header-btn">
                <FolderCog size={16} />
                <span>จัดการหมวดหมู่</span>
              </div>
            </button>
            <button
              className="primary-button"
              onClick={() => router.push("/productmanage")}
              type="button"
            >
              <div className="stock-header-btn">
                <PackagePlus size={16} />
                <span>จัดการสินค้า</span>
              </div>
            </button>
          </div>
        }
      />

      <div className="stat-grid four">
        <Stat label="สินค้าทั้งหมด" value={`${stats.total} รายการ`} />
        <Stat label="สต็อกปกติ" value={`${stats.normal} รายการ`} tone="neutral" />
        <Stat label="สินค้าใกล้หมด" value={`${stats.lowStock} รายการ`} tone="orange" />
        <Stat label="สินค้าหมดสต็อก" value={`${stats.outOfStock} รายการ`} tone="red" />
      </div>

      {error && <div className="api-message error stock-error-message">{error}</div>}

      <section className="data-card stock-data-card">
        <div className="table-tools stock-table-tools">
          <div className="stock-search-wrap">
            <Search size={18} className="stock-search-icon" />
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
              className="stock-filter-select"
            >
              <option value="ALL">สถานะทั้งหมด </option>
              <option value="NORMAL">ปกติ </option>
              <option value="LOW">ใกล้หมด </option>
              <option value="OUT">หมดสต็อก </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="api-message">กำลังโหลดข้อมูลสต็อก...</div>
        ) : (
          <div className="table-wrap">
            <table className="stock-table-container">
              <thead>
                <tr>
                  <th className="stock-th-left">สินค้า / SKU</th>
                  <th className="stock-th-left">ผู้จำหน่าย</th>
                  <th className="stock-th-right">ราคาขาย</th>
                  <th className="stock-th-center">คงเหลือ</th>
                  <th className="stock-th-center">จุดแจ้งเตือน</th>
                  <th className="stock-th-center">สถานะสต็อก</th>
                  <th className="stock-th-action">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLow = item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 5);
                  const isOut = item.stockQuantity <= 0;
                  const isMenuOpen = activeMenuId === item.id;

                  return (
                    <tr key={item.id}>
                      <td className="stock-td-left">
                        <div className="stock-product-name">{item.name}</div>
                        <div className="stock-product-sku">SKU: {item.sku || "-"}</div>
                      </td>
                      <td className="stock-td-left-muted">
                        {item.supplierName || "ไม่ระบุ"}
                      </td>
                      <td className="stock-td-right-bold">
                        ฿{Number(item.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="stock-td-center">
                        <span className={isOut ? "stock-badge-out" : isLow ? "stock-badge-low" : "stock-badge-normal"}>
                          {item.stockQuantity} {item.unit || "ชิ้น"}
                        </span>
                      </td>

                      <td className="stock-td-center-muted">
                        {item.lowStockThreshold || 5} {item.unit || "ชิ้น"}
                      </td>

                      <td className="stock-td-center">
                        {isOut ? (
                          <span className="stock-pill-out">
                            <AlertTriangle size={13} /> หมดสต็อก
                          </span>
                        ) : isLow ? (
                          <span className="stock-pill-low">
                            <AlertTriangle size={13} /> สต็อกต่ำ
                          </span>
                        ) : (
                          <span className="stock-pill-normal">
                            <CheckCircle2 size={13} /> ปกติ
                          </span>
                        )}
                      </td>

                      <td className="stock-td-center-action">
                        <button
                          type="button"
                          onClick={(e) => handleToggleMenu(e, item.id)}
                          className={isMenuOpen ? "stock-action-menu-btn-active" : "stock-action-menu-btn"}
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

      {mounted && activeMenuId !== null && menuPosition && activeItem && createPortal(
        <div
          ref={menuRef}
          className="stock-popover-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <button
            type="button"
            className="stock-menu-item-btn"
            onClick={() => handleOpenEdit(activeItem)}
          >
            <Pencil size={15} className="stock-icon-blue" /> แก้ไข
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

      {deletingItem && (
        <div
          className="stock-modal-overlay"
          onClick={() => !deleting && setDeletingItem(null)}
        >
          <div
            className="stock-delete-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stock-delete-icon-wrap">
              <Trash2 size={24} />
            </div>

            <h3 className="stock-delete-title">
              ยืนยันการลบสินค้า
            </h3>

            <p className="stock-delete-text">
              คุณต้องการลบสินค้า <strong className="stock-delete-text-highlight">"{deletingItem.name}"</strong> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้
            </p>

            <div className="stock-modal-action-group">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingItem(null)}
                className="stock-cancel-btn"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="stock-confirm-delete-btn"
              >
                {deleting ? "กำลังลบ..." : "ลบสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div
          className="stock-modal-overlay"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="stock-edit-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stock-edit-modal-header">
              <h3 className="stock-edit-modal-title">
                แก้ไขข้อมูลสินค้า
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="stock-close-icon-btn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="stock-edit-form-body">
                <div>
                  <label className="stock-form-label">
                    ชื่อสินค้า
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="stock-form-input"
                  />
                </div>

                <div className="stock-grid-2col">
                  <div>
                    <label className="stock-form-label">
                      ราคาขาย (บาท)
                    </label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="stock-form-input"
                    />
                  </div>

                  <div>
                    <label className="stock-form-label">
                      จำนวนสต็อก
                    </label>
                    <input
                      type="number"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value === "" ? "" : Number(e.target.value))}
                      className="stock-form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="stock-form-label">
                    หน่วยนับ
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="เช่น ชิ้น, แพ็ค, ถุง"
                    className="stock-form-input"
                  />
                </div>
              </div>

              <div className="stock-edit-form-footer">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="stock-small-cancel-btn"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="stock-save-submit-btn"
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
