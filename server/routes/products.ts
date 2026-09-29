import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { currentStockBase, deductStock, receiveStock } from "../db/stock";
import { ApiError } from "../utils/api-error";
import { authenticatedUserId } from "../utils/auth-context";
import { asyncHandler } from "../utils/async-handler";
import { removeProductImage, saveProductImage } from "../utils/product-image";

interface ProductRow extends RowDataPacket {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  subCategoryName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  price: number;
  costPrice: number;
  barcode: string | null;
  description: string | null;
  unit: string;
  stockQuantityBase: number;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  imagePublicId: string | null;
  isActive: number;
}

interface ProductForUpdate extends RowDataPacket {
  id: number;
  baseUnit: string;
  productUnitId: number | null;
  unitName: string | null;
  conversionFactor: number | null;
  sellingPrice: number | null;
  barcode: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
}

type ProductInput = {
  sku?: unknown;
  name?: unknown;
  categoryId?: unknown;
  subCategoryId?: unknown;
  price?: unknown;
  costPrice?: unknown;
  barcode?: unknown;
  description?: unknown;
  unit?: unknown;
  stockQuantity?: unknown;
  lowStockThreshold?: unknown;
  supplierId?: unknown;
  imageData?: unknown;
};

export const productsRouter = Router();

function requiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, `กรุณาระบุ ${fieldName}`);
  }
  return value.trim();
}

