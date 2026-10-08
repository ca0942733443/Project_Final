 "use client";

import {
  ChevronDown,
  FolderPlus,
  Edit,
  Trash2,
  FolderCog,
  Folder,
  FolderTree,
  MoreVertical,
  Plus,
  Save,
  Search,
  X,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AdminShell from "../_components/AdminShell";
import { Stat } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type Level3Category = {
  id: number;
  subCategoryId?: number;
  name: string;
  isProduct?: boolean;
};

type Level2Category = {
  id: number;
  categoryId?: number;
  name: string;
  subCategories?: Level3Category[];
};

type CategoryItem = {
  id: number;
  name: string;
  productCount?: number;
  subCategories?: Level2Category[];
};

type FormLevel = 2 | 3;

export default function CategoriesScreen() {
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // เปิด / ปิด Level 1
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);

  // เปิด / ปิด Level 2
  const [expandedSubCategoryIds, setExpandedSubCategoryIds] = useState<
    number[]
  >([]);

  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryItem | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [formLevel, setFormLevel] = useState<FormLevel>(2);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
  const [subFormName, setSubFormName] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    type: "category" | "subcategory" | "subsubcategory";
    id: number;
    categoryId?: number;
    subCategoryId?: number;
    title: string;
  } | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
  top: number;
  left?: number;
  right?: number;
} | null>(null);

  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<CategoryItem[]>("/categories");
      setCategories(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const toggleExpandLevel1 = (id: number) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleExpandLevel2 = (id: number) => {
    setExpandedSubCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
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

const handleToggleMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: number
  ) => {
    e.stopPropagation();

    if (activeMenuId === id) {
      setActiveMenuId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 160; // ความสูงโดยประมาณของตัวเมนู
    const spaceBelow = window.innerHeight - rect.bottom;

    // ถ้าพื้นที่ด้านล่างเหลือไม่พอให้แสดงเมนู ให้เด้งไปเปิดข้างบนแทน
    const showAbove = spaceBelow < menuHeight;

    setMenuPosition({
      top: showAbove ? rect.top - menuHeight - 8 : rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });

    setActiveMenuId(id);
  };

  const handleOpenAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setIsMainModalOpen(true);
  };

  const handleOpenEditCategoryModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setIsMainModalOpen(true);

    setActiveMenuId(null);
    setMenuPosition(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = categoryName.trim();
    if (!trimmedName) return;

    const isDuplicate = categories.some(
      (c) =>
        c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        c.id !== editingCategory?.id
    );

    if (isDuplicate) {
      setAlertMessage(`มีหมวดหมู่ชื่อ "${trimmedName}" อยู่แล้วในระบบ`);
      return;
    }

    setSavingCategory(true);

    try {
      if (editingCategory) {
        await apiFetch(`/categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: trimmedName }),
        });
      } else {
        await apiFetch("/categories", {
          method: "POST",
          body: JSON.stringify({ name: trimmedName }),
        });
      }

      setIsMainModalOpen(false);
      setCategoryName("");
      setEditingCategory(null);

      await loadCategories();
    } catch (err) {
      setAlertMessage(errorMessage(err));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRequestDeleteCategory = (id: number) => {
    const cat = categories.find((c) => c.id === id);

    setDeleteConfirmConfig({
      type: "category",
      id,
      title: cat ? cat.name : "หมวดหมู่นี้",
    });

    setActiveMenuId(null);
    setMenuPosition(null);
  };

  const handleOpenAddLevel2 = (categoryId: number) => {
    setFormLevel(2);
    setEditingSubId(null);
    setSelectedCategoryId(String(categoryId));
    setSelectedSubCategoryId("");
    setSubFormName("");
    setIsSubModalOpen(true);

    setActiveMenuId(null);
    setMenuPosition(null);
  };

  const handleOpenAddLevel3 = (categoryId: number, subCategoryId: number) => {
    setFormLevel(3);
    setEditingSubId(null);
    setSelectedCategoryId(String(categoryId));
    setSelectedSubCategoryId(String(subCategoryId));
    setSubFormName("");
    setIsSubModalOpen(true);
  };

  const handleOpenEditLevel2 = (categoryId: number, sub: Level2Category) => {
    setFormLevel(2);
    setEditingSubId(sub.id);
    setSelectedCategoryId(String(categoryId));
    setSelectedSubCategoryId("");
    setSubFormName(sub.name);
    setIsSubModalOpen(true);
  };

  const handleOpenEditLevel3 = (
    categoryId: number,
    subCategoryId: number,
    subSub: Level3Category
  ) => {
    setFormLevel(3);
    setEditingSubId(subSub.id);
    setSelectedCategoryId(String(categoryId));
    setSelectedSubCategoryId(String(subCategoryId));
    setSubFormName(subSub.name);
    setIsSubModalOpen(true);
  };

  const handleSaveSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    let trimmedName = subFormName.trim();
    if (!trimmedName) return;

    if (formLevel === 2 && !selectedCategoryId) return;
    if (formLevel === 3 && !selectedSubCategoryId) return;

    try {
      setSavingSub(true);

      // LEVEL 2
      if (formLevel === 2) {
        const targetCategory = categories.find(
          (cat) => String(cat.id) === selectedCategoryId
        );

        if (targetCategory?.subCategories) {
          const duplicate = targetCategory.subCategories.some(
            (sub) =>
              sub.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
              sub.id !== editingSubId
          );

          if (duplicate) {
            setAlertMessage(
              `มีหมวดหมู่ "${trimmedName}" อยู่แล้วในหมวดหมู่ "${targetCategory.name}"`
            );
            setSavingSub(false);
            return;
          }
        }

        if (editingSubId) {
          await apiFetch(
            `/categories/${selectedCategoryId}/subcategories/${editingSubId}`,
            {
              method: "PUT",
              body: JSON.stringify({ name: trimmedName }),
            }
          );
        } else {
          await apiFetch(`/categories/${selectedCategoryId}/subcategories`, {
            method: "POST",
            body: JSON.stringify({ name: trimmedName }),
          });
        }
      }

      // LEVEL 3
      if (formLevel === 3) {
        const targetCategory = categories.find(
          (cat) => String(cat.id) === selectedCategoryId
        );

        const targetSub = targetCategory?.subCategories?.find(
          (sub) => String(sub.id) === selectedSubCategoryId
        );

        // 📌 เติมชื่อหมวดหมู่ระดับ 2 นำหน้าอัตโนมัติ (เช่น "น้ำปลา" + "ตราปลา" -> "น้ำปลาตราปลา")
        if (targetSub?.name) {
          const parentName = targetSub.name.trim();
          if (!trimmedName.startsWith(parentName)) {
            trimmedName = `${parentName}${trimmedName}`;
          }
        }

        if (targetSub?.subCategories) {
          const duplicate = targetSub.subCategories.some(
            (subSub) =>
              subSub.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
              subSub.id !== editingSubId
          );

          if (duplicate) {
            setAlertMessage(
              `มีหมวดหมู่ "${trimmedName}" อยู่แล้วใน "${targetSub.name}"`
            );
            setSavingSub(false);
            return;
          }
        }

        if (editingSubId) {
          await apiFetch(
            `/categories/${selectedCategoryId}/subcategories/${selectedSubCategoryId}/items/${editingSubId}`,
            {
              method: "PUT",
              body: JSON.stringify({ name: trimmedName }),
            }
          );
        } else {
          await apiFetch(
            `/categories/${selectedCategoryId}/subcategories/${selectedSubCategoryId}/items`,
            {
              method: "POST",
              body: JSON.stringify({ name: trimmedName }),
            }
          );
        }
      }

      setIsSubModalOpen(false);
      setEditingSubId(null);
      setSelectedCategoryId("");
      setSelectedSubCategoryId("");
      setSubFormName("");

      await loadCategories();
    } catch (err) {
      setAlertMessage(errorMessage(err));
    } finally {
      setSavingSub(false);
    }
  };

  const handleRequestDeleteLevel2 = (
    categoryId: number,
    subId: number,
    subName: string
  ) => {
    setDeleteConfirmConfig({
      type: "subcategory",
      id: subId,
      categoryId,
      title: subName,
    });
  };

  const handleRequestDeleteLevel3 = (
    categoryId: number,
    subCategoryId: number,
    subSubId: number,
    subSubName: string
  ) => {
    setDeleteConfirmConfig({
      type: "subsubcategory",
      id: subSubId,
      categoryId,
      subCategoryId,
      title: subSubName,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmConfig) return;

    const { type, id, categoryId, subCategoryId } = deleteConfirmConfig;
    setDeleteConfirmConfig(null);

    try {
      if (type === "category") {
        await apiFetch(`/categories/${id}`, { method: "DELETE" });
      } else if (type === "subcategory" && categoryId) {
        await apiFetch(`/categories/${categoryId}/subcategories/${id}`, {
          method: "DELETE",
        });
      } else if (type === "subsubcategory" && categoryId && subCategoryId) {
        await apiFetch(
          `/categories/${categoryId}/subcategories/${subCategoryId}/items/${id}`,
          { method: "DELETE" }
        );
      }

      await loadCategories();
    } catch (err) {
      setAlertMessage(errorMessage(err));
    }
  };

  const filteredCategories = categories.filter((cat) => {
    if (!search.trim()) return true;
    const kw = search.toLowerCase();

    const matchLevel1 = cat.name.toLowerCase().includes(kw);
    const matchLevel2 = cat.subCategories?.some((sub) =>
      sub.name.toLowerCase().includes(kw)
    );
    const matchLevel3 = cat.subCategories?.some((sub) =>
      sub.subCategories?.some((subSub) =>
        subSub.name.toLowerCase().includes(kw)
      )
    );

    return matchLevel1 || matchLevel2 || matchLevel3;
  });

  return (
    <AdminShell active="categories">
      {/* HEADER */}
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
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e293b",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              จัดการหมวดหมู่สินค้า
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                margin: "4px 0 0 0",
              }}
            >
              เพิ่มและจัดการหมวดหมู่สินค้า
            </p>
          </div>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={handleOpenAddCategoryModal}
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
          <Plus size={18} />
          เพิ่มหมวดหมู่
        </button>
      </div>

      {/* STAT */}
      <div className="stat-grid">
        <Stat
          label="หมวดหมู่หลักทั้งหมด"
          value={`${categories.length} หมวดหมู่`}
          tone="neutral"
        />
      </div>

      {/* TABLE */}
      <section
        className="data-card inventory-stock-card"
        style={{ marginTop: "20px" }}
      >
        <div className="inventory-toolbar">
          <label
            className="inventory-search"
            style={{
              width: "100%",
              maxWidth: "360px",
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              placeholder="ค้นหาชื่อหมวดหมู่..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: "36px" }}
            />
          </label>
        </div>

        {loading && <div className="api-message">กำลังโหลดข้อมูลหมวดหมู่...</div>}
        {error && <div className="api-message error">{error}</div>}

        <div className="inventory-table inventory-table-single">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>ชื่อหมวดหมู่</th>
                  <th style={{ textAlign: "center" }}>หมวดหมู่ย่อย</th>
                  <th style={{ textAlign: "center" }}>จำนวนสินค้า</th>
                  <th style={{ width: "50px", textAlign: "center" }} />
                </tr>
              </thead>

              <tbody>
                {filteredCategories.map((cat) => {
                  const isMenuOpen = activeMenuId === cat.id;
                  const isExpanded = expandedCategoryIds.includes(cat.id);
                  const subCount = cat.subCategories?.length ?? 0;

                  return (
                    <React.Fragment key={cat.id}>
                      {/* LEVEL 1 */}
                      <tr>
                        <td style={{ textAlign: "left" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpandLevel1(cat.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: subCount > 0 ? "pointer" : "default",
                                padding: "2px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#64748b",
                                opacity: subCount > 0 ? 1 : 0.35,
                                transform: isExpanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                              }}
                            >
                              <ChevronDown size={18} />
                            </button>

                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: "#eff6ff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#046c4e",
                                flexShrink: 0,
                              }}
                            >
                              <FolderCog size={18} />
                            </div>

                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#0f172a",
                              }}
                            >
                              {cat.name}
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "14px",
                              color: subCount > 0 ? "#334155" : "#94a3b8",
                            }}
                          >
                            {subCount > 0 ? `${subCount} หมวดหมู่` : "—"}
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              backgroundColor: "#f1f5f9",
                              color: "#475569",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            {cat.productCount ?? 0} รายการ
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, cat.id)}
                            style={{
                              background: isMenuOpen ? "#f1f5f9" : "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "8px",
                              color: "#64748b",
                            }}
                          >
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>

                      {/* LEVEL 2 */}
                      {isExpanded &&
                        cat.subCategories?.map((sub) => {
                          const subExpanded = expandedSubCategoryIds.includes(
                            sub.id
                          );
                          const productCount = sub.subCategories?.length ?? 0;

                          return (
                            <React.Fragment key={`sub-${sub.id}`}>
                              <tr style={{ backgroundColor: "#f8fafc" }}>
                                <td
                                  style={{
                                    textAlign: "left",
                                    paddingLeft: "58px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandLevel2(sub.id)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor:
                                          productCount > 0
                                            ? "pointer"
                                            : "default",
                                        padding: "2px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#64748b",
                                        opacity: productCount > 0 ? 1 : 0.35,
                                        transform: subExpanded
                                          ? "rotate(180deg)"
                                          : "rotate(0deg)",
                                      }}
                                    >
                                      <ChevronDown size={16} />
                                    </button>

                                    <div
                                      style={{
                                        width: "30px",
                                        height: "30px",
                                        borderRadius: "7px",
                                        backgroundColor: "#f1f5f9",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#64748b",
                                      }}
                                    >
                                      <Folder size={15} />
                                    </div>

                                    <span
                                      style={{
                                        fontSize: "14px",
                                        color: "#334155",
                                        fontWeight: "500",
                                      }}
                                    >
                                      {sub.name}
                                    </span>
                                  </div>
                                </td>

                                <td
                                  style={{
                                    textAlign: "center",
                                    fontSize: "14px",
                                    color: productCount > 0 ? "#334155" : "#94a3b8",
                                  }}
                                >
                                  {productCount > 0
                                    ? `${productCount} รายการ`
                                    : "—"}
                                </td>

                                <td
                                  style={{
                                    textAlign: "center",
                                    color: "#cbd5e1",
                                  }}
                                >
                                  —
                                </td>

                                <td style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenEditLevel2(cat.id, sub)
                                      }
                                      title="แก้ไข"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "4px",
                                        color: "#475569",
                                      }}
                                    >
                                      <Edit size={15} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRequestDeleteLevel2(
                                          cat.id,
                                          sub.id,
                                          sub.name
                                        )
                                      }
                                      title="ลบ"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "4px",
                                        color: "#ef4444",
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* LEVEL 3 */}
                              {subExpanded &&
                                sub.subCategories?.map((subSub) => (
                                  <tr
                                    key={`product-${subSub.id}`}
                                    style={{ backgroundColor: "#ffffff" }}
                                  >
                                    <td
                                      style={{
                                        textAlign: "left",
                                        paddingLeft: "105px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: "26px",
                                            height: "26px",
                                            borderRadius: "6px",
                                            backgroundColor: "#ecfdf5",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#059669",
                                          }}
                                        >
                                          <FolderTree size={14} />
                                        </div>

                                        <span
                                          style={{
                                            fontSize: "14px",
                                            color: "#475569",
                                            fontWeight: "500",
                                          }}
                                        >
                                          {subSub.name}
                                        </span>
                                      </div>
                                    </td>

                                    {/* 📌 เปลี่ยนแสดงเป็น — แทนคำว่า Level 3 */}
                                    <td
                                      style={{
                                        textAlign: "center",
                                        fontSize: "14px",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      —
                                    </td>

                                    <td
                                      style={{
                                        textAlign: "center",
                                        color: "#cbd5e1",
                                      }}
                                    >
                                      —
                                    </td>

                                    <td style={{ textAlign: "center" }}>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "4px",
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => router.push(`/addproduct?id=${subSub.id}`)}
                                          title="แก้ไขสินค้า"
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "4px",
                                            color: "#475569",
                                          }}
                                        >
                                          <Edit size={15} />
                                        </button>

                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && filteredCategories.length === 0 && (
          <div className="api-message">ไม่พบข้อมูลหมวดหมู่</div>
        )}
      </section>

      {/* MODAL LEVEL 1 */}
      {isMainModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsMainModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {editingCategory ? "แก้ไขหมวดหมู่หลัก" : "เพิ่มหมวดหมู่หลัก"}
              </h3>

              <button
                type="button"
                onClick={() => setIsMainModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f1f5f9")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    marginBottom: "6px",
                  }}
                >
                  ชื่อหมวดหมู่หลัก <span style={{ color: "#ef4444" }}>*</span>
                </label>

                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="เช่น วัตถุดิบ"
                  required
                  autoFocus
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

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsMainModalOpen(false)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: "#475569",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={savingCategory || !categoryName.trim()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    backgroundColor: "#046c4e",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: "500",
                    cursor:
                      savingCategory || !categoryName.trim()
                        ? "not-allowed"
                        : "pointer",
                    opacity: savingCategory || !categoryName.trim() ? 0.6 : 1,
                  }}
                >
                  <Save size={18} />
                  {savingCategory ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LEVEL 2 / LEVEL 3 */}
      {isSubModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsSubModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {editingSubId
                  ? formLevel === 2
                    ? "แก้ไขหมวดหมู่ระดับ 2"
                    : "แก้ไขหมวดหมู่ระดับ 3"
                  : formLevel === 2
                  ? "เพิ่มหมวดหมู่ย่อย"
                  : "เพิ่มหมวดหมู่ระดับ 3"}
              </h3>

              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f1f5f9")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSubCategory}>
              {/* LEVEL 1 SELECT */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    marginBottom: "6px",
                  }}
                >
                  หมวดหมู่หลัก
                </label>

                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  disabled={formLevel === 3 || editingSubId !== null}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">-- เลือกหมวดหมู่หลัก --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* LEVEL 2 SELECT สำหรับ Level 3 */}
              {formLevel === 3 && (
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#1e293b",
                      marginBottom: "6px",
                    }}
                  >
                    หมวดหมู่ย่อย
                  </label>

                  <select
                    value={selectedSubCategoryId}
                    onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                    disabled={editingSubId !== null}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      backgroundColor: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- เลือกหมวดหมู่ระดับ 2 --</option>
                    {categories
                      .find((cat) => String(cat.id) === selectedCategoryId)
                      ?.subCategories?.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* NAME */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    marginBottom: "6px",
                  }}
                >
                  {formLevel === 2
                    ? "ชื่อหมวดหมู่ย่อย"
                    : "ยี่ห้อหรือรุ่นสินค้า"}
                  <span style={{ color: "#ef4444" }}> *</span>
                </label>

                <input
                  type="text"
                  value={subFormName}
                  onChange={(e) => setSubFormName(e.target.value)}
                  placeholder={
                    formLevel === 2
                      ? "เช่น น้ำปลา"
                      : "เช่น ตราปลา (ระบบจะเติมชื่อหมวดนำหน้าอัตโนมัติ)"
                  }
                  required
                  autoFocus
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

                {/* 📌 พรีวิวแสดงชื่อจริงที่จะบันทึก */}
                {formLevel === 3 && selectedSubCategoryId && subFormName.trim() && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#059669" }}>
                    ชื่อที่จะถูกบันทึก:{" "}
                    <strong>
                      {(() => {
                        const parentName =
                          categories
                            .find((c) => String(c.id) === selectedCategoryId)
                            ?.subCategories?.find(
                              (s) => String(s.id) === selectedSubCategoryId
                            )?.name || "";
                        return subFormName.trim().startsWith(parentName)
                          ? subFormName.trim()
                          : `${parentName}${subFormName.trim()}`;
                      })()}
                    </strong>
                  </p>
                )}
              </div>

              {/* BUTTON */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: "#475569",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={
                    savingSub ||
                    !subFormName.trim() ||
                    !selectedCategoryId ||
                    (formLevel === 3 && !selectedSubCategoryId)
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    backgroundColor: "#046c4e",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: "500",
                    cursor:
                      savingSub ||
                      !subFormName.trim() ||
                      !selectedCategoryId ||
                      (formLevel === 3 && !selectedSubCategoryId)
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      savingSub ||
                      !subFormName.trim() ||
                      !selectedCategoryId ||
                      (formLevel === 3 && !selectedSubCategoryId)
                        ? 0.6
                        : 1,
                  }}
                >
                  <Save size={18} />
                  {savingSub ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT */}
      {alertMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setAlertMessage(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "380px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
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
                margin: "0 auto 16px",
              }}
            >
              <AlertCircle size={24} />
            </div>

            <h4
              style={{
                margin: "0 0 8px",
                fontSize: "16px",
                fontWeight: "700",
                color: "#0f172a",
              }}
            >
              แจ้งเตือน
            </h4>

            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#475569" }}>
              {alertMessage}
            </p>

            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmConfig && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setDeleteConfirmConfig(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "380px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
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
                margin: "0 auto 16px",
              }}
            >
              <Trash2 size={24} />
            </div>

            <h4
              style={{
                margin: "0 0 8px",
                fontSize: "16px",
                fontWeight: "700",
                color: "#0f172a",
              }}
            >
              ยืนยันการลบข้อมูล
            </h4>

            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#475569" }}>
              {deleteConfirmConfig.type === "category"
                ? `ลบ "${deleteConfirmConfig.title}" และซ่อนหมวดหมู่ย่อยกับสินค้าทุกรายการภายใน ใช่หรือไม่?`
                : deleteConfirmConfig.type === "subcategory"
                  ? `ลบ "${deleteConfirmConfig.title}" และซ่อนสินค้าทุกรายการภายใน ใช่หรือไม่?`
                  : `คุณต้องการลบ "${deleteConfirmConfig.title}" ใช่หรือไม่?`}
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmConfig(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

        {/* LEVEL 1 MENU (POPOVER) */}
      {mounted &&
        activeMenuId !== null &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`, // ล็อกขอบขวาให้พอดีกับปุ่มสามจุด
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              border: "1px solid #e2e8f0",
              zIndex: 999999, // ดัน z-index ให้สูงสุดเพื่อไม่ให้ถูกตัดขอบ
              minWidth: "190px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => handleOpenAddLevel2(activeMenuId)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#046c4e",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f1f5f9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <FolderPlus size={18} />
              เพิ่มหมวดหมู่ย่อย
            </button>

            <button
              type="button"
              onClick={() => {
                const cat = categories.find((c) => c.id === activeMenuId);
                if (cat) {
                  handleOpenEditCategoryModal(cat);
                }
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#334155",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f1f5f9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <Edit size={18} />
              แก้ไข
            </button>

            <button
              type="button"
              onClick={() => handleRequestDeleteCategory(activeMenuId)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#ef4444",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#fef2f2")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <Trash2 size={18} />
              ลบข้อมูล
            </button>
          </div>,
          document.body
        )}
    </AdminShell>
  );
}



// "use client";

// import {
//   ChevronDown,
//   FolderPlus,
//   Edit,
//   Trash2,
//   FolderCog,
//   Folder,
//   FolderTree,
//   MoreVertical,
//   Plus,
//   Save,
//   Search,
//   X,
//   ArrowLeft,
//   AlertCircle,
// } from "lucide-react";
// import { useRouter } from "next/navigation";
// import React, { useCallback, useEffect, useRef, useState } from "react";
// import { createPortal } from "react-dom";
// import AdminShell from "../_components/AdminShell";
// import { Stat } from "../_components/PageElements";
// import { apiFetch, errorMessage } from "../_lib/api";

// type Level3Category = {
//   id: number;
//   subCategoryId?: number;
//   name: string;
// };

// type Level2Category = {
//   id: number;
//   categoryId?: number;
//   name: string;
//   subCategories?: Level3Category[];
// };

// type CategoryItem = {
//   id: number;
//   name: string;
//   productCount?: number;
//   subCategories?: Level2Category[];
// };

// type FormLevel = 2 | 3;

// export default function CategoriesScreen() {
//   const router = useRouter();

//   const [categories, setCategories] = useState<CategoryItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [search, setSearch] = useState("");

//   // เปิด / ปิด Level 1
//   const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);

//   // เปิด / ปิด Level 2
//   const [expandedSubCategoryIds, setExpandedSubCategoryIds] = useState<
//     number[]
//   >([]);

//   const [isMainModalOpen, setIsMainModalOpen] = useState(false);
//   const [editingCategory, setEditingCategory] =
//     useState<CategoryItem | null>(null);
//   const [categoryName, setCategoryName] = useState("");
//   const [savingCategory, setSavingCategory] = useState(false);
//   const [isSubModalOpen, setIsSubModalOpen] = useState(false);
//   const [editingSubId, setEditingSubId] = useState<number | null>(null);
//   const [formLevel, setFormLevel] = useState<FormLevel>(2);
//   const [selectedCategoryId, setSelectedCategoryId] = useState("");
//   const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
//   const [subFormName, setSubFormName] = useState("");
//   const [savingSub, setSavingSub] = useState(false);
//   const [alertMessage, setAlertMessage] = useState<string | null>(null);

//   const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
//     type: "category" | "subcategory" | "subsubcategory";
//     id: number;
//     categoryId?: number;
//     subCategoryId?: number;
//     title: string;
//   } | null>(null);

//   const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
//   const [menuPosition, setMenuPosition] = useState<{
//     top: number;
//     left?: number;
//     right?: number;
//   } | null>(null);

//   const [mounted, setMounted] = useState(false);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   const loadCategories = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const data = await apiFetch<CategoryItem[]>("/categories");
//       setCategories(data);
//     } catch (err) {
//       setError(errorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void loadCategories();
//   }, [loadCategories]);

//   const toggleExpandLevel1 = (id: number) => {
//     setExpandedCategoryIds((prev) =>
//       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
//     );
//   };

//   const toggleExpandLevel2 = (id: number) => {
//     setExpandedSubCategoryIds((prev) =>
//       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
//     );
//   };

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         menuRef.current &&
//         !menuRef.current.contains(event.target as Node)
//       ) {
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

//   const handleToggleMenu = (
//     e: React.MouseEvent<HTMLButtonElement>,
//     id: number
//   ) => {
//     e.stopPropagation();

//     if (activeMenuId === id) {
//       setActiveMenuId(null);
//       setMenuPosition(null);
//       return;
//     }

//     const rect = e.currentTarget.getBoundingClientRect();
//     const menuHeight = 160;
//     const spaceBelow = window.innerHeight - rect.bottom;

//     const showAbove = spaceBelow < menuHeight;

//     setMenuPosition({
//       top: showAbove ? rect.top - menuHeight - 8 : rect.bottom + 8,
//       right: window.innerWidth - rect.right,
//     });

//     setActiveMenuId(id);
//   };

//   const handleOpenAddCategoryModal = () => {
//     setEditingCategory(null);
//     setCategoryName("");
//     setIsMainModalOpen(true);
//   };

//   const handleOpenEditCategoryModal = (cat: CategoryItem) => {
//     setEditingCategory(cat);
//     setCategoryName(cat.name);
//     setIsMainModalOpen(true);

//     setActiveMenuId(null);
//     setMenuPosition(null);
//   };

//   const handleSaveCategory = async (e: React.FormEvent) => {
//     e.preventDefault();

//     const trimmedName = categoryName.trim();
//     if (!trimmedName) return;

//     const isDuplicate = categories.some(
//       (c) =>
//         c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
//         c.id !== editingCategory?.id
//     );

//     if (isDuplicate) {
//       setAlertMessage(`มีหมวดหมู่ชื่อ "${trimmedName}" อยู่แล้วในระบบ`);
//       return;
//     }

//     setSavingCategory(true);

//     try {
//       if (editingCategory) {
//         await apiFetch(`/categories/${editingCategory.id}`, {
//           method: "PUT",
//           body: JSON.stringify({ name: trimmedName }),
//         });
//       } else {
//         await apiFetch("/categories", {
//           method: "POST",
//           body: JSON.stringify({ name: trimmedName }),
//         });
//       }

//       setIsMainModalOpen(false);
//       setCategoryName("");
//       setEditingCategory(null);

//       await loadCategories();
//     } catch (err) {
//       setAlertMessage(errorMessage(err));
//     } finally {
//       setSavingCategory(false);
//     }
//   };

//   const handleRequestDeleteCategory = (id: number) => {
//     const cat = categories.find((c) => c.id === id);

//     setDeleteConfirmConfig({
//       type: "category",
//       id,
//       title: cat ? cat.name : "หมวดหมู่นี้",
//     });

//     setActiveMenuId(null);
//     setMenuPosition(null);
//   };

//   const handleOpenAddLevel2 = (categoryId: number) => {
//     setFormLevel(2);
//     setEditingSubId(null);
//     setSelectedCategoryId(String(categoryId));
//     setSelectedSubCategoryId("");
//     setSubFormName("");
//     setIsSubModalOpen(true);

//     setActiveMenuId(null);
//     setMenuPosition(null);
//   };

//   const handleOpenAddLevel3 = (categoryId: number, subCategoryId: number) => {
//     setFormLevel(3);
//     setEditingSubId(null);
//     setSelectedCategoryId(String(categoryId));
//     setSelectedSubCategoryId(String(subCategoryId));
//     setSubFormName("");
//     setIsSubModalOpen(true);
//   };

//   const handleOpenEditLevel2 = (categoryId: number, sub: Level2Category) => {
//     setFormLevel(2);
//     setEditingSubId(sub.id);
//     setSelectedCategoryId(String(categoryId));
//     setSelectedSubCategoryId("");
//     setSubFormName(sub.name);
//     setIsSubModalOpen(true);
//   };

//   const handleOpenEditLevel3 = (
//     categoryId: number,
//     subCategoryId: number,
//     subSub: Level3Category
//   ) => {
//     setFormLevel(3);
//     setEditingSubId(subSub.id);
//     setSelectedCategoryId(String(categoryId));
//     setSelectedSubCategoryId(String(subCategoryId));
//     setSubFormName(subSub.name);
//     setIsSubModalOpen(true);
//   };

//   const handleSaveSubCategory = async (e: React.FormEvent) => {
//     e.preventDefault();

//     const rawInput = subFormName.trim();
//     if (!rawInput) return;

//     if (formLevel === 2 && !selectedCategoryId) return;
//     if (formLevel === 3 && !selectedSubCategoryId) return;

//     try {
//       setSavingSub(true);

//       // LEVEL 2
//       if (formLevel === 2) {
//         const targetCategory = categories.find(
//           (cat) => String(cat.id) === selectedCategoryId
//         );

//         if (targetCategory?.subCategories) {
//           const duplicate = targetCategory.subCategories.some(
//             (sub) =>
//               sub.name.trim().toLowerCase() === rawInput.toLowerCase() &&
//               sub.id !== editingSubId
//           );

//           if (duplicate) {
//             setAlertMessage(
//               `มีหมวดหมู่ "${rawInput}" อยู่แล้วในหมวดหมู่ "${targetCategory.name}"`
//             );
//             setSavingSub(false);
//             return;
//           }
//         }

//         if (editingSubId) {
//           await apiFetch(
//             `/categories/${selectedCategoryId}/subcategories/${editingSubId}`,
//             {
//               method: "PUT",
//               body: JSON.stringify({ name: rawInput }),
//             }
//           );
//         } else {
//           await apiFetch(`/categories/${selectedCategoryId}/subcategories`, {
//             method: "POST",
//             body: JSON.stringify({ name: rawInput }),
//           });
//         }
//       }

//       // LEVEL 3
//       if (formLevel === 3) {
//         const targetCategory = categories.find(
//           (cat) => String(cat.id) === selectedCategoryId
//         );

//         const targetSub = targetCategory?.subCategories?.find(
//           (sub) => String(sub.id) === selectedSubCategoryId
//         );

//         const parentName = targetSub?.name?.trim() || "";

//         // แยกรายการด้วย เครื่องหมายจุลภาค (,) หรือ การขึ้นบรรทัดใหม่
//         const rawItems = rawInput
//           .split(/[\n,]+/)
//           .map((item) => item.trim())
//           .filter((item) => item.length > 0);

//         // รวมชื่อหมวดหมู่ย่อยนำหน้า (เช่น "ถุงพลาสติก" + "บาง" -> "ถุงพลาสติกบาง")
//         const processedNames = rawItems.map((item) => {
//           if (parentName && !item.startsWith(parentName)) {
//             return `${parentName}${item}`;
//           }
//           return item;
//         });

//         if (editingSubId) {
//           // แก้ไขรายการเดียว
//           await apiFetch(
//             `/categories/${selectedCategoryId}/subcategories/${selectedSubCategoryId}/items/${editingSubId}`,
//             {
//               method: "PUT",
//               body: JSON.stringify({ name: processedNames[0] }),
//             }
//           );
//         } else {
//           // เพิ่มหลายรายการพร้อมกัน
//           await apiFetch(
//             `/categories/${selectedCategoryId}/subcategories/${selectedSubCategoryId}/items`,
//             {
//               method: "POST",
//               body: JSON.stringify({ names: processedNames }),
//             }
//           );
//         }
//       }

//       setIsSubModalOpen(false);
//       setEditingSubId(null);
//       setSelectedCategoryId("");
//       setSelectedSubCategoryId("");
//       setSubFormName("");

//       await loadCategories();
//     } catch (err) {
//       setAlertMessage(errorMessage(err));
//     } finally {
//       setSavingSub(false);
//     }
//   };

//   const handleRequestDeleteLevel2 = (
//     categoryId: number,
//     subId: number,
//     subName: string
//   ) => {
//     setDeleteConfirmConfig({
//       type: "subcategory",
//       id: subId,
//       categoryId,
//       title: subName,
//     });
//   };

//   const handleRequestDeleteLevel3 = (
//     categoryId: number,
//     subCategoryId: number,
//     subSubId: number,
//     subSubName: string
//   ) => {
//     setDeleteConfirmConfig({
//       type: "subsubcategory",
//       id: subSubId,
//       categoryId,
//       subCategoryId,
//       title: subSubName,
//     });
//   };

//   const handleConfirmDelete = async () => {
//     if (!deleteConfirmConfig) return;

//     const { type, id, categoryId, subCategoryId } = deleteConfirmConfig;
//     setDeleteConfirmConfig(null);

//     try {
//       if (type === "category") {
//         await apiFetch(`/categories/${id}`, { method: "DELETE" });
//       } else if (type === "subcategory" && categoryId) {
//         await apiFetch(`/categories/${categoryId}/subcategories/${id}`, {
//           method: "DELETE",
//         });
//       } else if (type === "subsubcategory" && categoryId && subCategoryId) {
//         await apiFetch(
//           `/categories/${categoryId}/subcategories/${subCategoryId}/items/${id}`,
//           { method: "DELETE" }
//         );
//       }

//       await loadCategories();
//     } catch (err) {
//       setAlertMessage(errorMessage(err));
//     }
//   };

//   const filteredCategories = categories.filter((cat) => {
//     if (!search.trim()) return true;
//     const kw = search.toLowerCase();

//     const matchLevel1 = cat.name.toLowerCase().includes(kw);
//     const matchLevel2 = cat.subCategories?.some((sub) =>
//       sub.name.toLowerCase().includes(kw)
//     );
//     const matchLevel3 = cat.subCategories?.some((sub) =>
//       sub.subCategories?.some((subSub) =>
//         subSub.name.toLowerCase().includes(kw)
//       )
//     );

//     return matchLevel1 || matchLevel2 || matchLevel3;
//   });

//   return (
//     <AdminShell active="categories">
//       {/* HEADER */}
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
//             onClick={() => router.back()}
//             style={{
//               width: "48px",
//               height: "48px",
//               borderRadius: "14px",
//               backgroundColor: "#ffffff",
//               border: "1px solid #e2e8f0",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               color: "#1e293b",
//               cursor: "pointer",
//               boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
//               flexShrink: 0,
//             }}
//           >
//             <ArrowLeft size={22} />
//           </button>

//           <div>
//             <h1
//               style={{
//                 fontSize: "22px",
//                 fontWeight: "700",
//                 color: "#0f172a",
//                 margin: 0,
//                 lineHeight: 1.2,
//               }}
//             >
//               จัดการหมวดหมู่สินค้า
//             </h1>
//             <p
//               style={{
//                 fontSize: "14px",
//                 color: "#64748b",
//                 margin: "4px 0 0 0",
//               }}
//             >
//               เพิ่มและจัดการหมวดหมู่สินค้า
//             </p>
//           </div>
//         </div>

//         <button
//           type="button"
//           className="primary-button"
//           onClick={handleOpenAddCategoryModal}
//           style={{
//             display: "inline-flex",
//             alignItems: "center",
//             gap: "8px",
//             padding: "10px 18px",
//             backgroundColor: "#046c4e",
//             color: "#ffffff",
//             borderRadius: "10px",
//             border: "none",
//             fontWeight: "600",
//             cursor: "pointer",
//           }}
//         >
//           <Plus size={18} />
//           เพิ่มหมวดหมู่
//         </button>
//       </div>

//       {/* STAT */}
//       <div className="stat-grid">
//         <Stat
//           label="หมวดหมู่หลักทั้งหมด"
//           value={`${categories.length} หมวดหมู่`}
//           tone="neutral"
//         />
//       </div>

//       {/* TABLE */}
//       <section
//         className="data-card inventory-stock-card"
//         style={{ marginTop: "20px" }}
//       >
//         <div className="inventory-toolbar">
//           <label
//             className="inventory-search"
//             style={{
//               width: "100%",
//               maxWidth: "360px",
//               position: "relative",
//               display: "flex",
//               alignItems: "center",
//             }}
//           >
//             <Search
//               size={16}
//               style={{
//                 position: "absolute",
//                 left: "12px",
//                 color: "#94a3b8",
//                 pointerEvents: "none",
//               }}
//             />
//             <input
//               type="search"
//               placeholder="ค้นหาชื่อหมวดหมู่..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{ width: "100%", paddingLeft: "36px" }}
//             />
//           </label>
//         </div>

//         {loading && <div className="api-message">กำลังโหลดข้อมูลหมวดหมู่...</div>}
//         {error && <div className="api-message error">{error}</div>}

//         <div className="inventory-table inventory-table-single">
//           <div className="table-wrap">
//             <table>
//               <thead>
//                 <tr>
//                   <th style={{ textAlign: "left" }}>ชื่อหมวดหมู่</th>
//                   <th style={{ textAlign: "center" }}>หมวดหมู่ย่อย</th>
//                   <th style={{ textAlign: "center" }}>จำนวนสินค้า</th>
//                   <th style={{ width: "50px", textAlign: "center" }} />
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredCategories.map((cat) => {
//                   const isMenuOpen = activeMenuId === cat.id;
//                   const isExpanded = expandedCategoryIds.includes(cat.id);
//                   const subCount = cat.subCategories?.length ?? 0;

//                   return (
//                     <React.Fragment key={cat.id}>
//                       {/* LEVEL 1 */}
//                       <tr>
//                         <td style={{ textAlign: "left" }}>
//                           <div
//                             style={{
//                               display: "flex",
//                               alignItems: "center",
//                               gap: "10px",
//                             }}
//                           >
//                             <button
//                               type="button"
//                               onClick={() => toggleExpandLevel1(cat.id)}
//                               style={{
//                                 background: "none",
//                                 border: "none",
//                                 cursor: subCount > 0 ? "pointer" : "default",
//                                 padding: "2px",
//                                 display: "flex",
//                                 alignItems: "center",
//                                 justifyContent: "center",
//                                 color: "#64748b",
//                                 opacity: subCount > 0 ? 1 : 0.35,
//                                 transform: isExpanded
//                                   ? "rotate(180deg)"
//                                   : "rotate(0deg)",
//                                 transition: "transform 0.2s ease",
//                               }}
//                             >
//                               <ChevronDown size={18} />
//                             </button>

//                             <div
//                               style={{
//                                 width: "36px",
//                                 height: "36px",
//                                 borderRadius: "8px",
//                                 backgroundColor: "#eff6ff",
//                                 display: "flex",
//                                 alignItems: "center",
//                                 justifyContent: "center",
//                                 color: "#046c4e",
//                                 flexShrink: 0,
//                               }}
//                             >
//                               <FolderCog size={18} />
//                             </div>

//                             <span
//                               style={{
//                                 fontSize: "14px",
//                                 fontWeight: "600",
//                                 color: "#0f172a",
//                               }}
//                             >
//                               {cat.name}
//                             </span>
//                           </div>
//                         </td>

//                         <td style={{ textAlign: "center" }}>
//                           <span
//                             style={{
//                               fontSize: "14px",
//                               color: subCount > 0 ? "#334155" : "#94a3b8",
//                             }}
//                           >
//                             {subCount > 0 ? `${subCount} หมวดหมู่` : "—"}
//                           </span>
//                         </td>

//                         <td style={{ textAlign: "center" }}>
//                           <span
//                             style={{
//                               padding: "4px 10px",
//                               borderRadius: "12px",
//                               backgroundColor: "#f1f5f9",
//                               color: "#475569",
//                               fontSize: "12px",
//                               fontWeight: "600",
//                             }}
//                           >
//                             {cat.productCount ?? 0} รายการ
//                           </span>
//                         </td>

//                         <td style={{ textAlign: "center" }}>
//                           <button
//                             type="button"
//                             onClick={(e) => handleToggleMenu(e, cat.id)}
//                             style={{
//                               background: isMenuOpen ? "#f1f5f9" : "none",
//                               border: "none",
//                               cursor: "pointer",
//                               padding: "6px",
//                               borderRadius: "8px",
//                               color: "#64748b",
//                             }}
//                           >
//                             <MoreVertical size={18} />
//                           </button>
//                         </td>
//                       </tr>

//                       {/* LEVEL 2 */}
//                       {isExpanded &&
//                         cat.subCategories?.map((sub) => {
//                           const subExpanded = expandedSubCategoryIds.includes(
//                             sub.id
//                           );
//                           const level3Count = sub.subCategories?.length ?? 0;

//                           return (
//                             <React.Fragment key={`sub-${sub.id}`}>
//                               <tr style={{ backgroundColor: "#f8fafc" }}>
//                                 <td
//                                   style={{
//                                     textAlign: "left",
//                                     paddingLeft: "58px",
//                                   }}
//                                 >
//                                   <div
//                                     style={{
//                                       display: "flex",
//                                       alignItems: "center",
//                                       gap: "8px",
//                                     }}
//                                   >
//                                     <button
//                                       type="button"
//                                       onClick={() => toggleExpandLevel2(sub.id)}
//                                       style={{
//                                         background: "none",
//                                         border: "none",
//                                         cursor:
//                                           level3Count > 0
//                                             ? "pointer"
//                                             : "default",
//                                         padding: "2px",
//                                         display: "flex",
//                                         alignItems: "center",
//                                         justifyContent: "center",
//                                         color: "#64748b",
//                                         opacity: level3Count > 0 ? 1 : 0.35,
//                                         transform: subExpanded
//                                           ? "rotate(180deg)"
//                                           : "rotate(0deg)",
//                                       }}
//                                     >
//                                       <ChevronDown size={16} />
//                                     </button>

//                                     <div
//                                       style={{
//                                         width: "30px",
//                                         height: "30px",
//                                         borderRadius: "7px",
//                                         backgroundColor: "#f1f5f9",
//                                         display: "flex",
//                                         alignItems: "center",
//                                         justifyContent: "center",
//                                         color: "#64748b",
//                                       }}
//                                     >
//                                       <Folder size={15} />
//                                     </div>

//                                     <span
//                                       style={{
//                                         fontSize: "14px",
//                                         color: "#334155",
//                                         fontWeight: "500",
//                                       }}
//                                     >
//                                       {sub.name}
//                                     </span>
//                                   </div>
//                                 </td>

//                                 <td
//                                   style={{
//                                     textAlign: "center",
//                                     fontSize: "14px",
//                                     color: level3Count > 0 ? "#334155" : "#94a3b8",
//                                   }}
//                                 >
//                                   {level3Count > 0
//                                     ? `${level3Count} หมวดหมู่`
//                                     : "—"}
//                                 </td>

//                                 <td
//                                   style={{
//                                     textAlign: "center",
//                                     color: "#cbd5e1",
//                                   }}
//                                 >
//                                   —
//                                 </td>

//                                 <td style={{ textAlign: "center" }}>
//                                   <div
//                                     style={{
//                                       display: "flex",
//                                       alignItems: "center",
//                                       justifyContent: "center",
//                                       gap: "4px",
//                                     }}
//                                   >
//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         handleOpenAddLevel3(cat.id, sub.id)
//                                       }
//                                       title="เพิ่ม Level 3"
//                                       style={{
//                                         background: "none",
//                                         border: "none",
//                                         cursor: "pointer",
//                                         padding: "4px",
//                                         color: "#046c4e",
//                                       }}
//                                     >
//                                       <FolderPlus size={15} />
//                                     </button>

//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         handleOpenEditLevel2(cat.id, sub)
//                                       }
//                                       title="แก้ไข"
//                                       style={{
//                                         background: "none",
//                                         border: "none",
//                                         cursor: "pointer",
//                                         padding: "4px",
//                                         color: "#475569",
//                                       }}
//                                     >
//                                       <Edit size={15} />
//                                     </button>

//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         handleRequestDeleteLevel2(
//                                           cat.id,
//                                           sub.id,
//                                           sub.name
//                                         )
//                                       }
//                                       title="ลบ"
//                                       style={{
//                                         background: "none",
//                                         border: "none",
//                                         cursor: "pointer",
//                                         padding: "4px",
//                                         color: "#ef4444",
//                                       }}
//                                     >
//                                       <Trash2 size={15} />
//                                     </button>
//                                   </div>
//                                 </td>
//                               </tr>

//                               {/* LEVEL 3 */}
//                               {subExpanded &&
//                                 sub.subCategories?.map((subSub) => (
//                                   <tr
//                                     key={`subsub-${subSub.id}`}
//                                     style={{ backgroundColor: "#ffffff" }}
//                                   >
//                                     <td
//                                       style={{
//                                         textAlign: "left",
//                                         paddingLeft: "105px",
//                                       }}
//                                     >
//                                       <div
//                                         style={{
//                                           display: "flex",
//                                           alignItems: "center",
//                                           gap: "8px",
//                                         }}
//                                       >
//                                         <div
//                                           style={{
//                                             width: "26px",
//                                             height: "26px",
//                                             borderRadius: "6px",
//                                             backgroundColor: "#ecfdf5",
//                                             display: "flex",
//                                             alignItems: "center",
//                                             justifyContent: "center",
//                                             color: "#059669",
//                                           }}
//                                         >
//                                           <FolderTree size={14} />
//                                         </div>

//                                         <span
//                                           style={{
//                                             fontSize: "14px",
//                                             color: "#475569",
//                                             fontWeight: "500",
//                                           }}
//                                         >
//                                           {subSub.name}
//                                         </span>
//                                       </div>
//                                     </td>

//                                     <td
//                                       style={{
//                                         textAlign: "center",
//                                         fontSize: "14px",
//                                         color: "#94a3b8",
//                                       }}
//                                     >
//                                       —
//                                     </td>

//                                     <td
//                                       style={{
//                                         textAlign: "center",
//                                         color: "#cbd5e1",
//                                       }}
//                                     >
//                                       —
//                                     </td>

//                                     <td style={{ textAlign: "center" }}>
//                                       <div
//                                         style={{
//                                           display: "flex",
//                                           alignItems: "center",
//                                           justifyContent: "center",
//                                           gap: "4px",
//                                         }}
//                                       >
//                                         <button
//                                           type="button"
//                                           onClick={() =>
//                                             handleOpenEditLevel3(
//                                               cat.id,
//                                               sub.id,
//                                               subSub
//                                             )
//                                           }
//                                           title="แก้ไข"
//                                           style={{
//                                             background: "none",
//                                             border: "none",
//                                             cursor: "pointer",
//                                             padding: "4px",
//                                             color: "#475569",
//                                           }}
//                                         >
//                                           <Edit size={15} />
//                                         </button>

//                                         <button
//                                           type="button"
//                                           onClick={() =>
//                                             handleRequestDeleteLevel3(
//                                               cat.id,
//                                               sub.id,
//                                               subSub.id,
//                                               subSub.name
//                                             )
//                                           }
//                                           title="ลบ"
//                                           style={{
//                                             background: "none",
//                                             border: "none",
//                                             cursor: "pointer",
//                                             padding: "4px",
//                                             color: "#ef4444",
//                                           }}
//                                         >
//                                           <Trash2 size={15} />
//                                         </button>
//                                       </div>
//                                     </td>
//                                   </tr>
//                                 ))}
//                             </React.Fragment>
//                           );
//                         })}
//                     </React.Fragment>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {!loading && filteredCategories.length === 0 && (
//           <div className="api-message">ไม่พบข้อมูลหมวดหมู่</div>
//         )}
//       </section>

//       {/* MODAL LEVEL 1 */}
//       {isMainModalOpen && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 1000,
//             backdropFilter: "blur(2px)",
//           }}
//           onClick={() => setIsMainModalOpen(false)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               padding: "24px",
//               maxWidth: "420px",
//               width: "100%",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 marginBottom: "20px",
//               }}
//             >
//               <h3
//                 style={{
//                   margin: 0,
//                   fontSize: "18px",
//                   fontWeight: 700,
//                   color: "#0f172a",
//                 }}
//               >
//                 {editingCategory ? "แก้ไขหมวดหมู่หลัก" : "เพิ่มหมวดหมู่หลัก"}
//               </h3>

//               <button
//                 type="button"
//                 onClick={() => setIsMainModalOpen(false)}
//                 style={{
//                   background: "none",
//                   border: "none",
//                   cursor: "pointer",
//                   color: "#64748b",
//                   padding: "6px",
//                   borderRadius: "8px",
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   transition: "background-color 0.15s ease",
//                 }}
//                 onMouseEnter={(e) =>
//                   (e.currentTarget.style.backgroundColor = "#f1f5f9")
//                 }
//                 onMouseLeave={(e) =>
//                   (e.currentTarget.style.backgroundColor = "transparent")
//                 }
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <form onSubmit={handleSaveCategory}>
//               <div style={{ marginBottom: "24px" }}>
//                 <label
//                   style={{
//                     display: "block",
//                     fontSize: "14px",
//                     fontWeight: "600",
//                     color: "#1e293b",
//                     marginBottom: "6px",
//                   }}
//                 >
//                   ชื่อหมวดหมู่หลัก <span style={{ color: "#ef4444" }}>*</span>
//                 </label>

//                 <input
//                   type="text"
//                   value={categoryName}
//                   onChange={(e) => setCategoryName(e.target.value)}
//                   placeholder="เช่น บรรจุภัณฑ์"
//                   required
//                   autoFocus
//                   style={{
//                     width: "100%",
//                     padding: "10px 14px",
//                     borderRadius: "8px",
//                     border: "1px solid #cbd5e1",
//                     fontSize: "14px",
//                     fontFamily: "inherit",
//                     boxSizing: "border-box",
//                   }}
//                 />
//               </div>

//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "flex-end",
//                   gap: "12px",
//                 }}
//               >
//                 <button
//                   type="button"
//                   onClick={() => setIsMainModalOpen(false)}
//                   style={{
//                     padding: "10px 20px",
//                     borderRadius: "8px",
//                     border: "1px solid #cbd5e1",
//                     backgroundColor: "#fff",
//                     color: "#475569",
//                     fontWeight: "500",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ยกเลิก
//                 </button>

//                 <button
//                   type="submit"
//                   disabled={savingCategory || !categoryName.trim()}
//                   style={{
//                     display: "inline-flex",
//                     alignItems: "center",
//                     gap: "8px",
//                     padding: "10px 24px",
//                     borderRadius: "8px",
//                     backgroundColor: "#046c4e",
//                     color: "#ffffff",
//                     border: "none",
//                     fontWeight: "500",
//                     cursor:
//                       savingCategory || !categoryName.trim()
//                         ? "not-allowed"
//                         : "pointer",
//                     opacity: savingCategory || !categoryName.trim() ? 0.6 : 1,
//                   }}
//                 >
//                   <Save size={18} />
//                   {savingCategory ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* MODAL LEVEL 2 / LEVEL 3 */}
//       {isSubModalOpen && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 1000,
//             backdropFilter: "blur(2px)",
//           }}
//           onClick={() => setIsSubModalOpen(false)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               padding: "24px",
//               maxWidth: "440px",
//               width: "100%",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 marginBottom: "20px",
//               }}
//             >
//               <h3
//                 style={{
//                   margin: 0,
//                   fontSize: "18px",
//                   fontWeight: 700,
//                   color: "#0f172a",
//                 }}
//               >
//                 {editingSubId
//                   ? formLevel === 2
//                     ? "แก้ไขหมวดหมู่ระดับ 2"
//                     : "แก้ไขหมวดหมู่ระดับ 3"
//                   : formLevel === 2
//                   ? "เพิ่มหมวดหมู่ย่อย"
//                   : "เพิ่มหมวดหมู่ระดับ 3"}
//               </h3>

//               <button
//                 type="button"
//                 onClick={() => setIsSubModalOpen(false)}
//                 style={{
//                   background: "none",
//                   border: "none",
//                   cursor: "pointer",
//                   color: "#64748b",
//                   padding: "6px",
//                   borderRadius: "8px",
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   transition: "background-color 0.15s ease",
//                 }}
//                 onMouseEnter={(e) =>
//                   (e.currentTarget.style.backgroundColor = "#f1f5f9")
//                 }
//                 onMouseLeave={(e) =>
//                   (e.currentTarget.style.backgroundColor = "transparent")
//                 }
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <form onSubmit={handleSaveSubCategory}>
//               {/* LEVEL 1 SELECT */}
//               <div style={{ marginBottom: "16px" }}>
//                 <label
//                   style={{
//                     display: "block",
//                     fontSize: "14px",
//                     fontWeight: "600",
//                     color: "#1e293b",
//                     marginBottom: "6px",
//                   }}
//                 >
//                   หมวดหมู่หลัก
//                 </label>

//                 <select
//                   value={selectedCategoryId}
//                   onChange={(e) => setSelectedCategoryId(e.target.value)}
//                   disabled={formLevel === 3 || editingSubId !== null}
//                   required
//                   style={{
//                     width: "100%",
//                     padding: "10px 14px",
//                     borderRadius: "8px",
//                     border: "1px solid #cbd5e1",
//                     fontSize: "14px",
//                     fontFamily: "inherit",
//                     backgroundColor: "#ffffff",
//                     boxSizing: "border-box",
//                   }}
//                 >
//                   <option value="">-- เลือกหมวดหมู่หลัก --</option>
//                   {categories.map((cat) => (
//                     <option key={cat.id} value={cat.id}>
//                       {cat.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* LEVEL 2 SELECT สำหรับ Level 3 */}
//               {formLevel === 3 && (
//                 <div style={{ marginBottom: "16px" }}>
//                   <label
//                     style={{
//                       display: "block",
//                       fontSize: "14px",
//                       fontWeight: "600",
//                       color: "#1e293b",
//                       marginBottom: "6px",
//                     }}
//                   >
//                     หมวดหมู่ย่อย
//                   </label>

//                   <select
//                     value={selectedSubCategoryId}
//                     onChange={(e) => setSelectedSubCategoryId(e.target.value)}
//                     disabled={editingSubId !== null}
//                     required
//                     style={{
//                       width: "100%",
//                       padding: "10px 14px",
//                       borderRadius: "8px",
//                       border: "1px solid #cbd5e1",
//                       fontSize: "14px",
//                       fontFamily: "inherit",
//                       backgroundColor: "#ffffff",
//                       boxSizing: "border-box",
//                     }}
//                   >
//                     <option value="">-- เลือกหมวดหมู่ระดับ 2 --</option>
//                     {categories
//                       .find((cat) => String(cat.id) === selectedCategoryId)
//                       ?.subCategories?.map((sub) => (
//                         <option key={sub.id} value={sub.id}>
//                           {sub.name}
//                         </option>
//                       ))}
//                   </select>
//                 </div>
//               )}

//               {/* NAME / INPUT */}
//               <div style={{ marginBottom: "24px" }}>
//                 <label
//                   style={{
//                     display: "block",
//                     fontSize: "14px",
//                     fontWeight: "600",
//                     color: "#1e293b",
//                     marginBottom: "6px",
//                   }}
//                 >
//                   {formLevel === 2
//                     ? "ชื่อหมวดหมู่ย่อย"
//                     : "ยี่ห้อหรือรุ่นสินค้า (ใส่หลายรายการได้ คั่นด้วย , หรือขึ้นบรรทัดใหม่)"}
//                   <span style={{ color: "#ef4444" }}> *</span>
//                 </label>

//                 {formLevel === 2 ? (
//                   <input
//                     type="text"
//                     value={subFormName}
//                     onChange={(e) => setSubFormName(e.target.value)}
//                     placeholder="เช่น ถุงพลาสติก"
//                     required
//                     autoFocus
//                     style={{
//                       width: "100%",
//                       padding: "10px 14px",
//                       borderRadius: "8px",
//                       border: "1px solid #cbd5e1",
//                       fontSize: "14px",
//                       fontFamily: "inherit",
//                       boxSizing: "border-box",
//                     }}
//                   />
//                 ) : (
//                   <textarea
//                     value={subFormName}
//                     onChange={(e) => setSubFormName(e.target.value)}
//                     placeholder="เช่น บาง, หนา, หูหิ้ว (สามารถคั่นด้วยเครื่องหมาย , หรือขึ้นบรรทัดใหม่ได้)"
//                     required
//                     autoFocus
//                     rows={3}
//                     style={{
//                       width: "100%",
//                       padding: "10px 14px",
//                       borderRadius: "8px",
//                       border: "1px solid #cbd5e1",
//                       fontSize: "14px",
//                       fontFamily: "inherit",
//                       boxSizing: "border-box",
//                       resize: "vertical",
//                     }}
//                   />
//                 )}

//                 {/* 📌 PREVIEW แสดงผลรายการที่จะถูกบันทึกจริง */}
//                 {formLevel === 3 && selectedSubCategoryId && subFormName.trim() && (
//                   <div
//                     style={{
//                       marginTop: "10px",
//                       padding: "10px 12px",
//                       backgroundColor: "#f0fdf4",
//                       borderRadius: "8px",
//                       border: "1px solid #bbf7d0",
//                       fontSize: "12px",
//                       color: "#166534",
//                     }}
//                   >
//                     <span style={{ fontWeight: "600" }}>
//                       ✨ รายการที่จะถูกบันทึกในระบบ:
//                     </span>
//                     <ul
//                       style={{
//                         margin: "4px 0 0",
//                         paddingLeft: "18px",
//                         lineHeight: 1.5,
//                       }}
//                     >
//                       {subFormName
//                         .split(/[\n,]+/)
//                         .map((item) => item.trim())
//                         .filter(Boolean)
//                         .map((item, idx) => {
//                           const parentName =
//                             categories
//                               .find((c) => String(c.id) === selectedCategoryId)
//                               ?.subCategories?.find(
//                                 (s) => String(s.id) === selectedSubCategoryId
//                               )?.name || "";
//                           const fullName = item.startsWith(parentName)
//                             ? item
//                             : `${parentName}${item}`;
//                           return (
//                             <li key={idx}>
//                               <strong>{fullName}</strong>
//                             </li>
//                           );
//                         })}
//                     </ul>
//                   </div>
//                 )}
//               </div>

//               {/* BUTTON */}
//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "flex-end",
//                   gap: "12px",
//                 }}
//               >
//                 <button
//                   type="button"
//                   onClick={() => setIsSubModalOpen(false)}
//                   style={{
//                     padding: "10px 20px",
//                     borderRadius: "8px",
//                     border: "1px solid #cbd5e1",
//                     backgroundColor: "#fff",
//                     color: "#475569",
//                     fontWeight: "500",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ยกเลิก
//                 </button>

//                 <button
//                   type="submit"
//                   disabled={
//                     savingSub ||
//                     !subFormName.trim() ||
//                     !selectedCategoryId ||
//                     (formLevel === 3 && !selectedSubCategoryId)
//                   }
//                   style={{
//                     display: "inline-flex",
//                     alignItems: "center",
//                     gap: "8px",
//                     padding: "10px 24px",
//                     borderRadius: "8px",
//                     backgroundColor: "#046c4e",
//                     color: "#ffffff",
//                     border: "none",
//                     fontWeight: "500",
//                     cursor:
//                       savingSub ||
//                       !subFormName.trim() ||
//                       !selectedCategoryId ||
//                       (formLevel === 3 && !selectedSubCategoryId)
//                         ? "not-allowed"
//                         : "pointer",
//                     opacity:
//                       savingSub ||
//                       !subFormName.trim() ||
//                       !selectedCategoryId ||
//                       (formLevel === 3 && !selectedSubCategoryId)
//                         ? 0.6
//                         : 1,
//                   }}
//                 >
//                   <Save size={18} />
//                   {savingSub ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ALERT */}
//       {alertMessage && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 100000,
//             backdropFilter: "blur(2px)",
//           }}
//           onClick={() => setAlertMessage(null)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               padding: "24px",
//               maxWidth: "380px",
//               width: "100%",
//               textAlign: "center",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
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
//                 margin: "0 auto 16px",
//               }}
//             >
//               <AlertCircle size={24} />
//             </div>

//             <h4
//               style={{
//                 margin: "0 0 8px",
//                 fontSize: "16px",
//                 fontWeight: "700",
//                 color: "#0f172a",
//               }}
//             >
//               แจ้งเตือน
//             </h4>

//             <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#475569" }}>
//               {alertMessage}
//             </p>

//             <button
//               type="button"
//               onClick={() => setAlertMessage(null)}
//               style={{
//                 width: "100%",
//                 padding: "10px",
//                 borderRadius: "8px",
//                 backgroundColor: "#2563eb",
//                 color: "#ffffff",
//                 border: "none",
//                 fontWeight: "600",
//                 cursor: "pointer",
//               }}
//             >
//               ตกลง
//             </button>
//           </div>
//         </div>
//       )}

//       {/* DELETE CONFIRM */}
//       {deleteConfirmConfig && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(15, 23, 42, 0.4)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 100000,
//             backdropFilter: "blur(2px)",
//           }}
//           onClick={() => setDeleteConfirmConfig(null)}
//         >
//           <div
//             style={{
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               padding: "24px",
//               maxWidth: "380px",
//               width: "100%",
//               textAlign: "center",
//               boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
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
//                 margin: "0 auto 16px",
//               }}
//             >
//               <Trash2 size={24} />
//             </div>

//             <h4
//               style={{
//                 margin: "0 0 8px",
//                 fontSize: "16px",
//                 fontWeight: "700",
//                 color: "#0f172a",
//               }}
//             >
//               ยืนยันการลบข้อมูล
//             </h4>

//             <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#475569" }}>
//               คุณต้องการลบ "{deleteConfirmConfig.title}" ใช่หรือไม่?
//             </p>

//             <div style={{ display: "flex", gap: "10px" }}>
//               <button
//                 type="button"
//                 onClick={() => setDeleteConfirmConfig(null)}
//                 style={{
//                   flex: 1,
//                   padding: "10px",
//                   borderRadius: "8px",
//                   border: "1px solid #cbd5e1",
//                   backgroundColor: "#ffffff",
//                   color: "#475569",
//                   fontWeight: "600",
//                   cursor: "pointer",
//                 }}
//               >
//                 ยกเลิก
//               </button>

//               <button
//                 type="button"
//                 onClick={handleConfirmDelete}
//                 style={{
//                   flex: 1,
//                   padding: "10px",
//                   borderRadius: "8px",
//                   backgroundColor: "#ef4444",
//                   color: "#ffffff",
//                   border: "none",
//                   fontWeight: "600",
//                   cursor: "pointer",
//                 }}
//               >
//                 ยืนยันการลบ
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* LEVEL 1 MENU (POPOVER) */}
//       {mounted &&
//         activeMenuId !== null &&
//         menuPosition &&
//         createPortal(
//           <div
//             ref={menuRef}
//             style={{
//               position: "fixed",
//               top: `${menuPosition.top}px`,
//               right: `${menuPosition.right}px`,
//               backgroundColor: "#ffffff",
//               borderRadius: "16px",
//               boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
//               border: "1px solid #e2e8f0",
//               zIndex: 999999,
//               minWidth: "190px",
//               padding: "8px",
//               display: "flex",
//               flexDirection: "column",
//               gap: "4px",
//             }}
//           >
//             <button
//               type="button"
//               onClick={() => handleOpenAddLevel2(activeMenuId)}
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 border: "none",
//                 background: "none",
//                 fontSize: "14px",
//                 fontWeight: "600",
//                 cursor: "pointer",
//                 textAlign: "left",
//                 borderRadius: "8px",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "10px",
//                 color: "#046c4e",
//                 transition: "background-color 0.15s ease",
//               }}
//               onMouseEnter={(e) =>
//                 (e.currentTarget.style.backgroundColor = "#f1f5f9")
//               }
//               onMouseLeave={(e) =>
//                 (e.currentTarget.style.backgroundColor = "transparent")
//               }
//             >
//               <FolderPlus size={18} />
//               เพิ่มหมวดหมู่ย่อย
//             </button>

//             <button
//               type="button"
//               onClick={() => {
//                 const cat = categories.find((c) => c.id === activeMenuId);
//                 if (cat) {
//                   handleOpenEditCategoryModal(cat);
//                 }
//               }}
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 border: "none",
//                 background: "none",
//                 fontSize: "14px",
//                 fontWeight: "600",
//                 cursor: "pointer",
//                 textAlign: "left",
//                 borderRadius: "8px",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "10px",
//                 color: "#334155",
//                 transition: "background-color 0.15s ease",
//               }}
//               onMouseEnter={(e) =>
//                 (e.currentTarget.style.backgroundColor = "#f1f5f9")
//               }
//               onMouseLeave={(e) =>
//                 (e.currentTarget.style.backgroundColor = "transparent")
//               }
//             >
//               <Edit size={18} />
//               แก้ไข
//             </button>

//             <button
//               type="button"
//               onClick={() => handleRequestDeleteCategory(activeMenuId)}
//               style={{
//                 width: "100%",
//                 padding: "10px 12px",
//                 border: "none",
//                 background: "none",
//                 fontSize: "14px",
//                 fontWeight: "600",
//                 cursor: "pointer",
//                 textAlign: "left",
//                 borderRadius: "8px",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "10px",
//                 color: "#ef4444",
//                 transition: "background-color 0.15s ease",
//               }}
//               onMouseEnter={(e) =>
//                 (e.currentTarget.style.backgroundColor = "#fef2f2")
//               }
//               onMouseLeave={(e) =>
//                 (e.currentTarget.style.backgroundColor = "transparent")
//               }
//             >
//               <Trash2 size={18} />
//               ลบข้อมูล
//             </button>
//           </div>,
//           document.body
//         )}
//     </AdminShell>
//   );
// }
