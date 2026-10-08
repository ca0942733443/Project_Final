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
        <div className="ap-loading-container">
          กำลังโหลดข้อมูลสินค้า...
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="productmanage">
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

      <form onSubmit={handleSubmit} className="ap-form">
        {error && (
          <div className="ap-alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1: ข้อมูลสินค้า */}
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
              <label className="ap-label">
                หมวดหมู่ย่อย
              </label>
              <select
                value={selectedSubCategoryId}
                onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                disabled={!selectedCategoryId}
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
                  className="ap-input ap-input-sku"
                />
                <button
                  type="button"
                  onClick={handleRandomizeSKU}
                  title="สุ่ม SKU"
                  className="ap-btn-random-sku"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="ap-label">
                บาร์โค้ด <span className="ap-required">*</span>
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="เช่น 8850123456789"
                required
                className="ap-input"
              />
            </div>
          </div>

          <div className="ap-field-group">
            <label className="ap-label">
              รายละเอียดสินค้าเพิ่มเติม
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="กรอกรายละเอียดเพิ่มเติมเกี่ยวกับสินค้า..."
              rows={3}
              className="ap-textarea"
            />
          </div>

          <div>
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
                  className="ap-btn-remove-image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="ap-image-upload-label">
                <ImagePlus size={28} className="ap-image-upload-icon" />
                <span className="ap-image-upload-text">เพิ่มรูปสินค้า</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="ap-hidden-file-input" />
              </label>
            )}
          </div>
        </div>

        {/* SECTION 2: ราคาและจำนวนสต็อก */}
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
                className="ap-input"
              />
            </div>

            <div>
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
                className="ap-input"
              />
            </div>
          </div>

          <div className="ap-grid-2col" style={{ marginBottom: 0 }}>
            <div>
              <label className="ap-label">
                หน่วยนับ (base_unit) <span className="ap-required">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
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
              <label className="ap-label">
                จำนวนสต็อกเริ่มต้น
              </label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
                className="ap-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: การจัดการแจ้งเตือนสต็อก */}
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
                className="ap-checkbox"
              />
              เปิดการแจ้งเตือนสินค้าใกล้หมด
            </label>
          </div>

          {enableNotification && (
            <div className="ap-reorder-container">
              <label className="ap-label">
                จุดสั่งซื้อเติมสต็อก (reorder_point)
              </label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="5"
                className="ap-input"
              />
              <span className="ap-field-note">
                ระบบจะแจ้งเตือนเมื่อสินค้าเหลือเท่ากับหรือน้อยกว่าจำนวนนี้
              </span>
            </div>
          )}
        </div>

        {/* ปุ่มบันทึก */}
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