function nonNegativeNumber(value: unknown, fieldName: string, fallback?: number) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new ApiError(400, `${fieldName} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  }
  return numberValue;
}

function categoryId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "รหัสหมวดหมู่ไม่ถูกต้อง");
  return id;
}

function optionalId(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `${fieldName}ไม่ถูกต้อง`);
  return id;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "ข้อความไม่ถูกต้อง");
  return value.trim().slice(0, maxLength) || null;
}

const productSelect = `
  SELECT
    p.product_id AS id,
    p.sku,
    p.product_name AS name,
    p.category_id AS categoryId,
    c.category_name AS categoryName,
    p.sub_category_id AS subCategoryId,
    sc.sub_category_name AS subCategoryName,
    p.supplier_id AS supplierId,
    s.supplier_name AS supplierName,
    COALESCE(pu.selling_price, 0) AS price,
    p.cost_price AS costPrice,
    pu.barcode,
    p.description,
    COALESCE(pu.unit_name, p.base_unit) AS unit,
    ROUND(
      COALESCE(stock.stockQuantityBase, 0) / COALESCE(NULLIF(pu.conversion_factor, 0), 1),
      3
    ) AS stockQuantity,
    COALESCE(stock.stockQuantityBase, 0) AS stockQuantityBase,
    p.reorder_point AS lowStockThreshold,
    p.image_url AS imageUrl,
    p.image_public_id AS imagePublicId,
    p.is_active AS isActive
  FROM products p
  INNER JOIN categories c ON c.category_id = p.category_id
  LEFT JOIN sub_categories sc ON sc.sub_category_id = p.sub_category_id
  LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
  LEFT JOIN product_units pu ON pu.product_unit_id = (
    SELECT pu2.product_unit_id
    FROM product_units pu2
    WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
    ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
    LIMIT 1
  )
  LEFT JOIN (
    SELECT product_id, SUM(quantity_remaining_base) AS stockQuantityBase
    FROM product_batches
    WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
    GROUP BY product_id
  ) stock ON stock.product_id = p.product_id
`;

productsRouter.get("/", asyncHandler(async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const category = typeof request.query.category === "string" ? request.query.category.trim() : "";
  const conditions = [
    "p.is_active = 1",
    "c.is_active = 1",
    "(p.sub_category_id IS NULL OR sc.is_active = 1)",
  ];
  const values: Array<string | number> = [];

  if (search) {
    conditions.push("(p.product_name LIKE ? OR p.sku LIKE ? OR pu.barcode LIKE ?)");
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push("(CAST(c.category_id AS CHAR) = ? OR c.category_name = ?)");
    values.push(category, category);
  }

  const [products] = await pool.query<ProductRow[]>(`
    ${productSelect}
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.product_name ASC
  `, values);
  response.json({ success: true, data: products });
}));

productsRouter.get("/:id", asyncHandler(async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "รหัสสินค้าไม่ถูกต้อง");
  const [products] = await pool.query<ProductRow[]>(`
    ${productSelect}
    WHERE p.product_id = ?
      AND p.is_active = 1
      AND c.is_active = 1
      AND (p.sub_category_id IS NULL OR sc.is_active = 1)
    LIMIT 1
  `, [productId]);
  if (!products[0]) throw new ApiError(404, "ไม่พบสินค้า");
  response.json({ success: true, data: products[0] });
}));

productsRouter.post("/", asyncHandler(async (request, response) => {
  const body = request.body as ProductInput;

  // 1. ตรวจสอบชื่อ/ยี่ห้อสินค้า
  const name = requiredText(body.name, "ชื่อสินค้า");

  // 2. สร้าง SKU อัตโนมัติหากไม่ได้ระบุ
  const sku = (typeof body.sku === "string" && body.sku.trim() !== "")
    ? body.sku.trim()
    : `SKU-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

  // 3. หมวดหมู่สินค้า
  const selectedCategoryId = body.categoryId ? categoryId(body.categoryId) : 1;
  const selectedSubCategoryId = optionalId(body.subCategoryId, "รหัสหมวดหมู่ย่อย");

  // 4. ค่าอื่นๆ
  const price = nonNegativeNumber(body.price, "ราคา", 0);
  const costPrice = nonNegativeNumber(body.costPrice, "ราคาทุน", 0);
  const barcode = optionalText(body.barcode, 100);
  const description = optionalText(body.description, 65535);
  const unit = (typeof body.unit === "string" && body.unit.trim() !== "") ? body.unit.trim() : "ชิ้น";
  const stockQuantity = nonNegativeNumber(body.stockQuantity, "จำนวนคงเหลือ", 0);
  const reorderPoint = nonNegativeNumber(body.lowStockThreshold, "จุดแจ้งเตือนสต็อก", 0);
  const selectedSupplierId = optionalId(body.supplierId, "รหัสผู้จำหน่าย");
  const recordedBy = authenticatedUserId(response);
  const image = await saveProductImage(body.imageData);

  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();

    const [categories] = await connection.query<Array<RowDataPacket & { id: number }>>(`
      SELECT category_id AS id FROM categories WHERE category_id = ? LIMIT 1 FOR UPDATE
    `, [selectedCategoryId]);

    let finalCategoryId = selectedCategoryId;
    if (!categories[0]) {
      const [firstCategory] = await connection.query<Array<RowDataPacket & { id: number }>>(`
        SELECT category_id AS id FROM categories LIMIT 1
      `);
      if (firstCategory[0]) {
        finalCategoryId = firstCategory[0].id;
      } else {
        throw new ApiError(404, "ไม่พบหมวดหมู่สินค้าในระบบ กรุณาเพิ่มหมวดหมู่ก่อนสร้างสินค้า");
      }
    }

    if (selectedSupplierId !== null) {
      const [suppliers] = await connection.query<Array<RowDataPacket & { id: number }>>(`
        SELECT supplier_id AS id FROM suppliers WHERE supplier_id = ? LIMIT 1 FOR UPDATE
      `, [selectedSupplierId]);
      if (!suppliers[0]) throw new ApiError(404, "ไม่พบผู้จำหน่าย");
    }

    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO products (
        category_id, sub_category_id, supplier_id, sku, product_name, description, cost_price, base_unit, reorder_point,
        image_url, image_public_id, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      finalCategoryId,
      selectedSubCategoryId,
      selectedSupplierId,
      sku,
      name,
      description,
      costPrice,
      unit,
      reorderPoint,
      image?.url ?? null,
      image?.publicId ?? null,
    ]);

    const [unitResult] = await connection.execute<ResultSetHeader>(`
      INSERT INTO product_units (
        product_id, unit_name, conversion_factor, selling_price, barcode, is_default, is_active
      )
      VALUES (?, ?, 1, ?, ?, 1, 1)
    `, [result.insertId, unit, price, barcode]);

    if (stockQuantity > 0) {
      await receiveStock(connection, {
        productId: result.insertId,
        quantityBase: stockQuantity,
        recordedBy,
        reference: "ยอดตั้งต้นสินค้า",
        supplierId: selectedSupplierId,
      });
    }

    await connection.commit();
    committed = true;
    response.status(201).json({
      success: true,
      data: { id: result.insertId, productUnitId: unitResult.insertId },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    if (!committed && image) await removeProductImage(image.url, image.publicId);
  }
}));

// 🟢 แก้ไขสินค้า
productsRouter.patch("/:id", asyncHandler(async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "รหัสสินค้าไม่ถูกต้อง");
  const body = request.body as ProductInput;
  const recordedBy = authenticatedUserId(response);

  const connection = await pool.getConnection();
  let newImage: Awaited<ReturnType<typeof saveProductImage>> = null;
  let imageChanged = false;
  let committed = false;
  try {
    await connection.beginTransaction();
    const [products] = await connection.query<ProductForUpdate[]>(`
      SELECT
        p.product_id AS id,
        p.base_unit AS baseUnit,
        pu.product_unit_id AS productUnitId,
        pu.unit_name AS unitName,
        pu.conversion_factor AS conversionFactor,
        pu.selling_price AS sellingPrice,
        pu.barcode,
        p.image_url AS imageUrl,
        p.image_public_id AS imagePublicId
      FROM products p
      LEFT JOIN product_units pu ON pu.product_unit_id = (
        SELECT pu2.product_unit_id
        FROM product_units pu2
        WHERE pu2.product_id = p.product_id AND pu2.is_active = 1
        ORDER BY pu2.is_default DESC, pu2.product_unit_id ASC
        LIMIT 1
      )
      WHERE p.product_id = ? AND p.is_active = 1
      LIMIT 1
      FOR UPDATE
    `, [productId]);
    const product = products[0];
    if (!product) throw new ApiError(404, "ไม่พบสินค้า");

    const productUpdates: string[] = [];
    const productValues: Array<string | number | null> = [];
    const setProduct = (column: string, value: string | number | null) => {
      productUpdates.push(`${column} = ?`);
      productValues.push(value);
    };

    if (body.sku !== undefined) setProduct("sku", requiredText(body.sku, "SKU"));
    if (body.name !== undefined) setProduct("product_name", requiredText(body.name, "ชื่อสินค้า"));
    if (body.categoryId !== undefined) setProduct("category_id", categoryId(body.categoryId));
    if (body.subCategoryId !== undefined) setProduct("sub_category_id", optionalId(body.subCategoryId, "รหัสหมวดหมู่ย่อย"));
    if (body.description !== undefined) setProduct("description", optionalText(body.description, 65535));
    if (body.costPrice !== undefined) setProduct("cost_price", nonNegativeNumber(body.costPrice, "ราคาทุน"));
    if (body.supplierId !== undefined) {
      const selectedSupplierId = optionalId(body.supplierId, "รหัสผู้จำหน่าย");
      if (selectedSupplierId !== null) {
        const [suppliers] = await connection.query<Array<RowDataPacket & { id: number }>>(`
          SELECT supplier_id AS id FROM suppliers WHERE supplier_id = ? LIMIT 1 FOR UPDATE
        `, [selectedSupplierId]);
        if (!suppliers[0]) throw new ApiError(404, "ไม่พบผู้จำหน่าย");
      }
      setProduct("supplier_id", selectedSupplierId);
    }
    if (body.unit !== undefined) setProduct("base_unit", requiredText(body.unit, "หน่วยสินค้า"));
    if (body.lowStockThreshold !== undefined) {
      setProduct("reorder_point", nonNegativeNumber(body.lowStockThreshold, "จุดแจ้งเตือนสต็อก"));
    }
    if (body.imageData !== undefined) {
      imageChanged = true;
      newImage = body.imageData === null || body.imageData === "" ? null : await saveProductImage(body.imageData);
      setProduct("image_url", newImage?.url ?? null);
      setProduct("image_public_id", newImage?.publicId ?? null);
    }

    if (productUpdates.length) {
      productValues.push(productId);
      await connection.execute(`
        UPDATE products SET ${productUpdates.join(", ")} WHERE product_id = ?
      `, productValues);
    }

    const requestedUnit = body.unit !== undefined ? requiredText(body.unit, "หน่วยสินค้า") : product.unitName ?? product.baseUnit;
    const requestedPrice = body.price !== undefined
      ? nonNegativeNumber(body.price, "ราคา")
      : Number(product.sellingPrice ?? 0);
    const requestedBarcode = body.barcode !== undefined ? optionalText(body.barcode, 100) : product.barcode;
    let productUnitId = product.productUnitId;
    const conversionFactor = Number(product.conversionFactor ?? 1);
    if (!productUnitId) {
      const [unitResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO product_units (
          product_id, unit_name, conversion_factor, selling_price, barcode, is_default, is_active
        )
        VALUES (?, ?, 1, ?, ?, 1, 1)
      `, [productId, requestedUnit, requestedPrice, requestedBarcode]);
      productUnitId = unitResult.insertId;
    } else if (body.unit !== undefined || body.price !== undefined || body.barcode !== undefined) {
      await connection.execute(`
        UPDATE product_units SET unit_name = ?, selling_price = ?, barcode = ?
        WHERE product_unit_id = ?
      `, [requestedUnit, requestedPrice, requestedBarcode, productUnitId]);
    }

    if (body.stockQuantity !== undefined) {
      const targetSellingUnits = nonNegativeNumber(body.stockQuantity, "จำนวนคงเหลือ");
      const targetBase = Number((targetSellingUnits * conversionFactor).toFixed(3));
      const currentBase = await currentStockBase(connection, productId);
      const difference = Number((targetBase - currentBase).toFixed(3));
      if (difference > 0) {
        await receiveStock(connection, {
          productId,
          quantityBase: difference,
          recordedBy,
          reference: "ปรับยอดสินค้าจากหน้าจัดการสินค้า",
          movementType: "ADJUSTMENT",
          supplierId: body.supplierId === undefined ? null : optionalId(body.supplierId, "รหัสผู้จำหน่าย"),
        });
      } else if (difference < 0) {
        await deductStock(connection, {
          productId,
          quantityBase: Math.abs(difference),
          recordedBy,
          reference: "ปรับยอดสินค้าจากหน้าจัดการสินค้า",
          movementType: "ADJUSTMENT",
        });
      }
    }

    if (
      !productUpdates.length
      && body.price === undefined
      && body.stockQuantity === undefined
      && body.supplierId === undefined
      && body.imageData === undefined
    ) {
      throw new ApiError(400, "ไม่มีข้อมูลสำหรับแก้ไข");
    }
    await connection.commit();
    committed = true;
    if (imageChanged && product.imageUrl) await removeProductImage(product.imageUrl, product.imagePublicId);
    response.json({ success: true, data: { productUnitId } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    if (!committed && newImage) await removeProductImage(newImage.url, newImage.publicId);
  }
}));

productsRouter.delete("/:id", asyncHandler(async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "รหัสสินค้าไม่ถูกต้อง");
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE products SET is_active = 0
    WHERE product_id = ? AND is_active = 1
  `, [productId]);
  if (result.affectedRows === 0) throw new ApiError(404, "ไม่พบสินค้า");
  response.status(204).send();
}));
